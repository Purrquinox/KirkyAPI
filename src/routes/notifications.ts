import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { authPlugin } from "../lib/auth";
import { addSSEConnection } from "../lib/sse";
import { PushPlatform } from "../generated/prisma";
import { NotificationSchema, MessageSchema, ErrorSchema, AuthResponses, AuthNotFoundResponses } from "../lib/schemas";

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
  )
  .get(
    "/stream",
    ({ userId }) => {
      const encoder = new TextEncoder();
      let remove: (() => void) | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(": connected\n\n"));

          remove = addSSEConnection(userId, payload => {
            try { controller.enqueue(encoder.encode(payload)); } catch { /* client gone */ }
          });

          heartbeat = setInterval(() => {
            try { controller.enqueue(encoder.encode(": ping\n\n")); }
            catch { clearInterval(heartbeat); }
          }, 25000);
        },
        cancel() {
          clearInterval(heartbeat);
          remove?.();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    },
    {
      detail: { tags: ["Notifications"], summary: "SSE stream for real-time notifications", security },
    }
  )
  .get(
    "/vapid-public-key",
    () => ({ publicKey: process.env.VAPID_PUBLIC_KEY ?? "" }),
    {
      detail: { tags: ["Notifications"], summary: "Get VAPID public key for Web Push", security: [] },
      response: { 200: t.Object({ publicKey: t.String() }) },
    }
  )
  .post(
    "/push/register",
    async ({ userId, body, set }) => {
      if (body.platform === "WEB" && (!body.p256dh || !body.auth)) {
        set.status = 400;
        return { error: "p256dh and auth are required for WEB platform" };
      }

      await prisma.pushDevice.upsert({
        where: { userId_token: { userId, token: body.token } },
        create: {
          userId,
          platform: body.platform as PushPlatform,
          token: body.token,
          p256dh: body.p256dh ?? null,
          auth: body.auth ?? null,
        },
        update: {
          p256dh: body.p256dh ?? null,
          auth: body.auth ?? null,
        },
      });

      set.status = 201;
      return { message: "Device registered" };
    },
    {
      detail: { tags: ["Notifications"], summary: "Register a push device (web or iOS)", security },
      body: t.Object({
        platform: t.Union([t.Literal("WEB"), t.Literal("IOS")]),
        token: t.String({ minLength: 1 }),
        p256dh: t.Optional(t.String()),
        auth: t.Optional(t.String()),
      }),
      response: {
        201: MessageSchema,
        400: ErrorSchema,
        ...AuthResponses,
      },
    }
  )
  .delete(
    "/push/unregister",
    async ({ userId, body }) => {
      await prisma.pushDevice.deleteMany({ where: { userId, token: body.token } });
      return { message: "Device unregistered" };
    },
    {
      detail: { tags: ["Notifications"], summary: "Unregister a push device", security },
      body: t.Object({ token: t.String({ minLength: 1 }) }),
      response: {
        200: MessageSchema,
        ...AuthResponses,
      },
    }
  );
