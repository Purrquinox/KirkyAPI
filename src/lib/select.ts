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
} as const;

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
} as const;

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
} as const;

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
} as const;

export const postSelect = {
  id: true,
  title: true,
  content: true,
  imageUrl: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: postAuthorSelect },
} as const;

export const commentSelect = {
  id: true,
  content: true,
  imageUrl: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: postAuthorSelect },
} as const;
