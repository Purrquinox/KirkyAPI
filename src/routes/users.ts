import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { publicProfileSelect, privateUserSelect } from "../lib/select";
import { authPlugin } from "../lib/auth";
import {
  PublicProfileSchema,
  PrivateUserSchema,
  UpdatedProfileSchema,
  PostSchema,
  ErrorSchema,
  AuthResponses,
  AuthNotFoundResponses,
} from "../lib/schemas";

const security = [{ bearerAuth: [] }];

export const usersRouter = new Elysia({ prefix: "/users" })
  .use(authPlugin)
  // Must be defined before /:username to avoid "me" being treated as a username
  .get("/me", async ({ userId, set }) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: privateUserSelect,
    });
    if (!user) { set.status = 404; return { error: "User not found" }; }
    return { user };
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

      const updated = await prisma.profile.update({
        where: { userId },
        data: {
          ...(body.username !== undefined && { username: body.username }),
          ...(body.bio !== undefined && { bio: body.bio }),
          ...(body.website !== undefined && { website: body.website }),
          ...(body.location !== undefined && { location: body.location }),
          ...(body.bannerImage !== undefined && { bannerImage: body.bannerImage }),
        },
        select: {
          username: true,
          bio: true,
          website: true,
          location: true,
          bannerImage: true,
          avatar: true,
          verified: true,
          updatedAt: true,
        },
      });

      return { profile: updated };
    },
    {
      detail: { tags: ["Users"], summary: "Update own profile", security },
      body: t.Object({
        username: t.Optional(
          t.String({ minLength: 3, maxLength: 20, pattern: "^[a-zA-Z0-9_-]{3,20}$" })
        ),
        bio: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        website: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
        location: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
        bannerImage: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
      }),
      response: {
        200: t.Object({ profile: UpdatedProfileSchema }),
        ...AuthNotFoundResponses,
      },
    }
  )
  .get("/:username", async ({ params, set }) => {
    const profile = await prisma.profile.findUnique({
      where: { username: params.username },
      select: publicProfileSelect,
    });
    if (!profile) { set.status = 404; return { error: "User not found" }; }
    return { profile };
  }, {
    detail: { tags: ["Users"], summary: "Get public profile by username", security },
    response: {
      200: t.Object({ profile: PublicProfileSchema }),
      ...AuthNotFoundResponses,
    },
  })
  .get(
    "/:username/posts",
    async ({ params, query, set }) => {
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
          select: {
            id: true,
            title: true,
            content: true,
            imageUrl: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            author: {
              select: {
                profile: { select: { username: true, avatar: true, verified: true } },
              },
            },
          },
          orderBy: { publishedAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.post.count({ where: { authorId: profile.userId, published: true } }),
      ]);

      return { posts, total };
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
