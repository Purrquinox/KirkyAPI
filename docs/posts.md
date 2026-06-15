# Posts

The Posts API covers creating, reading, updating, and deleting posts, as well as social interactions — likes, reposts, and bookmarks. Posts can be published immediately or saved as drafts.

**Base path:** `/posts`

---

## Endpoints

| Method   | Path                   | Description                               |
|----------|------------------------|-------------------------------------------|
| `GET`    | `/posts`               | List all published posts                  |
| `GET`    | `/posts/mine`          | List own posts, including drafts          |
| `GET`    | `/posts/bookmarks`     | List own bookmarked posts                 |
| `GET`    | `/posts/:id`           | Get a single published post               |
| `POST`   | `/posts`               | Create a post                             |
| `PATCH`  | `/posts/:id`           | Update own post                           |
| `DELETE` | `/posts/:id`           | Delete own post                           |
| `POST`   | `/posts/:id/like`      | Like a post                               |
| `DELETE` | `/posts/:id/like`      | Unlike a post                             |
| `POST`   | `/posts/:id/repost`    | Repost a post                             |
| `DELETE` | `/posts/:id/repost`    | Remove a repost                           |
| `POST`   | `/posts/:id/bookmark`  | Bookmark a post                           |
| `DELETE` | `/posts/:id/bookmark`  | Remove a bookmark                         |

---

## Hashtag Parsing

Hashtags are extracted automatically from post `content` whenever a post is created or updated. You do not submit them separately.

**Parsing rules:**
- A hashtag is `#` followed by one or more letters, digits, or underscores: `#[a-zA-Z0-9_]+`
- Tags are stored and returned **lowercase** — `#BuildInPublic` is stored as `buildinpublic`
- A post can contain any number of hashtags
- Duplicate tags within a single post are deduplicated
- The `hashtags` field on a post returns the parsed tags as a plain string array, without the `#` prefix

**Example:** content `"Day 1 of #BuildInPublic — launched #Kirky today! #kirky"` produces `hashtags: ["buildinpublic", "kirky"]`.

---

## Drafts

A draft is a post with `published: false`. Drafts are:
- Only visible to their author via `GET /posts/mine`
- Excluded from all other listing and discovery endpoints
- Not included in feeds or search results
- Not counted in a user's public post count

To publish a draft, send `PATCH /posts/:id` with `{ "published": true }`. The `publishedAt` timestamp is set to the moment of publication, regardless of when the draft was created.

---

## Reposts vs. Quote Posts

| Feature          | Repost (`POST /posts/:id/repost`)       | Quote Post (`POST /posts` with `quoteOfId`) |
|------------------|-----------------------------------------|---------------------------------------------|
| Adds content     | No — shares as-is                       | Yes — your `content` wraps the quoted post  |
| Creates a post   | No — creates a Repost record            | Yes — creates a new Post record             |
| Notification     | `REPOST` to original author             | `QUOTE` to original author                  |
| Appears in feed  | As a FeedItem with `type: "repost"`     | As a FeedItem with `type: "post"`           |
| Can quote own post | No — `400 Cannot repost your own post` | Yes                                       |
| Deletable as     | `DELETE /posts/:id/repost`              | `DELETE /posts/:id`                         |

---

## List Published Posts

**`GET /posts`**

Returns all published posts across the platform, sorted by `publishedAt` descending.

### Query Parameters

| Parameter | Type    | Default | Maximum |
|-----------|---------|---------|---------|
| `limit`   | integer | `20`    | `100`   |
| `offset`  | integer | `0`     | —       |

### Response `200`

| Field   | Type                         |
|---------|------------------------------|
| `posts` | [Post](data-types.md#post)[] |
| `total` | number                       |

### Example

```bash
curl "https://api.kirky.app/posts?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## List Own Posts

**`GET /posts/mine`**

Returns all posts belonging to the authenticated user — published and drafts — sorted by `createdAt` descending. Each post includes `published: boolean`.

### Query Parameters

| Parameter | Type    | Default | Maximum |
|-----------|---------|---------|---------|
| `limit`   | integer | `20`    | `100`   |
| `offset`  | integer | `0`     | —       |

### Response `200`

| Field   | Type                                                       |
|---------|------------------------------------------------------------|
| `posts` | [Post](data-types.md#post)[] with `published: boolean`     |
| `total` | number                                                     |

### Example

```bash
curl "https://api.kirky.app/posts/mine" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## List Bookmarked Posts

**`GET /posts/bookmarks`**

Returns posts bookmarked by the authenticated user, in reverse bookmark order (most recently bookmarked first).

### Query Parameters

| Parameter | Type    | Default | Maximum |
|-----------|---------|---------|---------|
| `limit`   | integer | `20`    | `100`   |
| `offset`  | integer | `0`     | —       |

### Response `200`

| Field   | Type                         |
|---------|------------------------------|
| `posts` | [Post](data-types.md#post)[] |
| `total` | number                       |

### Example

```bash
curl "https://api.kirky.app/posts/bookmarks" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Get a Post

**`GET /posts/:id`**

Returns a single published post by ID. Returns `404` for drafts, even if you are the author — use `GET /posts/mine` to access your own drafts.

### Path Parameters

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `id`      | string | Post CUID   |

### Response `200`

| Field  | Type                       |
|--------|----------------------------|
| `post` | [Post](data-types.md#post) |

```json
{
  "post": {
    "id": "clx1a2b3c",
    "title": null,
    "content": "Shipping a new feature today. #buildinpublic",
    "imageUrl": null,
    "publishedAt": "2026-06-14T10:00:00.000Z",
    "createdAt": "2026-06-14T09:55:00.000Z",
    "updatedAt": "2026-06-14T09:55:00.000Z",
    "author": {
      "profile": {
        "username": "elias",
        "firstName": "Elias",
        "lastName": "Mercer",
        "avatar": "https://cdn.kirky.app/avatars/elias.jpg",
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
    "hashtags": ["buildinpublic"]
  }
}
```

### Example

```bash
curl "https://api.kirky.app/posts/clx1a2b3c" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `404`  | Post not found           |
| `503`  | Auth service unreachable |

---

## Create a Post

**`POST /posts`**

Creates a new post. Hashtags are parsed from `content` automatically. Mentioning `@username` in content triggers a `MENTION` notification. Omit `published` or set it to `false` to save as a draft.

To quote an existing post, set `quoteOfId` to the ID of a published post. This sends a `QUOTE` notification to that post's author.

### Request Body

| Field       | Type    | Required | Constraints              | Description                          |
|-------------|---------|----------|--------------------------|--------------------------------------|
| `content`   | string  | Yes      | Min 1 char               | Post body text                       |
| `title`     | string  | No       | Max 300 chars            | Optional short title                 |
| `imageUrl`  | string  | No       | Max 2048 chars           | Image URL to attach                  |
| `imageFile` | file    | No       | Max 10 MB                | Upload image directly; takes precedence over `imageUrl` |
| `published` | boolean | No       | Default `true`           | Set `false` to save as draft         |
| `quoteOfId` | string  | No       | Must be a published post | ID of post to quote                  |

### Response `201`

| Field  | Type                                                   |
|--------|--------------------------------------------------------|
| `post` | [Post](data-types.md#post) with `published: boolean`   |

```json
{
  "post": {
    "id": "clxnewpost",
    "title": null,
    "content": "Hello, Kirky! #firstpost",
    "imageUrl": null,
    "published": true,
    "publishedAt": "2026-06-14T12:00:00.000Z",
    "createdAt": "2026-06-14T12:00:00.000Z",
    "updatedAt": "2026-06-14T12:00:00.000Z",
    "author": { "profile": { "username": "janedoe", ... } },
    "quoteOf": null,
    "likesCount": 0,
    "repostsCount": 0,
    "commentsCount": 0,
    "isLiked": false,
    "isReposted": false,
    "isBookmarked": false,
    "hashtags": ["firstpost"]
  }
}
```

### Examples

**Publish immediately (JSON):**

```bash
curl -X POST "https://api.kirky.app/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, Kirky! #firstpost"}'
```

**Publish with an image attached (multipart):**

```bash
curl -X POST "https://api.kirky.app/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -F "content=Check out this photo! #buildinpublic" \
  -F "imageFile=@screenshot.png"
```

**Save as draft:**

```bash
curl -X POST "https://api.kirky.app/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Work in progress...", "published": false}'
```

**Quote a post:**

```bash
curl -X POST "https://api.kirky.app/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "This is exactly right.", "quoteOfId": "clx1a2b3c"}'
```

### Errors

| Status | Description                             |
|--------|-----------------------------------------|
| `401`  | Missing or invalid token                |
| `404`  | `quoteOfId` not found or not published  |
| `502`  | CDN rejected the image upload           |
| `503`  | Auth service unreachable                |

---

## Update a Post

**`PATCH /posts/:id`**

Updates a post you own. All fields are optional — only supplied fields are changed. Hashtags are re-synced from the new `content`. Setting `published: true` on a draft publishes it and sets `publishedAt` to now.

### Path Parameters

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `id`      | string | Post CUID   |

### Request Body

| Field       | Type           | Constraints   | Description                                    |
|-------------|----------------|---------------|------------------------------------------------|
| `content`   | string         | Min 1 char     | Updated body text                              |
| `title`     | string \| null | Max 300 chars  | Updated title; pass `null` to clear            |
| `imageUrl`  | string \| null | Max 2048 chars | Updated image URL; pass `null` to clear        |
| `imageFile` | file           | Max 10 MB      | Upload image directly; takes precedence over `imageUrl` |
| `published` | boolean        | —              | Set `true` to publish a draft                  |

### Response `200`

| Field  | Type                                                   |
|--------|--------------------------------------------------------|
| `post` | [Post](data-types.md#post) with `published: boolean`   |

### Examples

**Edit content (JSON):**

```bash
curl -X PATCH "https://api.kirky.app/posts/clxdraftid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated content here."}'
```

**Attach an image (multipart):**

```bash
curl -X PATCH "https://api.kirky.app/posts/clxdraftid" \
  -H "Authorization: Bearer $TOKEN" \
  -F "imageFile=@photo.jpg"
```

**Clear the attached image:**

```bash
curl -X PATCH "https://api.kirky.app/posts/clxdraftid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": null}'
```

**Publish a draft:**

```bash
curl -X PATCH "https://api.kirky.app/posts/clxdraftid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"published": true}'
```

### Errors

| Status | Description                      |
|--------|----------------------------------|
| `401`  | Missing or invalid token         |
| `403`  | You do not own this post         |
| `404`  | Post not found                   |
| `502`  | CDN rejected the image upload    |
| `503`  | Auth service unreachable         |

---

## Delete a Post

**`DELETE /posts/:id`**

Permanently deletes a post you own. All associated comments, likes, reposts, and bookmarks are removed in cascade.

### Response `200`

```json
{ "message": "Post deleted" }
```

### Example

```bash
curl -X DELETE "https://api.kirky.app/posts/clx1a2b3c" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                 |
|--------|-----------------------------|
| `401`  | Missing or invalid token    |
| `403`  | You do not own this post    |
| `404`  | Post not found              |
| `503`  | Auth service unreachable    |

---

## Like a Post

**`POST /posts/:id/like`**

Likes a published post. Sends a `LIKE_POST` notification to the author (not sent when liking your own post).

### Response `201`

```json
{ "message": "Post liked" }
```

### Example

```bash
curl -X POST "https://api.kirky.app/posts/clx1a2b3c/like" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `404`  | Post not found           |
| `409`  | Already liked            |
| `503`  | Auth service unreachable |

---

## Unlike a Post

**`DELETE /posts/:id/like`**

Removes a like from a post.

### Response `200`

```json
{ "message": "Post unliked" }
```

### Example

```bash
curl -X DELETE "https://api.kirky.app/posts/clx1a2b3c/like" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                    |
|--------|--------------------------------|
| `401`  | Missing or invalid token       |
| `404`  | Post not found, or not liked   |
| `503`  | Auth service unreachable       |

---

## Repost

**`POST /posts/:id/repost`**

Reposts a published post. Sends a `REPOST` notification to the author. You cannot repost your own posts. Each user can repost a given post once.

### Response `201`

```json
{ "message": "Post reposted" }
```

### Example

```bash
curl -X POST "https://api.kirky.app/posts/clx1a2b3c/repost" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                        |
|--------|------------------------------------|
| `400`  | Cannot repost your own post        |
| `401`  | Missing or invalid token           |
| `404`  | Post not found                     |
| `409`  | Already reposted                   |
| `503`  | Auth service unreachable           |

---

## Remove Repost

**`DELETE /posts/:id/repost`**

Removes a repost. The original post is unaffected.

### Response `200`

```json
{ "message": "Repost removed" }
```

### Example

```bash
curl -X DELETE "https://api.kirky.app/posts/clx1a2b3c/repost" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                      |
|--------|----------------------------------|
| `401`  | Missing or invalid token         |
| `404`  | Post not found, or not reposted  |
| `503`  | Auth service unreachable         |

---

## Bookmark a Post

**`POST /posts/:id/bookmark`**

Saves a published post to the authenticated user's private bookmark list. Bookmarks are not visible to other users.

### Response `201`

```json
{ "message": "Post bookmarked" }
```

### Example

```bash
curl -X POST "https://api.kirky.app/posts/clx1a2b3c/bookmark" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description               |
|--------|---------------------------|
| `401`  | Missing or invalid token  |
| `404`  | Post not found            |
| `409`  | Already bookmarked        |
| `503`  | Auth service unreachable  |

---

## Remove Bookmark

**`DELETE /posts/:id/bookmark`**

Removes a post from the authenticated user's bookmark list.

### Response `200`

```json
{ "message": "Bookmark removed" }
```

### Example

```bash
curl -X DELETE "https://api.kirky.app/posts/clx1a2b3c/bookmark" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                         |
|--------|-------------------------------------|
| `401`  | Missing or invalid token            |
| `404`  | Post not found, or not bookmarked   |
| `503`  | Auth service unreachable            |
