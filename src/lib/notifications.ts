import { NotificationType } from "../generated/prisma";
import { prisma } from "./prisma";

export async function notify(params: {
  userId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
}) {
  if (params.userId === params.actorId) return;
  await prisma.notification.create({
    data: {
      userId: params.userId,
      actorId: params.actorId,
      type: params.type,
      postId: params.postId,
      commentId: params.commentId,
    },
  });
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
