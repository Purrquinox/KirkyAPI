import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { buildPostSelect, profileSummarySelect, transformPost } from "../lib/select";
import { authPlugin } from "../lib/auth";
import { FeedItemSchema, AuthResponses } from "../lib/schemas";

const security = [{ bearerAuth: [] }];

export const feedRouter = new Elysia({ prefix: "/feed" })
  .use(authPlugin)
  .get(
    "/",
    async ({ userId, query }) => {
      const limit = Math.min(query.limit ?? 20, 100);
      const offset = query.offset ?? 0;

      // Fetch IDs of everyone the viewer follows (plus themselves)
      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      const feedUserIds = [userId, ...following.map(f => f.followingId)];

      // Block list — exclude blocked users' content
      const blocks = await prisma.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      });
      const blockedIds = new Set(
        blocks.flatMap(b => [b.blockerId, b.blockedId]).filter(id => id !== userId)
      );
      const visibleUserIds = feedUserIds.filter(id => !blockedIds.has(id));

      // Fetch enough posts and reposts to satisfy offset + limit after merging
      const window = offset + limit;
      const sel = buildPostSelect(userId);

      const [rawPosts, rawReposts] = await Promise.all([
        prisma.post.findMany({
          where: { authorId: { in: visibleUserIds }, published: true },
          select: sel,
          orderBy: { publishedAt: "desc" },
          take: window,
        }),
        prisma.repost.findMany({
          where: { userId: { in: visibleUserIds } },
          select: {
            createdAt: true,
            user: { select: { profile: { select: profileSummarySelect } } },
            post: { select: sel },
          },
          orderBy: { createdAt: "desc" },
          take: window,
        }),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const postItems = rawPosts.map((p: any) => ({
        ...transformPost(p),
        type: "post" as const,
        repostedBy: null,
        repostedAt: null,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repostItems = rawReposts.map((r: any) => ({
        ...transformPost(r.post),
        type: "repost" as const,
        repostedBy: r.user.profile,
        repostedAt: r.createdAt,
      }));

      const feedAt = (item: (typeof postItems)[0] | (typeof repostItems)[0]) =>
        item.repostedAt ?? item.publishedAt ?? item.createdAt;

      const items = [...postItems, ...repostItems]
        .sort((a, b) => feedAt(b).getTime() - feedAt(a).getTime())
        .slice(offset, offset + limit);

      return { items, hasMore: items.length === limit };
    },
    {
      detail: { tags: ["Feed"], summary: "Home timeline — posts and reposts from followed users", security },
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ items: t.Array(FeedItemSchema), hasMore: t.Boolean() }),
        ...AuthResponses,
      },
    }
  );
