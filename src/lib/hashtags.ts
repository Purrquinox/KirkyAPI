import { prisma } from "./prisma";

export function extractHashtags(content: string): string[] {
  const matches = content.match(/#([a-zA-Z0-9_]+)/g) ?? [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

export async function syncPostHashtags(postId: string, content: string) {
  const tags = extractHashtags(content);

  await prisma.postHashtag.deleteMany({ where: { postId } });

  if (!tags.length) return;

  await Promise.all(
    tags.map(async tag => {
      const hashtag = await prisma.hashtag.upsert({
        where: { tag },
        update: {},
        create: { tag },
      });
      await prisma.postHashtag.create({ data: { postId, hashtagId: hashtag.id } });
    })
  );
}
