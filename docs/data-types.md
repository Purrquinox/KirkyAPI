# Data Types

This page documents all shared object shapes returned across Kirky API endpoints.

---

## IDs and Timestamps

All record IDs are [CUIDs](https://github.com/paralleldrive/cuid2) — collision-resistant identifiers that look like `clx1a2b3c`. They are strings, not integers.

All timestamps are returned as **ISO 8601 strings in UTC**, e.g. `"2026-06-14T10:00:00.000Z"`. Parse them with your language's standard date library.

### Nullable vs. Optional

- **Nullable** (`string | null`) — the field is always present in the response but its value may be `null`.
- **Optional** — the field may be absent from the response entirely. This is noted explicitly where it applies (e.g. `published` on Post).

---

## Post

A published post. The `published` field is only present on endpoints that return drafts (`POST /posts` and `GET /posts/mine`).

| Field           | Type              | Description                                          |
|-----------------|-------------------|------------------------------------------------------|
| `id`            | string            | CUID identifier                                      |
| `title`         | string \| null    | Optional short title (max 300 chars)                 |
| `content`       | string            | Post body text                                       |
| `imageUrl`      | string \| null    | Attached image URL — Kirky CDN (`https://bytepurr.purrquinox.com/<key>`) or any valid URL; max 2048 chars |
| `published`     | boolean           | Present only on draft-aware endpoints                |
| `publishedAt`   | ISO 8601 \| null  | When the post was published; null for drafts         |
| `createdAt`     | ISO 8601          | When the record was created                          |
| `updatedAt`     | ISO 8601          | When the record was last modified                    |
| `author`        | [Author](#author) | Abbreviated profile of the post's author             |
| `quoteOf`       | [QuotePost](#quotepost) \| null | The post being quoted, if any         |
| `likesCount`    | number            | Total likes                                          |
| `repostsCount`  | number            | Total reposts                                        |
| `commentsCount` | number            | Total top-level comments                             |
| `isLiked`       | boolean           | Whether the authenticated user has liked this post   |
| `isReposted`    | boolean           | Whether the authenticated user has reposted this post|
| `isBookmarked`  | boolean           | Whether the authenticated user has bookmarked this post |
| `hashtags`      | string[]          | Hashtag strings parsed from content (without `#`)   |

### Example

```json
{
  "id": "clx1a2b3c",
  "title": null,
  "content": "Shipping a new feature today. #buildinpublic #indiedev",
  "imageUrl": "https://bytepurr.purrquinox.com/kirky/abc123/screenshot.png",
  "publishedAt": "2026-06-14T10:00:00.000Z",
  "createdAt": "2026-06-14T09:55:00.000Z",
  "updatedAt": "2026-06-14T09:55:00.000Z",
  "author": {
    "profile": {
      "username": "elias",
      "firstName": "Elias",
      "lastName": "Mercer",
      "avatar": "https://bytepurr.purrquinox.com/kirky/avatar99/elias.jpg",
      "verified": true
    }
  },
  "quoteOf": null,
  "likesCount": 42,
  "repostsCount": 7,
  "commentsCount": 3,
  "isLiked": false,
  "isReposted": false,
  "isBookmarked": true,
  "hashtags": ["buildinpublic", "indiedev"]
}
```

---

## FeedItem

Extends [Post](#post) with repost context. Used only in `GET /feed`.

| Field        | Type                          | Description                                           |
|--------------|-------------------------------|-------------------------------------------------------|
| *(all Post fields)* | —                      | Inherits every field from Post                       |
| `type`       | `"post"` \| `"repost"`        | Whether this entry is an original post or a repost    |
| `repostedBy` | [ProfileSummary](#profilesummary) \| null | Who reposted it; null when `type` is `"post"` |
| `repostedAt` | ISO 8601 \| null              | When it was reposted; null when `type` is `"post"`    |

When `type` is `"repost"`, the feed item represents the **original post** with `repostedBy` and `repostedAt` indicating the repost context. The post's own `publishedAt` is the original publication date.

---

## Comment

| Field        | Type              | Description                                        |
|--------------|-------------------|----------------------------------------------------|
| `id`         | string            | CUID identifier                                    |
| `content`    | string            | Comment body (max 5000 chars)                      |
| `imageUrl`   | string \| null    | Attached image URL — Kirky CDN or any valid URL; set at creation time, not editable afterward |
| `parentId`   | string \| null    | ID of parent comment; null for top-level comments  |
| `createdAt`  | ISO 8601          |                                                    |
| `updatedAt`  | ISO 8601          |                                                    |
| `author`     | [Author](#author) | Abbreviated profile                                |
| `likesCount` | number            | Total likes on this comment                        |
| `isLiked`    | boolean           | Whether the authenticated user has liked it        |

Comments returned from `GET /posts/:id/comments` include a `replies` array of the same shape. Replies do not nest further — the threading model is exactly one level deep.

### Example

```json
{
  "id": "clxcomment1",
  "content": "This is amazing, congrats on the launch!",
  "imageUrl": null,
  "parentId": null,
  "createdAt": "2026-06-14T10:05:00.000Z",
  "updatedAt": "2026-06-14T10:05:00.000Z",
  "author": {
    "profile": {
      "username": "janedoe",
      "firstName": "Jane",
      "lastName": "Doe",
      "avatar": null,
      "verified": false
    }
  },
  "likesCount": 2,
  "isLiked": false,
  "replies": [
    {
      "id": "clxreply1",
      "content": "Thank you so much!",
      "imageUrl": null,
      "parentId": "clxcomment1",
      "createdAt": "2026-06-14T10:10:00.000Z",
      "updatedAt": "2026-06-14T10:10:00.000Z",
      "author": {
        "profile": {
          "username": "elias",
          "firstName": "Elias",
          "lastName": "Mercer",
          "avatar": "https://cdn.kirky.app/avatars/elias.jpg",
          "verified": true
        }
      },
      "likesCount": 0,
      "isLiked": false
    }
  ]
}
```

---

## Author

Abbreviated profile attached to posts and comments. `profile` is null only if the user account was deleted after the content was created.

| Field                 | Type           | Description                         |
|-----------------------|----------------|-------------------------------------|
| `profile`             | object \| null | null if the account has been deleted |
| `profile.username`    | string         | Handle                              |
| `profile.firstName`   | string \| null | Display first name                  |
| `profile.lastName`    | string \| null | Display last name                   |
| `profile.avatar`      | string \| null | Avatar image URL (`https://bytepurr.purrquinox.com/<key>`) |
| `profile.verified`    | boolean        | Blue-check verification status      |

---

## QuotePost

Abbreviated post shape embedded inside posts that quote another post.

| Field         | Type              | Description                              |
|---------------|-------------------|------------------------------------------|
| `id`          | string            |                                          |
| `title`       | string \| null    |                                          |
| `content`     | string            |                                          |
| `imageUrl`    | string \| null    |                                          |
| `publishedAt` | ISO 8601 \| null  |                                          |
| `createdAt`   | ISO 8601          |                                          |
| `author`      | [Author](#author) |                                          |

If the quoted post is deleted after the quote is created, `quoteOf` becomes `null` on the quoting post.

---

## PublicProfile

Full public-facing profile, including social graph context relative to the authenticated viewer.

| Field            | Type                       | Description                                          |
|------------------|----------------------------|------------------------------------------------------|
| `username`       | string                     | Unique handle                                        |
| `firstName`      | string \| null             |                                                      |
| `lastName`       | string \| null             |                                                      |
| `avatar`         | string \| null             | Avatar image URL — Kirky CDN or any valid URL        |
| `bio`            | string \| null             | Profile bio (max 500 chars)                          |
| `website`        | string \| null             |                                                      |
| `location`       | string \| null             |                                                      |
| `bannerImage`    | string \| null             | Profile banner image URL — Kirky CDN or any valid URL |
| `verified`       | boolean                    | Blue-check verification status                       |
| `emailPublic`    | boolean                    | Whether this user has chosen to make their email public |
| `email`          | string \| null             | The user's email — only populated when `emailPublic` is `true`; otherwise `null` |
| `createdAt`      | ISO 8601                   | Account creation date                                |
| `followersCount` | number                     |                                                      |
| `followingCount` | number                     |                                                      |
| `isFollowing`    | boolean                    | Whether the authenticated user follows this profile  |
| `isBlocked`      | boolean                    | Whether the authenticated user has blocked this user |
| `pinnedPost`     | [Post](#post) \| null      | Post pinned to this profile                          |

> `isFollowing` and `isBlocked` reflect the **viewer's** relationship to the profile, not the other way around.

> Emails are **private by default**. `email` is only returned when the profile owner has opted in by setting `emailPublic` to `true` (via `PATCH /users/me`). When `emailPublic` is `false`, `email` is always `null`, even for accounts that have an email on file.

---

## PrivateUser

Full account object returned only from `GET /users/me`. Contains fields not visible on public profiles.

| Field           | Type                                              | Description                           |
|-----------------|---------------------------------------------------|---------------------------------------|
| `id`            | string                                            | Internal user ID                      |
| `email`         | string \| null                                    | Null for OAuth-only accounts          |
| `isActive`      | boolean                                           | False if the account is deactivated   |
| `emailVerified` | ISO 8601 \| null                                  | Null until email is verified          |
| `lastLoginAt`   | ISO 8601 \| null                                  | Null if never logged in after initial signup |
| `createdAt`     | ISO 8601                                          |                                       |
| `updatedAt`     | ISO 8601                                          |                                       |
| `profile`       | [PrivateProfile](#privateprofile) \| null         | Null if the profile has not been set up yet |

### Example

```json
{
  "user": {
    "id": "clx1a2b3c",
    "email": "jane@example.com",
    "isActive": true,
    "emailVerified": "2026-01-01T00:00:00.000Z",
    "lastLoginAt": "2026-06-14T08:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-06-14T08:00:00.000Z",
    "profile": {
      "id": "clx9z8y7w",
      "userId": "clx1a2b3c",
      "username": "janedoe",
      "firstName": "Jane",
      "lastName": "Doe",
      "avatar": null,
      "bio": "Building cool things.",
      "website": "https://janedoe.dev",
      "location": "San Francisco, CA",
      "bannerImage": null,
      "verified": false,
      "emailPublic": false,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-06-14T08:00:00.000Z",
      "followersCount": 120,
      "followingCount": 85
    }
  }
}
```

---

## PrivateProfile

Full profile returned only for the authenticated user (nested inside [PrivateUser](#privateuser)).

| Field            | Type           | Description                         |
|------------------|----------------|-------------------------------------|
| `id`             | string         | Profile CUID                        |
| `userId`         | string         | Parent user ID                      |
| `username`       | string         |                                     |
| `firstName`      | string \| null |                                     |
| `lastName`       | string \| null |                                     |
| `avatar`         | string \| null |                                     |
| `bio`            | string \| null |                                     |
| `website`        | string \| null |                                     |
| `location`       | string \| null |                                     |
| `bannerImage`    | string \| null |                                     |
| `verified`       | boolean        |                                     |
| `emailPublic`    | boolean        | Whether the account's email is shown on its public profile |
| `createdAt`      | ISO 8601       |                                     |
| `updatedAt`      | ISO 8601       |                                     |
| `followersCount` | number         |                                     |
| `followingCount` | number         |                                     |

---

## ProfileSummary

Minimal profile shape used in follower/following lists, blocked user lists, and repost attribution in the feed.

| Field       | Type           |
|-------------|----------------|
| `username`  | string         |
| `firstName` | string \| null |
| `lastName`  | string \| null |
| `avatar`    | string \| null |
| `verified`  | boolean        |

---

## Notification

| Field              | Type                                      | Description                                        |
|--------------------|-------------------------------------------|----------------------------------------------------|
| `id`               | string                                    | CUID identifier                                    |
| `type`             | [NotificationType](#notificationtype)     | What triggered the notification                    |
| `read`             | boolean                                   | Whether the user has marked it as read             |
| `createdAt`        | ISO 8601                                  |                                                    |
| `actor`            | object                                    | The user whose action triggered the notification   |
| `actor.profile`    | [ProfileSummary](#profilesummary) \| null | Null if the actor's account was deleted            |
| `post`             | object \| null                            | Snippet of the related post, if applicable         |
| `post.id`          | string                                    |                                                    |
| `post.content`     | string                                    |                                                    |
| `post.title`       | string \| null                            |                                                    |
| `comment`          | object \| null                            | Snippet of the related comment, if applicable      |
| `comment.id`       | string                                    |                                                    |
| `comment.content`  | string                                    |                                                    |

### Which types include `post` and `comment`?

| Type           | `post`    | `comment` |
|----------------|-----------|-----------|
| `FOLLOW`       | null      | null      |
| `LIKE_POST`    | present   | null      |
| `LIKE_COMMENT` | null      | present   |
| `COMMENT`      | present   | present   |
| `REPOST`       | present   | null      |
| `QUOTE`        | present   | null      |
| `MENTION`      | present   | present (if in a comment) |

### Example

```json
{
  "id": "clxnotif1",
  "type": "COMMENT",
  "read": false,
  "createdAt": "2026-06-14T11:00:00.000Z",
  "actor": {
    "profile": {
      "username": "janedoe",
      "firstName": "Jane",
      "lastName": "Doe",
      "avatar": null,
      "verified": false
    }
  },
  "post": {
    "id": "clxpost1",
    "content": "Shipping a new feature today.",
    "title": null
  },
  "comment": {
    "id": "clxcomment1",
    "content": "This is amazing, congrats!"
  }
}
```

---

## NotificationType

| Value          | Trigger                                         |
|----------------|-------------------------------------------------|
| `FOLLOW`       | Someone followed you                            |
| `LIKE_POST`    | Someone liked your post                         |
| `LIKE_COMMENT` | Someone liked your comment                      |
| `COMMENT`      | Someone commented on your post                  |
| `REPOST`       | Someone reposted your post                      |
| `QUOTE`        | Someone quoted your post                        |
| `MENTION`      | Someone mentioned `@you` in a post or comment   |

---

## Hashtag

| Field        | Type   | Description                              |
|--------------|--------|------------------------------------------|
| `tag`        | string | Hashtag string without the `#` prefix    |
| `postsCount` | number | Number of published posts with this tag  |
