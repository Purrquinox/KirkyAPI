import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { commentSelect } from "../lib/select";
import { authPlugin } from "../lib/auth";
import {
  MessageSchema,
  CommentSchema,
  CommentWithRepliesSchema,
  AuthNotFoundResponses,
  AuthForbiddenNotFoundResponses,
} from "../lib/schemas";

const security = [{ bearerAuth: [] }];

export const commentsRouter = new Elysia()
  .use(authPlugin)
  .get(
    "/posts/:postId/comments",
    async ({ params, query, set }) => {
      const post = await prisma.post.findUnique({
        where: { id: params.postId, published: true },
        select: { id: true },
      });
      if (!post) { set.status = 404; return { error: "Post not found" }; }

      const limit = Math.min(query.limit ?? 50, 200);
      const offset = query.offset ?? 0;

      const comments = await prisma.comment.findMany({
        where: { postId: params.postId, parentId: null },
        select: {
          ...commentSelect,
          replies: {
            select: commentSelect,
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip: offset,
      });

      return { comments };
    },
    {
      detail: { tags: ["Comments"], summary: "List comments on a post", security },
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 200 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ comments: t.Array(CommentWithRepliesSchema) }),
        ...AuthNotFoundResponses,
      },
    }
  )
  .post(
    "/posts/:postId/comments",
    async ({ userId, params, body, set }) => {
      const post = await prisma.post.findUnique({
        where: { id: params.postId, published: true },
        select: { id: true },
      });
      if (!post) { set.status = 404; return { error: "Post not found" }; }

      if (body.parentId) {
        const parent = await prisma.comment.findUnique({
          where: { id: body.parentId, postId: params.postId },
          select: { id: true },
        });
        if (!parent) { set.status = 404; return { error: "Parent comment not found" }; }
      }

      const comment = await prisma.comment.create({
        data: {
          postId: params.postId,
          authorId: userId,
          content: body.content,
          imageUrl: body.imageUrl ?? null,
          parentId: body.parentId ?? null,
        },
        select: commentSelect,
      });

      return { comment };
    },
    {
      detail: { tags: ["Comments"], summary: "Create a comment on a post", security },
      body: t.Object({
        content: t.String({ minLength: 1, maxLength: 5000 }),
        imageUrl: t.Optional(t.String({ maxLength: 2048 })),
        parentId: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({ comment: CommentSchema }),
        ...AuthNotFoundResponses,
      },
    }
  )
  .patch(
    "/comments/:id",
    async ({ userId, params, body, set }) => {
      const existing = await prisma.comment.findUnique({ where: { id: params.id } });
      if (!existing) { set.status = 404; return { error: "Comment not found" }; }
      if (existing.authorId !== userId) { set.status = 403; return { error: "Forbidden" }; }

      const comment = await prisma.comment.update({
        where: { id: params.id },
        data: { content: body.content },
        select: commentSelect,
      });

      return { comment };
    },
    {
      detail: { tags: ["Comments"], summary: "Update own comment", security },
      body: t.Object({
        content: t.String({ minLength: 1, maxLength: 5000 }),
      }),
      response: {
        200: t.Object({ comment: CommentSchema }),
        ...AuthForbiddenNotFoundResponses,
      },
    }
  )
  .delete("/comments/:id", async ({ userId, params, set }) => {
    const existing = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!existing) { set.status = 404; return { error: "Comment not found" }; }
    if (existing.authorId !== userId) { set.status = 403; return { error: "Forbidden" }; }

    await prisma.comment.delete({ where: { id: params.id } });
    return { message: "Comment deleted" };
  }, {
    detail: { tags: ["Comments"], summary: "Delete own comment", security },
    response: {
      200: MessageSchema,
      ...AuthForbiddenNotFoundResponses,
    },
  });
