import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import {
  publicProfileSelect,
  privateUserSelect,
  profileSummarySelect,
  buildPostSelect,
  transformPost,
} from "../lib/select";
import { authPlugin } from "../lib/auth";
import { notify } from "../lib/notifications";
import { NotificationType } from "../../generated/prisma";
import {
  PublicProfileSchema,
  ProfileSummarySchema,
  PrivateUserSchema,
  UpdatedProfileSchema,
  PostSchema,
  MessageSchema,
  ErrorSchema,
  AuthResponses,
  AuthNotFoundResponses,
  AuthForbiddenNotFoundResponses,
} from "../lib/schemas";

const security = [{ bearerAuth: [] }];

const followCountSelect = {
  _count: { select: { followedBy: true, following: true } },
} as const;

function withCounts<T extends object>(
  data: T,
  _count: { followedBy: number; following: number }
) {
  return { ...data, followersCount: _count.followedBy, followingCount: _count.following };
}

export const usersRouter = new Elysia({ prefix: "/users" })
  .use(authPlugin)
  // Must be defined before /:username to avoid "me" being treated as a username
  .get("/me", async ({ userId, set }) => {
    const raw = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...privateUserSelect, ...followCountSelect },
    });
    if (!raw) { set.status = 404; return { error: "User not found" }; }
    const { _count, profile, ...userData } = raw;
    return {
      user: {
        ...userData,
        profile: profile ? withCounts(profile, _count) : null,
      },
    };
  }, {
    detail: { tags: ["Users"], summary: "Get own profile", security },
    response: {
      200: t.Object({ user: PrivateUserSchema }),
      ...AuthNotFoundResponses,
    },
  })
  .patch(
    "/me",
    async ({ userId, body, set }) => {
      const profile = await prisma.profile.findUnique({ where: { userId } });
      if (!profile) { set.status = 404; return { error: "Profile not found" }; }

      // Validate pinnedPostId belongs to this user
      if (body.pinnedPostId) {
        const pinned = await prisma.post.findUnique({
          where: { id: body.pinnedPostId, authorId: userId, published: true },
          select: { id: true },
        });
        if (!pinned) { set.status = 404; return { error: "Post not found or not yours" }; }
      }

      const [updated, followCounts] = await prisma.$transaction([
        prisma.profile.update({
          where: { userId },
          data: {
            ...(body.username !== undefined && { username: body.username }),
            ...(body.firstName !== undefined && { firstName: body.firstName }),
            ...(body.lastName !== undefined && { lastName: body.lastName }),
            ...(body.bio !== undefined && { bio: body.bio }),
            ...(body.website !== undefined && { website: body.website }),
            ...(body.location !== undefined && { location: body.location }),
            ...(body.bannerImage !== undefined && { bannerImage: body.bannerImage }),
            ...(body.pinnedPostId !== undefined && { pinnedPostId: body.pinnedPostId }),
          },
          select: {
            username: true,
            firstName: true,
            lastName: true,
            bio: true,
            website: true,
            location: true,
            bannerImage: true,
            avatar: true,
            verified: true,
            updatedAt: true,
          },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { _count: { select: { followedBy: true, following: true } } },
        }),
      ]);

      return { profile: withCounts(updated, followCounts!._count) };
    },
    {
      detail: { tags: ["Users"], summary: "Update own profile", security },
      body: t.Object({
        username: t.Optional(
          t.String({ minLength: 3, maxLength: 20, pattern: "^[a-zA-Z0-9_-]{3,20}$" })
        ),
        firstName: t.Optional(t.Nullable(t.String({ maxLength: 50 }))),
        lastName: t.Optional(t.Nullable(t.String({ maxLength: 50 }))),
        bio: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        website: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
        location: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
        bannerImage: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
        pinnedPostId: t.Optional(t.Nullable(t.String())),
      }),
      response: {
        200: t.Object({ profile: UpdatedProfileSchema }),
        ...AuthNotFoundResponses,
      },
    }
  )
  .get("/:username", async ({ userId, params, set }) => {
    const raw = await prisma.profile.findUnique({
      where: { username: params.username },
      select: {
        ...publicProfileSelect,
        userId: true,
        pinnedPostId: true,
        user: { select: { _count: { select: { followedBy: true, following: true } } } },
      },
    });
    if (!raw) { set.status = 404; return { error: "User not found" }; }

    const { user, userId: profileUserId, pinnedPostId, ...profileData } = raw;

    const [followRel, blockRel] = await prisma.$transaction([
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: userId, followingId: profileUserId } },
        select: { followerId: true },
      }),
      prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: profileUserId } },
        select: { blockerId: true },
      }),
    ]);

    let pinnedPost = null;
    if (pinnedPostId) {
      const pinnedRaw = await prisma.post.findUnique({
        where: { id: pinnedPostId, published: true },
        select: buildPostSelect(userId),
      });
      if (pinnedRaw) pinnedPost = transformPost(pinnedRaw);
    }

    return {
      profile: {
        ...withCounts(profileData, user._count),
        isFollowing: !!followRel,
        isBlocked: !!blockRel,
        pinnedPost,
      },
    };
  }, {
    detail: { tags: ["Users"], summary: "Get public profile by username", security },
    response: {
      200: t.Object({ profile: PublicProfileSchema }),
      ...AuthNotFoundResponses,
    },
  })
  .post("/:username/follow", async ({ userId, params, set }) => {
    const target = await prisma.profile.findUnique({
      where: { username: params.username },
      select: { userId: true },
    });
    if (!target) { set.status = 404; return { error: "User not found" }; }
    if (target.userId === userId) { set.status = 400; return { error: "Cannot follow yourself" }; }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: target.userId } },
    });
    if (existing) { set.status = 409; return { error: "Already following" }; }

    set.status = 201;
    await prisma.follow.create({ data: { followerId: userId, followingId: target.userId } });
    notify({ userId: target.userId, actorId: userId, type: NotificationType.FOLLOW });
    return { message: `Following @${params.username}` };
  }, {
    detail: { tags: ["Users"], summary: "Follow a user", security },
    response: {
      201: MessageSchema,
      400: ErrorSchema,
      409: ErrorSchema,
      ...AuthNotFoundResponses,
    },
  })
  .delete("/:username/follow", async ({ userId, params, set }) => {
    const target = await prisma.profile.findUnique({
      where: { username: params.username },
      select: { userId: true },
    });
    if (!target) { set.status = 404; return { error: "User not found" }; }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: target.userId } },
    });
    if (!existing) { set.status = 404; return { error: "Not following this user" }; }

    await prisma.follow.delete({
      where: { followerId_followingId: { followerId: userId, followingId: target.userId } },
    });
    return { message: `Unfollowed @${params.username}` };
  }, {
    detail: { tags: ["Users"], summary: "Unfollow a user", security },
    response: {
      200: MessageSchema,
      ...AuthNotFoundResponses,
    },
  })
  .post("/:username/block", async ({ userId, params, set }) => {
    const target = await prisma.profile.findUnique({
      where: { username: params.username },
      select: { userId: true },
    });
    if (!target) { set.status = 404; return { error: "User not found" }; }
    if (target.userId === userId) { set.status = 400; return { error: "Cannot block yourself" }; }

    const existing = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: target.userId } },
    });
    if (existing) { set.status = 409; return { error: "Already blocked" }; }

    // Also remove any existing follow relationships
    set.status = 201;
    await prisma.$transaction([
      prisma.block.create({ data: { blockerId: userId, blockedId: target.userId } }),
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId, followingId: target.userId },
            { followerId: target.userId, followingId: userId },
          ],
        },
      }),
    ]);

    return { message: `Blocked @${params.username}` };
  }, {
    detail: { tags: ["Users"], summary: "Block a user", security },
    response: {
      201: MessageSchema,
      400: ErrorSchema,
      409: ErrorSchema,
      ...AuthNotFoundResponses,
    },
  })
  .delete("/:username/block", async ({ userId, params, set }) => {
    const target = await prisma.profile.findUnique({
      where: { username: params.username },
      select: { userId: true },
    });
    if (!target) { set.status = 404; return { error: "User not found" }; }

    const existing = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: target.userId } },
    });
    if (!existing) { set.status = 404; return { error: "Not blocking this user" }; }

    await prisma.block.delete({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: target.userId } },
    });
    return { message: `Unblocked @${params.username}` };
  }, {
    detail: { tags: ["Users"], summary: "Unblock a user", security },
    response: {
      200: MessageSchema,
      ...AuthNotFoundResponses,
    },
  })
  .get("/blocks", async ({ userId, query }) => {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;

    const [blocks, total] = await prisma.$transaction([
      prisma.block.findMany({
        where: { blockerId: userId },
        select: { blocked: { select: { profile: { select: profileSummarySelect } } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.block.count({ where: { blockerId: userId } }),
    ]);

    return { profiles: blocks.map(b => b.blocked.profile!), total };
  }, {
    detail: { tags: ["Users"], summary: "List blocked users", security },
    query: t.Object({
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      offset: t.Optional(t.Number({ minimum: 0 })),
    }),
    response: {
      200: t.Object({ profiles: t.Array(ProfileSummarySchema), total: t.Number() }),
      ...AuthResponses,
    },
  })
  .get("/:username/followers", async ({ params, query, set }) => {
    const target = await prisma.profile.findUnique({
      where: { username: params.username },
      select: { userId: true },
    });
    if (!target) { set.status = 404; return { error: "User not found" }; }

    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;

    const [follows, total] = await prisma.$transaction([
      prisma.follow.findMany({
        where: { followingId: target.userId },
        select: { follower: { select: { profile: { select: profileSummarySelect } } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.follow.count({ where: { followingId: target.userId } }),
    ]);

    return { profiles: follows.map(f => f.follower.profile!), total };
  }, {
    detail: { tags: ["Users"], summary: "List followers of a user", security },
    query: t.Object({
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      offset: t.Optional(t.Number({ minimum: 0 })),
    }),
    response: {
      200: t.Object({ profiles: t.Array(ProfileSummarySchema), total: t.Number() }),
      ...AuthNotFoundResponses,
    },
  })
  .get("/:username/following", async ({ params, query, set }) => {
    const target = await prisma.profile.findUnique({
      where: { username: params.username },
      select: { userId: true },
    });
    if (!target) { set.status = 404; return { error: "User not found" }; }

    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;

    const [follows, total] = await prisma.$transaction([
      prisma.follow.findMany({
        where: { followerId: target.userId },
        select: { following: { select: { profile: { select: profileSummarySelect } } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.follow.count({ where: { followerId: target.userId } }),
    ]);

    return { profiles: follows.map(f => f.following.profile!), total };
  }, {
    detail: { tags: ["Users"], summary: "List users followed by a user", security },
    query: t.Object({
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      offset: t.Optional(t.Number({ minimum: 0 })),
    }),
    response: {
      200: t.Object({ profiles: t.Array(ProfileSummarySchema), total: t.Number() }),
      ...AuthNotFoundResponses,
    },
  })
  .get(
    "/:username/posts",
    async ({ userId, params, query, set }) => {
      const profile = await prisma.profile.findUnique({
        where: { username: params.username },
        select: { userId: true },
      });
      if (!profile) { set.status = 404; return { error: "User not found" }; }

      const limit = Math.min(query.limit ?? 20, 100);
      const offset = query.offset ?? 0;

      const [posts, total] = await prisma.$transaction([
        prisma.post.findMany({
          where: { authorId: profile.userId, published: true },
          select: buildPostSelect(userId),
          orderBy: { publishedAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.post.count({ where: { authorId: profile.userId, published: true } }),
      ]);

      return { posts: posts.map(transformPost), total };
    },
    {
      detail: { tags: ["Users"], summary: "Get published posts by username", security },
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ posts: t.Array(PostSchema), total: t.Number() }),
        ...AuthNotFoundResponses,
      },
    }
  );
