import { t } from "elysia";

export const ErrorSchema = t.Object({ error: t.String() });

export const MessageSchema = t.Object({ message: t.String() });

const authorProps = {
  profile: t.Nullable(
    t.Object({
      username: t.String(),
      firstName: t.Nullable(t.String()),
      lastName: t.Nullable(t.String()),
      avatar: t.Nullable(t.String()),
      verified: t.Boolean(),
    })
  ),
};

const quotePostProps = {
  id: t.String(),
  title: t.Nullable(t.String()),
  content: t.String(),
  imageUrl: t.Nullable(t.String()),
  publishedAt: t.Nullable(t.Date()),
  createdAt: t.Date(),
  author: t.Object(authorProps),
};

const postBaseProps = {
  id: t.String(),
  title: t.Nullable(t.String()),
  content: t.String(),
  imageUrl: t.Nullable(t.String()),
  publishedAt: t.Nullable(t.Date()),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  author: t.Object(authorProps),
  quoteOf: t.Nullable(t.Object(quotePostProps)),
  likesCount: t.Number(),
  repostsCount: t.Number(),
  commentsCount: t.Number(),
  isLiked: t.Boolean(),
  isReposted: t.Boolean(),
  isBookmarked: t.Boolean(),
  hashtags: t.Array(t.String()),
};

export const PostSchema = t.Object(postBaseProps);

export const PostWithPublishedSchema = t.Object({
  ...postBaseProps,
  published: t.Boolean(),
});

// Feed item: always a post shape, with optional repost context
export const FeedItemSchema = t.Object({
  ...postBaseProps,
  type: t.Union([t.Literal("post"), t.Literal("repost")]),
  repostedBy: t.Nullable(
    t.Object({
      username: t.String(),
      firstName: t.Nullable(t.String()),
      lastName: t.Nullable(t.String()),
      avatar: t.Nullable(t.String()),
      verified: t.Boolean(),
    })
  ),
  repostedAt: t.Nullable(t.Date()),
});

const commentBaseProps = {
  id: t.String(),
  content: t.String(),
  imageUrl: t.Nullable(t.String()),
  parentId: t.Nullable(t.String()),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  author: t.Object(authorProps),
  likesCount: t.Number(),
  isLiked: t.Boolean(),
};

export const CommentSchema = t.Object(commentBaseProps);

export const CommentWithRepliesSchema = t.Object({
  ...commentBaseProps,
  replies: t.Array(t.Object(commentBaseProps)),
});

export const ProfileSummarySchema = t.Object({
  username: t.String(),
  firstName: t.Nullable(t.String()),
  lastName: t.Nullable(t.String()),
  avatar: t.Nullable(t.String()),
  verified: t.Boolean(),
});

export const PublicProfileSchema = t.Object({
  username: t.String(),
  firstName: t.Nullable(t.String()),
  lastName: t.Nullable(t.String()),
  avatar: t.Nullable(t.String()),
  bio: t.Nullable(t.String()),
  website: t.Nullable(t.String()),
  location: t.Nullable(t.String()),
  bannerImage: t.Nullable(t.String()),
  verified: t.Boolean(),
  emailPublic: t.Boolean(),
  email: t.Nullable(t.String()),
  createdAt: t.Date(),
  followersCount: t.Number(),
  followingCount: t.Number(),
  isFollowing: t.Boolean(),
  isBlocked: t.Boolean(),
  pinnedPost: t.Nullable(PostSchema),
});

const privateProfileProps = {
  id: t.String(),
  userId: t.String(),
  username: t.String(),
  firstName: t.Nullable(t.String()),
  lastName: t.Nullable(t.String()),
  avatar: t.Nullable(t.String()),
  bio: t.Nullable(t.String()),
  website: t.Nullable(t.String()),
  location: t.Nullable(t.String()),
  bannerImage: t.Nullable(t.String()),
  verified: t.Boolean(),
  emailPublic: t.Boolean(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  followersCount: t.Number(),
  followingCount: t.Number(),
};

export const PrivateProfileSchema = t.Object(privateProfileProps);

export const PrivateUserSchema = t.Object({
  id: t.String(),
  email: t.Nullable(t.String()),
  isActive: t.Boolean(),
  emailVerified: t.Nullable(t.Date()),
  lastLoginAt: t.Nullable(t.Date()),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  profile: t.Nullable(t.Object(privateProfileProps)),
});

export const UpdatedProfileSchema = t.Object({
  username: t.String(),
  firstName: t.Nullable(t.String()),
  lastName: t.Nullable(t.String()),
  bio: t.Nullable(t.String()),
  website: t.Nullable(t.String()),
  location: t.Nullable(t.String()),
  bannerImage: t.Nullable(t.String()),
  avatar: t.Nullable(t.String()),
  verified: t.Boolean(),
  emailPublic: t.Boolean(),
  updatedAt: t.Date(),
  followersCount: t.Number(),
  followingCount: t.Number(),
});

export const NotificationSchema = t.Object({
  id: t.String(),
  type: t.String(),
  read: t.Boolean(),
  createdAt: t.Date(),
  actor: t.Object({
    profile: t.Nullable(
      t.Object({
        username: t.String(),
        firstName: t.Nullable(t.String()),
        lastName: t.Nullable(t.String()),
        avatar: t.Nullable(t.String()),
        verified: t.Boolean(),
      })
    ),
  }),
  post: t.Nullable(t.Object({ id: t.String(), content: t.String(), title: t.Nullable(t.String()) })),
  comment: t.Nullable(t.Object({ id: t.String(), content: t.String() })),
});

export const HashtagSchema = t.Object({
  tag: t.String(),
  postsCount: t.Number(),
});

export const EventSchema = t.Object({
  id: t.String(),
  title: t.String(),
  description: t.Nullable(t.String()),
  imageUrl: t.Nullable(t.String()),
  featured: t.Boolean(),
  hashtag: t.Nullable(t.Object({ tag: t.String() })),
  startsAt: t.Date(),
  endsAt: t.Nullable(t.Date()),
  createdAt: t.Date(),
});

export const ImageUploadResponseSchema = t.Object({ url: t.String() });

// Common response sets
export const AuthResponses = {
  401: ErrorSchema,
  503: ErrorSchema,
};

export const AuthNotFoundResponses = {
  401: ErrorSchema,
  404: ErrorSchema,
  503: ErrorSchema,
};

export const AuthForbiddenNotFoundResponses = {
  401: ErrorSchema,
  403: ErrorSchema,
  404: ErrorSchema,
  503: ErrorSchema,
};
