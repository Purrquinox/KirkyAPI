import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { authPlugin } from "../lib/auth";
import { NotificationSchema, MessageSchema, AuthResponses, AuthNotFoundResponses } from "../lib/schemas";

const security = [{ bearerAuth: [] }];

const notificationSelect = {
  id: true,
  type: true,
  read: true,
  createdAt: true,
  actor: {
    select: {
      profile: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          verified: true,
        },
      },
    },
  },
  post: { select: { id: true, content: true, title: true } },
  comment: { select: { id: true, content: true } },
} as const;

export const notificationsRouter = new Elysia({ prefix: "/notifications" })
  .use(authPlugin)
  .get(
    "/",
    async ({ userId, query }) => {
      const limit = Math.min(query.limit ?? 20, 100);
      const offset = query.offset ?? 0;

      const [notifications, total] = await prisma.$transaction([
        prisma.notification.findMany({
          where: { userId },
          select: notificationSelect,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.notification.count({ where: { userId } }),
      ]);

      return { notifications, total };
    },
    {
      detail: { tags: ["Notifications"], summary: "List notifications", security },
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: {
        200: t.Object({ notifications: t.Array(NotificationSchema), total: t.Number() }),
        ...AuthResponses,
      },
    }
  )
  .get(
    "/unread-count",
    async ({ userId }) => {
      const count = await prisma.notification.count({ where: { userId, read: false } });
      return { count };
    },
    {
      detail: { tags: ["Notifications"], summary: "Get unread notification count", security },
      response: {
        200: t.Object({ count: t.Number() }),
        ...AuthResponses,
      },
    }
  )
  .patch(
    "/read-all",
    async ({ userId }) => {
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
      return { message: "All notifications marked as read" };
    },
    {
      detail: { tags: ["Notifications"], summary: "Mark all notifications as read", security },
      response: {
        200: MessageSchema,
        ...AuthResponses,
      },
    }
  )
  .patch(
    "/:id/read",
    async ({ userId, params, set }) => {
      const notification = await prisma.notification.findUnique({
        where: { id: params.id },
        select: { id: true, userId: true },
      });
      if (!notification) { set.status = 404; return { error: "Notification not found" }; }
      if (notification.userId !== userId) { set.status = 403; return { error: "Forbidden" }; }

      await prisma.notification.update({
        where: { id: params.id },
        data: { read: true },
      });
      return { message: "Notification marked as read" };
    },
    {
      detail: { tags: ["Notifications"], summary: "Mark a notification as read", security },
      response: {
        200: MessageSchema,
        ...AuthNotFoundResponses,
      },
    }
  );
