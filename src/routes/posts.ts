import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { postSelect } from "../lib/select";
import { authPlugin } from "../lib/auth";
import {
  MessageSchema,
  PostSchema,
  PostWithPublishedSchema,
  AuthResponses,
  AuthNotFoundResponses,
  AuthForbiddenNotFoundResponses,
} from "../lib/schemas";

const security = [{ bearerAuth: [] }];

export const postsRouter = new Elysia({ prefix: "/posts" })
  .use(authPlugin)
  .get(
    "/",
    async ({ query }) => {
      const limit = Math.min(query.limit ?? 20, 100);
      const offset = query.offset ?? 0;

      const [posts, total] = await prisma.$transaction([
        prisma.post.findMany({
          where: { published: true },
          select: postSelect,
          orderBy: { publishedAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.post.count({ where: { published: true } }),
      ]);

      return { posts, total };
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
  // Must be before /:id so "mine" is not treated as an ID
  .get(
    "/mine",
    async ({ userId, query }) => {
      const limit = Math.min(query.limit ?? 20, 100);
      const offset = query.offset ?? 0;

      const [posts, total] = await prisma.$transaction([
        prisma.post.findMany({
          where: { authorId: userId },
          select: { ...postSelect, published: true },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.post.count({ where: { authorId: userId } }),
      ]);

      return { posts, total };
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
  .get("/:id", async ({ params, set }) => {
    const post = await prisma.post.findUnique({
      where: { id: params.id, published: true },
      select: postSelect,
    });
    if (!post) { set.status = 404; return { error: "Post not found" }; }
    return { post };
  }, {
    detail: { tags: ["Posts"], summary: "Get a post by ID", security },
    response: {
      200: t.Object({ post: PostSchema }),
      ...AuthNotFoundResponses,
    },
  })
  .post(
    "/",
    async ({ userId, body }) => {
      const post = await prisma.post.create({
        data: {
          authorId: userId,
          content: body.content,
          title: body.title ?? null,
          imageUrl: body.imageUrl ?? null,
          published: body.published ?? true,
          publishedAt: body.published ? new Date() : null,
        },
        select: { ...postSelect, published: true },
      });
      return { post };
    },
    {
      detail: { tags: ["Posts"], summary: "Create a post", security },
      body: t.Object({
        content: t.String({ minLength: 1 }),
        title: t.Optional(t.String({ maxLength: 300 })),
        imageUrl: t.Optional(t.String({ maxLength: 2048 })),
        published: t.Optional(t.Boolean()),
      }),
      response: {
        200: t.Object({ post: PostWithPublishedSchema }),
        ...AuthResponses,
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

      const post = await prisma.post.update({
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
        select: { ...postSelect, published: true },
      });

      return { post };
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
  });
