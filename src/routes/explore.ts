import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { buildPostSelect, transformPost } from "../lib/select";
import { authPlugin } from "../lib/auth";
import { PostSchema, HashtagSchema, EventSchema, AuthResponses, ErrorSchema } from "../lib/schemas";

const security = [{ bearerAuth: [] }];

const windowHours: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };

function since(window: string) {
  return new Date(Date.now() - (windowHours[window] ?? 24) * 3_600_000);
}

const eventSelect = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  featured: true,
  hashtag: { select: { tag: true } },
  startsAt: true,
  endsAt: true,
  createdAt: true,
} as const;

export const exploreRouter = new Elysia({ prefix: "/explore" })
  .use(authPlugin)
  // ── Overview ─────────────────────────────────────────────────────────────────
  .get(
    "/",
    async ({ userId, query }) => {
      const cutoff = since(query.window ?? "24h");

      const [trendingHashtags, events, trendingPostIds] = await Promise.all([
        prisma.$queryRaw<{ tag: string; count: bigint }[]>`
          SELECT h.tag, COUNT(ph.post_id) AS count
          FROM hashtags h
          JOIN post_hashtags ph ON ph.hashtag_id = h.id
          JOIN posts p ON p.id = ph.post_id
          WHERE p.published = true AND p.published_at >= ${cutoff}
          GROUP BY h.id, h.tag
          ORDER BY count DESC
          LIMIT 5
        `,
        prisma.event.findMany({
          where: {
            OR: [
              { endsAt: null, startsAt: { lte: new Date() } },
              { endsAt: { gte: new Date() } },
              { startsAt: { gte: new Date() } },
            ],
          },
          select: eventSelect,
          // Featured events float to the top
          orderBy: [{ featured: "desc" }, { startsAt: "asc" }],
          take: 10,
        }),
        prisma.$queryRaw<{ id: string; engagement: bigint }[]>`
          SELECT p.id,
            (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) +
            (SELECT COUNT(*) FROM reposts r  WHERE r.post_id  = p.id) +
            (SELECT COUNT(*) FROM comments c WHERE c.post_id  = p.id) AS engagement
          FROM posts p
          WHERE p.published = true AND p.published_at >= ${cutoff}
          ORDER BY engagement DESC
          LIMIT 10
        `,
      ]);

      const ids = trendingPostIds.map(r => r.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawPosts: any[] = ids.length
        ? await prisma.post.findMany({ where: { id: { in: ids } }, select: buildPostSelect(userId) })
        : [];
      const postMap = new Map(rawPosts.map(p => [p.id, p]));

      return {
        trendingHashtags: trendingHashtags.map(h => ({ tag: h.tag, postsCount: Number(h.count) })),
        events,
        trendingPosts: ids.map(id => postMap.get(id)).filter(Boolean).map(transformPost),
      };
    },
    {
      detail: { tags: ["Explore"], summary: "Explore overview — trending hashtags, events, and posts", security },
      query: t.Object({
        window: t.Optional(t.Union([t.Literal("24h"), t.Literal("7d"), t.Literal("30d")])),
      }),
      response: {
        200: t.Object({
          trendingHashtags: t.Array(HashtagSchema),
          events: t.Array(EventSchema),
          trendingPosts: t.Array(PostSchema),
        }),
        ...AuthResponses,
      },
    }
  )
  // ── Trending hashtags ─────────────────────────────────────────────────────────
  .get(
    "/trending-hashtags",
    async ({ query }) => {
      const cutoff = since(query.window ?? "24h");
      const limit = Math.min(query.limit ?? 20, 50);
      const offset = query.offset ?? 0;

      const rows = await prisma.$queryRaw<{ tag: string; count: bigint; total: bigint }[]>`
        SELECT h.tag, COUNT(ph.post_id) AS count, COUNT(*) OVER() AS total
        FROM hashtags h
        JOIN post_hashtags ph ON ph.hashtag_id = h.id
        JOIN posts p ON p.id = ph.post_id
        WHERE p.published = true AND p.published_at >= ${cutoff}
        GROUP BY h.id, h.tag
        ORDER BY count DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return {
        hashtags: rows.map(r => ({ tag: r.tag, postsCount: Number(r.count) })),
        total: rows.length > 0 ? Number(rows[0].total) : 0,
      };
    },
    {
      detail: { tags: ["Explore"], summary: "Trending hashtags ranked by recent post activity", security },
      query: t.Object({
        window: t.Optional(t.Union([t.Literal("24h"), t.Literal("7d"), t.Literal("30d")])),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ hashtags: t.Array(HashtagSchema), total: t.Number() }),
        ...AuthResponses,
      },
    }
  )
  // ── Trending posts ────────────────────────────────────────────────────────────
  .get(
    "/trending-posts",
    async ({ userId, query }) => {
      const cutoff = since(query.window ?? "24h");
      const limit = Math.min(query.limit ?? 20, 50);

      const ranked = await prisma.$queryRaw<{ id: string; engagement: bigint }[]>`
        SELECT p.id,
          (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) +
          (SELECT COUNT(*) FROM reposts r  WHERE r.post_id  = p.id) +
          (SELECT COUNT(*) FROM comments c WHERE c.post_id  = p.id) AS engagement
        FROM posts p
        WHERE p.published = true AND p.published_at >= ${cutoff}
        ORDER BY engagement DESC
        LIMIT ${limit}
      `;

      const ids = ranked.map(r => r.id);
      if (!ids.length) return { posts: [] };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawPosts: any[] = await prisma.post.findMany({
        where: { id: { in: ids } },
        select: buildPostSelect(userId),
      });
      const postMap = new Map(rawPosts.map(p => [p.id, p]));

      return { posts: ids.map(id => postMap.get(id)).filter(Boolean).map(transformPost) };
    },
    {
      detail: { tags: ["Explore"], summary: "Trending posts ranked by recent engagement (likes + reposts + comments)", security },
      query: t.Object({
        window: t.Optional(t.Union([t.Literal("24h"), t.Literal("7d"), t.Literal("30d")])),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
      }),
      response: {
        200: t.Object({ posts: t.Array(PostSchema) }),
        ...AuthResponses,
      },
    }
  )
  // ── Events ────────────────────────────────────────────────────────────────────
  .get(
    "/events",
    async ({ query }) => {
      const limit = Math.min(query.limit ?? 20, 50);
      const offset = query.offset ?? 0;
      const now = new Date();

      const activeOrUpcoming = {
        OR: [
          { endsAt: null, startsAt: { lte: now } },
          { endsAt: { gte: now } },
          { startsAt: { gte: now } },
        ],
      };

      const where =
        query.featured === true
          ? { featured: true, ...activeOrUpcoming }
          : query.upcoming === true
            ? { startsAt: { gte: now } }
            : activeOrUpcoming;

      const [events, total] = await prisma.$transaction([
        prisma.event.findMany({
          where,
          select: eventSelect,
          orderBy: [{ featured: "desc" }, { startsAt: "asc" }],
          take: limit,
          skip: offset,
        }),
        prisma.event.count({ where }),
      ]);

      return { events, total };
    },
    {
      detail: { tags: ["Explore"], summary: "List events — active and upcoming, optionally filtered to featured only", security },
      query: t.Object({
        featured: t.Optional(t.Boolean()),
        upcoming: t.Optional(t.Boolean()),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ events: t.Array(EventSchema), total: t.Number() }),
        ...AuthResponses,
      },
    }
  )
  .post(
    "/events",
    async ({ body }) => {
      const event = await prisma.event.create({
        data: {
          title: body.title,
          description: body.description,
          imageUrl: body.imageUrl,
          featured: body.featured ?? false,
          startsAt: new Date(body.startsAt),
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          ...(body.hashtag
            ? {
                hashtag: {
                  connectOrCreate: {
                    where: { tag: body.hashtag.toLowerCase() },
                    create: { tag: body.hashtag.toLowerCase() },
                  },
                },
              }
            : {}),
        },
        select: eventSelect,
      });

      return event;
    },
    {
      detail: { tags: ["Explore"], summary: "Create an event", security },
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
        imageUrl: t.Optional(t.Nullable(t.String())),
        featured: t.Optional(t.Boolean()),
        hashtag: t.Optional(t.Nullable(t.String({ minLength: 1, maxLength: 50 }))),
        startsAt: t.String({ description: "ISO 8601 datetime" }),
        endsAt: t.Optional(t.Nullable(t.String({ description: "ISO 8601 datetime" }))),
      }),
      response: {
        200: EventSchema,
        ...AuthResponses,
      },
    }
  )
  // ── Feature / unfeature an event ─────────────────────────────────────────────
  .patch(
    "/events/:id/featured",
    async ({ params, body, set }) => {
      const existing = await prisma.event.findUnique({ where: { id: params.id }, select: { id: true } });
      if (!existing) { set.status = 404; return { error: "Event not found" }; }

      const event = await prisma.event.update({
        where: { id: params.id },
        data: { featured: body.featured },
        select: eventSelect,
      });

      return event;
    },
    {
      detail: { tags: ["Explore"], summary: "Set the featured state of an event", security },
      params: t.Object({ id: t.String() }),
      body: t.Object({ featured: t.Boolean() }),
      response: {
        200: EventSchema,
        404: ErrorSchema,
        ...AuthResponses,
      },
    }
  );
