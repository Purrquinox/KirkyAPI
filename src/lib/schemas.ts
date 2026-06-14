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

const postBaseProps = {
  id: t.String(),
  title: t.Nullable(t.String()),
  content: t.String(),
  imageUrl: t.Nullable(t.String()),
  publishedAt: t.Nullable(t.Date()),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  author: t.Object(authorProps),
};

export const PostSchema = t.Object(postBaseProps);

export const PostWithPublishedSchema = t.Object({
  ...postBaseProps,
  published: t.Boolean(),
});

const commentBaseProps = {
  id: t.String(),
  content: t.String(),
  imageUrl: t.Nullable(t.String()),
  parentId: t.Nullable(t.String()),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  author: t.Object(authorProps),
};

export const CommentSchema = t.Object(commentBaseProps);

export const CommentWithRepliesSchema = t.Object({
  ...commentBaseProps,
  replies: t.Array(t.Object(commentBaseProps)),
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
  createdAt: t.Date(),
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
  createdAt: t.Date(),
  updatedAt: t.Date(),
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
  updatedAt: t.Date(),
});

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
