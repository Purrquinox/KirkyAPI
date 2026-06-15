import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { buildPostSelect, profileSummarySelect, transformPost } from "../lib/select";
import { authPlugin } from "../lib/auth";
import { FeedItemSchema, PostSchema, AuthResponses } from "../lib/schemas";

const security = [{ bearerAuth: [] }];

export const feedRouter = new Elysia({ prefix: "/feed" })
  .use(authPlugin)
  // ── Algorithmic feed ──────────────────────────────────────────────────────────
  .get(
    "/for-you",
    async ({ userId, query }) => {
      const limit = Math.min(query.limit ?? 20, 100);
      const offset = query.offset ?? 0;
      const fetchLimit = limit + 1; // fetch one extra to determine hasMore

      // Scoring formula:
      //   base  = (likes×2 + reposts×3 + comments×1.5) / (hours_old + 2)^1.8
      //   boost = +10 if viewer follows the author, +1.5 if author is verified
      //
      // The gravity exponent (1.8) matches Hacker News. Raising it makes the
      // feed fresher; lowering it lets older viral content linger longer.
      const scored = await prisma.$queryRaw<{ id: string; score: number }[]>`
        SELECT p.id,
          (
            (COALESCE(l.cnt, 0)::float * 2.0 +
             COALESCE(r.cnt, 0)::float * 3.0 +
             COALESCE(c.cnt, 0)::float * 1.5)
            / POWER(
                GREATEST(EXTRACT(EPOCH FROM (NOW() - p.published_at)) / 3600.0, 0.0) + 2.0,
                1.8
              )
            + CASE WHEN f.following_id IS NOT NULL THEN 10.0 ELSE 0.0 END
            + CASE WHEN pr.verified THEN 1.5 ELSE 0.0 END
          ) AS score
        FROM posts p
        LEFT JOIN (SELECT post_id, COUNT(*) AS cnt FROM post_likes GROUP BY post_id) l ON l.post_id = p.id
        LEFT JOIN (SELECT post_id, COUNT(*) AS cnt FROM reposts     GROUP BY post_id) r ON r.post_id = p.id
        LEFT JOIN (SELECT post_id, COUNT(*) AS cnt FROM comments    GROUP BY post_id) c ON c.post_id = p.id
        LEFT JOIN follows  f  ON f.follower_id = ${userId} AND f.following_id = p.author_id
        LEFT JOIN profiles pr ON pr.user_id = p.author_id
        WHERE p.published    = true
          AND p.published_at > NOW() - INTERVAL '7 days'
          AND p.author_id   != ${userId}
          AND p.author_id NOT IN (
            SELECT blocked_id FROM blocks WHERE blocker_id = ${userId}
            UNION ALL
            SELECT blocker_id FROM blocks WHERE blocked_id = ${userId}
          )
        ORDER BY score DESC
        LIMIT ${fetchLimit}
        OFFSET ${offset}
      `;

      const hasMore = scored.length > limit;
      const ids = scored.slice(0, limit).map(r => r.id);
      if (!ids.length) return { items: [], hasMore: false };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawPosts: any[] = await prisma.post.findMany({
        where: { id: { in: ids } },
        select: buildPostSelect(userId),
      });
      const postMap = new Map(rawPosts.map(p => [p.id, p]));

      return {
        items: ids.map(id => postMap.get(id)).filter(Boolean).map(transformPost),
        hasMore,
      };
    },
    {
      detail: {
        tags: ["Feed"],
        summary: "For You — algorithmic feed scored by engagement, recency, and social signals",
        security,
      },
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ items: t.Array(PostSchema), hasMore: t.Boolean() }),
        ...AuthResponses,
      },
    }
  )
  // ── Chronological following feed ──────────────────────────────────────────────
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
