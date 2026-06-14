import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { buildPostSelect, transformPost } from "../lib/select";
import { authPlugin } from "../lib/auth";
import { notify, notifyMentions } from "../lib/notifications";
import { syncPostHashtags } from "../lib/hashtags";
import { NotificationType } from "../../generated/prisma";
import {
  MessageSchema,
  ErrorSchema,
  PostSchema,
  PostWithPublishedSchema,
  AuthResponses,
  AuthNotFoundResponses,
  AuthForbiddenNotFoundResponses,
} from "../lib/schemas";

const security = [{ bearerAuth: [] }];

export const postsRouter = new Elysia({ prefix: "/posts" })
  .use(authPlugin)
  // Static segments must come before /:id
  .get(
    "/bookmarks",
    async ({ userId, query }) => {
      const limit = Math.min(query.limit ?? 20, 100);
      const offset = query.offset ?? 0;

      const [bookmarks, total] = await prisma.$transaction([
        prisma.bookmark.findMany({
          where: { userId },
          select: { post: { select: buildPostSelect(userId) } },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.bookmark.count({ where: { userId } }),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { posts: bookmarks.map((b: any) => transformPost(b.post)), total };
    },
    {
      detail: { tags: ["Posts"], summary: "List bookmarked posts", security },
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ posts: t.Array(PostSchema), total: t.Number() }),
        ...AuthResponses,
      },
    }
  )
  .get(
    "/",
    async ({ userId, query }) => {
      const limit = Math.min(query.limit ?? 20, 100);
      const offset = query.offset ?? 0;

      const [posts, total] = await prisma.$transaction([
        prisma.post.findMany({
          where: { published: true },
          select: buildPostSelect(userId),
          orderBy: { publishedAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.post.count({ where: { published: true } }),
      ]);

      return { posts: posts.map(transformPost), total };
    },
    {
      detail: { tags: ["Posts"], summary: "List published posts", security },
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ posts: t.Array(PostSchema), total: t.Number() }),
        ...AuthResponses,
      },
    }
  )
  .get(
    "/mine",
    async ({ userId, query }) => {
      const limit = Math.min(query.limit ?? 20, 100);
      const offset = query.offset ?? 0;

      const [posts, total] = await prisma.$transaction([
        prisma.post.findMany({
          where: { authorId: userId },
          select: { ...buildPostSelect(userId), published: true },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.post.count({ where: { authorId: userId } }),
      ]);

      return { posts: posts.map(transformPost), total };
    },
    {
      detail: { tags: ["Posts"], summary: "List own posts (including drafts)", security },
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ posts: t.Array(PostWithPublishedSchema), total: t.Number() }),
        ...AuthResponses,
      },
    }
  )
  .get("/:id", async ({ userId, params, set }) => {
    const raw = await prisma.post.findUnique({
      where: { id: params.id, published: true },
      select: buildPostSelect(userId),
    });
    if (!raw) { set.status = 404; return { error: "Post not found" }; }
    return { post: transformPost(raw) };
  }, {
    detail: { tags: ["Posts"], summary: "Get a post by ID", security },
    response: {
      200: t.Object({ post: PostSchema }),
      ...AuthNotFoundResponses,
    },
  })
  .post(
    "/",
    async ({ userId, body, set }) => {
      if (body.quoteOfId) {
        const quoted = await prisma.post.findUnique({
          where: { id: body.quoteOfId, published: true },
          select: { id: true, authorId: true },
        });
        if (!quoted) { set.status = 404; return { error: "Quoted post not found" }; }

        notify({ userId: quoted.authorId, actorId: userId, type: NotificationType.QUOTE, postId: body.quoteOfId });
      }

      const published = body.published !== false;
      set.status = 201;

      const post = await prisma.post.create({
        data: {
          authorId: userId,
          content: body.content,
          title: body.title ?? null,
          imageUrl: body.imageUrl ?? null,
          published,
          publishedAt: published ? new Date() : null,
          quoteOfId: body.quoteOfId ?? null,
        },
        select: { ...buildPostSelect(userId), published: true },
      });

      await Promise.all([
        syncPostHashtags(post.id, body.content),
        notifyMentions(body.content, userId, post.id),
      ]);

      // Re-fetch so hashtags are included
      const raw = await prisma.post.findUnique({
        where: { id: post.id },
        select: { ...buildPostSelect(userId), published: true },
      });
      return { post: transformPost(raw!) };
    },
    {
      detail: { tags: ["Posts"], summary: "Create a post", security },
      body: t.Object({
        content: t.String({ minLength: 1 }),
        title: t.Optional(t.String({ maxLength: 300 })),
        imageUrl: t.Optional(t.String({ maxLength: 2048 })),
        published: t.Optional(t.Boolean()),
        quoteOfId: t.Optional(t.String()),
      }),
      response: {
        201: t.Object({ post: PostWithPublishedSchema }),
        ...AuthNotFoundResponses,
      },
    }
  )
  .patch(
    "/:id",
    async ({ userId, params, body, set }) => {
      const existing = await prisma.post.findUnique({ where: { id: params.id } });
      if (!existing) { set.status = 404; return { error: "Post not found" }; }
      if (existing.authorId !== userId) { set.status = 403; return { error: "Forbidden" }; }

      const nowPublishing = body.published === true && !existing.published;
      const newContent = body.content ?? existing.content;

      await prisma.post.update({
        where: { id: params.id },
        data: {
          ...(body.content !== undefined && { content: body.content }),
          ...(body.title !== undefined && { title: body.title }),
          ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
          ...(body.published !== undefined && {
            published: body.published,
            publishedAt: nowPublishing ? new Date() : existing.publishedAt,
          }),
        },
      });

      await syncPostHashtags(params.id, newContent);

      const updated = await prisma.post.findUnique({
        where: { id: params.id },
        select: { ...buildPostSelect(userId), published: true },
      });
      return { post: transformPost(updated!) };
    },
    {
      detail: { tags: ["Posts"], summary: "Update own post", security },
      body: t.Object({
        content: t.Optional(t.String({ minLength: 1 })),
        title: t.Optional(t.Nullable(t.String({ maxLength: 300 }))),
        imageUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
        published: t.Optional(t.Boolean()),
      }),
      response: {
        200: t.Object({ post: PostWithPublishedSchema }),
        ...AuthForbiddenNotFoundResponses,
      },
    }
  )
  .delete("/:id", async ({ userId, params, set }) => {
    const existing = await prisma.post.findUnique({ where: { id: params.id } });
    if (!existing) { set.status = 404; return { error: "Post not found" }; }
    if (existing.authorId !== userId) { set.status = 403; return { error: "Forbidden" }; }

    await prisma.post.delete({ where: { id: params.id } });
    return { message: "Post deleted" };
  }, {
    detail: { tags: ["Posts"], summary: "Delete own post", security },
    response: {
      200: MessageSchema,
      ...AuthForbiddenNotFoundResponses,
    },
  })
  .post("/:id/like", async ({ userId, params, set }) => {
    const post = await prisma.post.findUnique({
      where: { id: params.id, published: true },
      select: { id: true, authorId: true },
    });
    if (!post) { set.status = 404; return { error: "Post not found" }; }

    const existing = await prisma.postLike.findUnique({
      where: { userId_postId: { userId, postId: params.id } },
    });
    if (existing) { set.status = 409; return { error: "Already liked" }; }

    set.status = 201;
    await prisma.postLike.create({ data: { userId, postId: params.id } });
    notify({ userId: post.authorId, actorId: userId, type: NotificationType.LIKE_POST, postId: params.id });
    return { message: "Post liked" };
  }, {
    detail: { tags: ["Posts"], summary: "Like a post", security },
    response: {
      201: MessageSchema,
      409: ErrorSchema,
      ...AuthNotFoundResponses,
    },
  })
  .delete("/:id/like", async ({ userId, params, set }) => {
    const existing = await prisma.postLike.findUnique({
      where: { userId_postId: { userId, postId: params.id } },
    });
    if (!existing) { set.status = 404; return { error: "Like not found" }; }

    await prisma.postLike.delete({ where: { userId_postId: { userId, postId: params.id } } });
    return { message: "Post unliked" };
  }, {
    detail: { tags: ["Posts"], summary: "Unlike a post", security },
    response: {
      200: MessageSchema,
      ...AuthNotFoundResponses,
    },
  })
  .post("/:id/repost", async ({ userId, params, set }) => {
    const post = await prisma.post.findUnique({
      where: { id: params.id, published: true },
      select: { id: true, authorId: true },
    });
    if (!post) { set.status = 404; return { error: "Post not found" }; }
    if (post.authorId === userId) { set.status = 400; return { error: "Cannot repost your own post" }; }

    const existing = await prisma.repost.findUnique({
      where: { userId_postId: { userId, postId: params.id } },
    });
    if (existing) { set.status = 409; return { error: "Already reposted" }; }

    set.status = 201;
    await prisma.repost.create({ data: { userId, postId: params.id } });
    notify({ userId: post.authorId, actorId: userId, type: NotificationType.REPOST, postId: params.id });
    return { message: "Post reposted" };
  }, {
    detail: { tags: ["Posts"], summary: "Repost a post", security },
    response: {
      201: MessageSchema,
      400: ErrorSchema,
      409: ErrorSchema,
      ...AuthNotFoundResponses,
    },
  })
  .delete("/:id/repost", async ({ userId, params, set }) => {
    const existing = await prisma.repost.findUnique({
      where: { userId_postId: { userId, postId: params.id } },
    });
    if (!existing) { set.status = 404; return { error: "Repost not found" }; }

    await prisma.repost.delete({ where: { userId_postId: { userId, postId: params.id } } });
    return { message: "Repost removed" };
  }, {
    detail: { tags: ["Posts"], summary: "Remove a repost", security },
    response: {
      200: MessageSchema,
      ...AuthNotFoundResponses,
    },
  })
  .post("/:id/bookmark", async ({ userId, params, set }) => {
    const post = await prisma.post.findUnique({
      where: { id: params.id, published: true },
      select: { id: true },
    });
    if (!post) { set.status = 404; return { error: "Post not found" }; }

    const existing = await prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId: params.id } },
    });
    if (existing) { set.status = 409; return { error: "Already bookmarked" }; }

    set.status = 201;
    await prisma.bookmark.create({ data: { userId, postId: params.id } });
    return { message: "Post bookmarked" };
  }, {
    detail: { tags: ["Posts"], summary: "Bookmark a post", security },
    response: {
      201: MessageSchema,
      409: ErrorSchema,
      ...AuthNotFoundResponses,
    },
  })
  .delete("/:id/bookmark", async ({ userId, params, set }) => {
    const existing = await prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId: params.id } },
    });
    if (!existing) { set.status = 404; return { error: "Bookmark not found" }; }

    await prisma.bookmark.delete({ where: { userId_postId: { userId, postId: params.id } } });
    return { message: "Bookmark removed" };
  }, {
    detail: { tags: ["Posts"], summary: "Remove a bookmark", security },
    response: {
      200: MessageSchema,
      ...AuthNotFoundResponses,
    },
  });
