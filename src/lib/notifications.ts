import { NotificationType } from "../generated/prisma";
import { prisma } from "./prisma";
import { sendToUser } from "./sse";
import { dispatchPush } from "./push";

export async function notify(params: {
  userId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
}) {
  if (params.userId === params.actorId) return;

  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      actorId: params.actorId,
      type: params.type,
      postId: params.postId,
      commentId: params.commentId,
    },
    select: {
      id: true,
      type: true,
      createdAt: true,
      actor: { select: { profile: { select: { username: true } } } },
    },
  });

  const username = notification.actor.profile?.username ?? "Someone";
  const { title, body } = notificationText(params.type, username);

  sendToUser(params.userId, "notification", {
    id: notification.id,
    type: notification.type,
    createdAt: notification.createdAt,
    actor: username,
  });

  dispatchPush(params.userId, title, body).catch(console.error);
}

function notificationText(type: NotificationType, actor: string): { title: string; body: string } {
  switch (type) {
    case NotificationType.FOLLOW:       return { title: "New follower",      body: `@${actor} followed you` };
    case NotificationType.LIKE_POST:    return { title: "Post liked",         body: `@${actor} liked your post` };
    case NotificationType.LIKE_COMMENT: return { title: "Comment liked",      body: `@${actor} liked your comment` };
    case NotificationType.COMMENT:      return { title: "New comment",        body: `@${actor} commented on your post` };
    case NotificationType.REPOST:       return { title: "Post reposted",      body: `@${actor} reposted your post` };
    case NotificationType.QUOTE:        return { title: "Post quoted",        body: `@${actor} quoted your post` };
    case NotificationType.MENTION:      return { title: "You were mentioned", body: `@${actor} mentioned you` };
  }
}

export function extractMentions(content: string): string[] {
  const matches = content.match(/@([a-zA-Z0-9_-]{3,20})/g) ?? [];
  return [...new Set(matches.map(m => m.slice(1)))];
}

export async function notifyMentions(
  content: string,
  actorId: string,
  postId?: string,
  commentId?: string,
) {
  const usernames = extractMentions(content);
  if (!usernames.length) return;

  const profiles = await prisma.profile.findMany({
    where: { username: { in: usernames } },
    select: { userId: true },
  });

  await Promise.all(
    profiles.map(p =>
      notify({ userId: p.userId, actorId, type: NotificationType.MENTION, postId, commentId })
    )
  );
}
