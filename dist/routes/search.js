import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { publicProfileSelect, buildPostSelect, transformPost } from "../lib/select";
import { authPlugin } from "../lib/auth";
import { PublicProfileSchema, PostSchema, HashtagSchema, AuthResponses, } from "../lib/schemas";
const security = [{ bearerAuth: [] }];
export const searchRouter = new Elysia({ prefix: "/search" })
    .use(authPlugin)
    .get("/users", async ({ query }) => {
    const q = query.q.trim();
    const limit = Math.min(query.limit ?? 20, 50);
    const offset = query.offset ?? 0;
    const [profiles, total] = await prisma.$transaction([
        prisma.profile.findMany({
            where: {
                OR: [
                    { username: { contains: q, mode: "insensitive" } },
                    { firstName: { contains: q, mode: "insensitive" } },
                    { lastName: { contains: q, mode: "insensitive" } },
                ],
            },
            select: {
                ...publicProfileSelect,
                user: { select: { _count: { select: { followedBy: true, following: true } } } },
            },
            orderBy: { username: "asc" },
            take: limit,
            skip: offset,
        }),
        prisma.profile.count({
            where: {
                OR: [
                    { username: { contains: q, mode: "insensitive" } },
                    { firstName: { contains: q, mode: "insensitive" } },
                    { lastName: { contains: q, mode: "insensitive" } },
                ],
            },
        }),
    ]);
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        profiles: profiles.map((p) => ({
            ...p,
            user: undefined,
            followersCount: p.user._count.followedBy,
            followingCount: p.user._count.following,
            isFollowing: false,
            isBlocked: false,
            pinnedPost: null,
        })),
        total,
    };
}, {
    detail: { tags: ["Search"], summary: "Search users by username or name", security },
    query: t.Object({
        q: t.String({ minLength: 1, maxLength: 100 }),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
    }),
    response: {
        200: t.Object({ profiles: t.Array(PublicProfileSchema), total: t.Number() }),
        ...AuthResponses,
    },
})
    .get("/posts", async ({ userId, query }) => {
    const q = query.q.trim();
    const limit = Math.min(query.limit ?? 20, 50);
    const offset = query.offset ?? 0;
    const where = {
        published: true,
        OR: [
            { content: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
        ],
    };
    const [posts, total] = await prisma.$transaction([
        prisma.post.findMany({
            where,
            select: buildPostSelect(userId),
            orderBy: { publishedAt: "desc" },
            take: limit,
            skip: offset,
        }),
        prisma.post.count({ where }),
    ]);
    return { posts: posts.map(transformPost), total };
}, {
    detail: { tags: ["Search"], summary: "Search posts by content or title", security },
    query: t.Object({
        q: t.String({ minLength: 1, maxLength: 100 }),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
    }),
    response: {
        200: t.Object({ posts: t.Array(PostSchema), total: t.Number() }),
        ...AuthResponses,
    },
})
    .get("/hashtags", async ({ query }) => {
    const q = query.q.trim().toLowerCase().replace(/^#/, "");
    const limit = Math.min(query.limit ?? 20, 50);
    const offset = query.offset ?? 0;
    const [hashtags, total] = await prisma.$transaction([
        prisma.hashtag.findMany({
            where: { tag: { startsWith: q } },
            select: { tag: true, _count: { select: { posts: true } } },
            orderBy: { posts: { _count: "desc" } },
            take: limit,
            skip: offset,
        }),
        prisma.hashtag.count({ where: { tag: { startsWith: q } } }),
    ]);
    return {
        hashtags: hashtags.map(h => ({ tag: h.tag, postsCount: h._count.posts })),
        total,
    };
}, {
    detail: { tags: ["Search"], summary: "Search hashtags", security },
    query: t.Object({
        q: t.String({ minLength: 1, maxLength: 50 }),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
    }),
    response: {
        200: t.Object({ hashtags: t.Array(HashtagSchema), total: t.Number() }),
        ...AuthResponses,
    },
})
    .get("/hashtags/:tag/posts", async ({ userId, params, query }) => {
    const tag = params.tag.toLowerCase();
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    const hashtag = await prisma.hashtag.findUnique({ where: { tag }, select: { id: true } });
    if (!hashtag)
        return { posts: [], total: 0 };
    const [postHashtags, total] = await prisma.$transaction([
        prisma.postHashtag.findMany({
            where: { hashtagId: hashtag.id, post: { published: true } },
            select: { post: { select: buildPostSelect(userId) } },
            orderBy: { post: { publishedAt: "desc" } },
            take: limit,
            skip: offset,
        }),
        prisma.postHashtag.count({
            where: { hashtagId: hashtag.id, post: { published: true } },
        }),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { posts: postHashtags.map((ph) => transformPost(ph.post)), total };
}, {
    detail: { tags: ["Search"], summary: "Get posts with a hashtag", security },
    query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
    }),
    response: {
        200: t.Object({ posts: t.Array(PostSchema), total: t.Number() }),
        ...AuthResponses,
    },
});
