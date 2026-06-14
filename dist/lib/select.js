// Strict field whitelists — never expose sensitive auth data through Prisma selects
export const publicProfileSelect = {
    username: true,
    firstName: true,
    lastName: true,
    avatar: true,
    bio: true,
    website: true,
    location: true,
    bannerImage: true,
    verified: true,
    createdAt: true,
};
export const privateProfileSelect = {
    id: true,
    userId: true,
    username: true,
    firstName: true,
    lastName: true,
    avatar: true,
    bio: true,
    website: true,
    location: true,
    bannerImage: true,
    verified: true,
    createdAt: true,
    updatedAt: true,
};
// Self-only: includes email and account metadata, never password or OAuth IDs
export const privateUserSelect = {
    id: true,
    email: true,
    isActive: true,
    emailVerified: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    profile: { select: privateProfileSelect },
};
export const profileSummarySelect = {
    username: true,
    firstName: true,
    lastName: true,
    avatar: true,
    verified: true,
};
export const postAuthorSelect = {
    profile: {
        select: {
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            verified: true,
        },
    },
};
// The quoted post shape — one level deep, no recursive quoting
const quotePostSelect = {
    id: true,
    title: true,
    content: true,
    imageUrl: true,
    publishedAt: true,
    createdAt: true,
    author: { select: postAuthorSelect },
};
export function buildPostSelect(viewerUserId) {
    return {
        id: true,
        title: true,
        content: true,
        imageUrl: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        author: { select: postAuthorSelect },
        quoteOf: { select: quotePostSelect },
        _count: { select: { postLikes: true, reposts: true, comments: true } },
        postLikes: { where: { userId: viewerUserId }, select: { userId: true }, take: 1 },
        reposts: { where: { userId: viewerUserId }, select: { userId: true }, take: 1 },
        bookmarks: { where: { userId: viewerUserId }, select: { userId: true }, take: 1 },
        hashtags: { select: { hashtag: { select: { tag: true } } } },
    };
}
export function buildCommentSelect(viewerUserId) {
    return {
        id: true,
        content: true,
        imageUrl: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: postAuthorSelect },
        _count: { select: { commentLikes: true } },
        commentLikes: { where: { userId: viewerUserId }, select: { userId: true }, take: 1 },
    };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformPost(raw) {
    const { _count, postLikes, reposts, bookmarks, hashtags, ...rest } = raw;
    return {
        ...rest,
        likesCount: _count.postLikes,
        repostsCount: _count.reposts,
        commentsCount: _count.comments,
        isLiked: postLikes.length > 0,
        isReposted: reposts.length > 0,
        isBookmarked: bookmarks.length > 0,
        hashtags: hashtags.map((h) => h.hashtag.tag),
    };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformComment(raw) {
    const { _count, commentLikes, ...rest } = raw;
    return {
        ...rest,
        likesCount: _count.commentLikes,
        isLiked: commentLikes.length > 0,
    };
}
