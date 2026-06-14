import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { buildCommentSelect, transformComment } from "../lib/select";
import { authPlugin } from "../lib/auth";
import { notify, notifyMentions } from "../lib/notifications";
import { NotificationType } from "../../generated/prisma";
import { MessageSchema, ErrorSchema, CommentSchema, CommentWithRepliesSchema, AuthNotFoundResponses, AuthForbiddenNotFoundResponses, } from "../lib/schemas";
const security = [{ bearerAuth: [] }];
export const commentsRouter = new Elysia()
    .use(authPlugin)
    .get("/posts/:id/comments", async ({ userId, params, query, set }) => {
    const post = await prisma.post.findUnique({
        where: { id: params.id, published: true },
        select: { id: true },
    });
    if (!post) {
        set.status = 404;
        return { error: "Post not found" };
    }
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;
    const sel = buildCommentSelect(userId);
    const comments = await prisma.comment.findMany({
        where: { postId: params.id, parentId: null },
        select: {
            ...sel,
            replies: {
                select: sel,
                orderBy: { createdAt: "asc" },
            },
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip: offset,
    });
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        comments: comments.map((c) => ({
            ...transformComment(c),
            replies: c.replies.map(transformComment),
        })),
    };
}, {
    detail: { tags: ["Comments"], summary: "List comments on a post", security },
    query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 200 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
    }),
    response: {
        200: t.Object({ comments: t.Array(CommentWithRepliesSchema) }),
        ...AuthNotFoundResponses,
    },
})
    .post("/posts/:id/comments", async ({ userId, params, body, set }) => {
    const post = await prisma.post.findUnique({
        where: { id: params.id, published: true },
        select: { id: true, authorId: true },
    });
    if (!post) {
        set.status = 404;
        return { error: "Post not found" };
    }
    if (body.parentId) {
        const parent = await prisma.comment.findUnique({
            where: { id: body.parentId, postId: params.id },
            select: { id: true },
        });
        if (!parent) {
            set.status = 404;
            return { error: "Parent comment not found" };
        }
    }
    set.status = 201;
    const comment = await prisma.comment.create({
        data: {
            postId: params.id,
            authorId: userId,
            content: body.content,
            imageUrl: body.imageUrl ?? null,
            parentId: body.parentId ?? null,
        },
        select: buildCommentSelect(userId),
    });
    await Promise.all([
        notify({ userId: post.authorId, actorId: userId, type: NotificationType.COMMENT, postId: params.id, commentId: comment.id }),
        notifyMentions(body.content, userId, params.id, comment.id),
    ]);
    return { comment: transformComment(comment) };
}, {
    detail: { tags: ["Comments"], summary: "Create a comment on a post", security },
    body: t.Object({
        content: t.String({ minLength: 1, maxLength: 5000 }),
        imageUrl: t.Optional(t.String({ maxLength: 2048 })),
        parentId: t.Optional(t.String()),
    }),
    response: {
        201: t.Object({ comment: CommentSchema }),
        ...AuthNotFoundResponses,
    },
})
    .patch("/comments/:id", async ({ userId, params, body, set }) => {
    const existing = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!existing) {
        set.status = 404;
        return { error: "Comment not found" };
    }
    if (existing.authorId !== userId) {
        set.status = 403;
        return { error: "Forbidden" };
    }
    const raw = await prisma.comment.update({
        where: { id: params.id },
        data: { content: body.content },
        select: buildCommentSelect(userId),
    });
    return { comment: transformComment(raw) };
}, {
    detail: { tags: ["Comments"], summary: "Update own comment", security },
    body: t.Object({
        content: t.String({ minLength: 1, maxLength: 5000 }),
    }),
    response: {
        200: t.Object({ comment: CommentSchema }),
        ...AuthForbiddenNotFoundResponses,
    },
})
    .delete("/comments/:id", async ({ userId, params, set }) => {
    const existing = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!existing) {
        set.status = 404;
        return { error: "Comment not found" };
    }
    if (existing.authorId !== userId) {
        set.status = 403;
        return { error: "Forbidden" };
    }
    await prisma.comment.delete({ where: { id: params.id } });
    return { message: "Comment deleted" };
}, {
    detail: { tags: ["Comments"], summary: "Delete own comment", security },
    response: {
        200: MessageSchema,
        ...AuthForbiddenNotFoundResponses,
    },
})
    .post("/comments/:id/like", async ({ userId, params, set }) => {
    const comment = await prisma.comment.findUnique({
        where: { id: params.id },
        select: { id: true, authorId: true },
    });
    if (!comment) {
        set.status = 404;
        return { error: "Comment not found" };
    }
    const existing = await prisma.commentLike.findUnique({
        where: { userId_commentId: { userId, commentId: params.id } },
    });
    if (existing) {
        set.status = 409;
        return { error: "Already liked" };
    }
    set.status = 201;
    await prisma.commentLike.create({ data: { userId, commentId: params.id } });
    notify({ userId: comment.authorId, actorId: userId, type: NotificationType.LIKE_COMMENT, commentId: params.id });
    return { message: "Comment liked" };
}, {
    detail: { tags: ["Comments"], summary: "Like a comment", security },
    response: {
        201: MessageSchema,
        409: ErrorSchema,
        ...AuthNotFoundResponses,
    },
})
    .delete("/comments/:id/like", async ({ userId, params, set }) => {
    const existing = await prisma.commentLike.findUnique({
        where: { userId_commentId: { userId, commentId: params.id } },
    });
    if (!existing) {
        set.status = 404;
        return { error: "Like not found" };
    }
    await prisma.commentLike.delete({
        where: { userId_commentId: { userId, commentId: params.id } },
    });
    return { message: "Comment unliked" };
}, {
    detail: { tags: ["Comments"], summary: "Unlike a comment", security },
    response: {
        200: MessageSchema,
        ...AuthNotFoundResponses,
    },
});
