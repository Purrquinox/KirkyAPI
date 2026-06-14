# Comments

The Comments API provides threaded commenting on posts. Comments support one level of nesting — replies to top-level comments. Mentioning `@username` in comment content triggers a `MENTION` notification.

---

## Endpoints

| Method   | Path                    | Description                       |
|----------|-------------------------|-----------------------------------|
| `GET`    | `/posts/:id/comments`   | List comments on a post           |
| `POST`   | `/posts/:id/comments`   | Create a comment on a post        |
| `PATCH`  | `/comments/:id`         | Update own comment                |
| `DELETE` | `/comments/:id`         | Delete own comment                |
| `POST`   | `/comments/:id/like`    | Like a comment                    |
| `DELETE` | `/comments/:id/like`    | Unlike a comment                  |

---

## Threading Model

Comments are one level deep. A top-level comment (where `parentId` is `null`) can have replies (where `parentId` is the parent comment's ID). Replies cannot have further replies — attempting to set `parentId` to a reply's ID returns `404 Parent comment not found`.

```
Post
├── Comment A              parentId: null
│   ├── Reply A1           parentId: Comment A
│   └── Reply A2           parentId: Comment A
└── Comment B              parentId: null
    └── Reply B1           parentId: Comment B
```

Top-level comments and all of their replies are returned together in a single `GET /posts/:id/comments` response. Pagination applies only to top-level comments; all replies for each comment are always included inline.

---

## List Comments

**`GET /posts/:id/comments`**

Returns top-level comments on a published post, ordered oldest first. Each comment includes its direct replies in a `replies` array, also ordered oldest first.

### Path Parameters

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `id`      | string | Post CUID   |

### Query Parameters

| Parameter | Type    | Default | Maximum | Description                         |
|-----------|---------|---------|---------|-------------------------------------|
| `limit`   | integer | `50`    | `200`   | Number of top-level comments        |
| `offset`  | integer | `0`     | —       | Skip this many top-level comments   |

### Response `200`

| Field      | Type   | Description                                  |
|------------|--------|----------------------------------------------|
| `comments` | array  | Top-level comments, each with nested replies |

Each item extends [Comment](data-types.md#comment) with a `replies` field containing direct replies. Replies share the same Comment shape but do not include a further `replies` array.

```json
{
  "comments": [
    {
      "id": "clxcomment1",
      "content": "Great post!",
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
          "content": "Thanks so much!",
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
  ]
}
```

### Example

```bash
curl "https://api.kirky.app/posts/clx1a2b3c/comments" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `404`  | Post not found           |
| `503`  | Auth service unreachable |

---

## Create a Comment

**`POST /posts/:id/comments`**

Adds a comment to a published post. To reply to an existing comment, pass `parentId` — it must be a top-level comment on the same post.

**Notifications triggered:**
- The post author receives a `COMMENT` notification
- Any `@username` mentioned in `content` receives a `MENTION` notification
- Notifications are not sent to yourself

### Path Parameters

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `id`      | string | Post CUID   |

### Request Body

| Field      | Type   | Required | Constraints      | Description                               |
|------------|--------|----------|------------------|-------------------------------------------|
| `content`   | string | Yes      | 1–5000 chars                   | Comment text                              |
| `imageUrl`  | string | No       | Max 2048 chars                 | Image URL to attach                       |
| `imageFile` | file   | No       | Max 10 MB                      | Upload image directly; takes precedence over `imageUrl` |
| `parentId`  | string | No       | Top-level comment on this post | ID of comment to reply to                 |

### Response `201`

| Field     | Type                               |
|-----------|------------------------------------|
| `comment` | [Comment](data-types.md#comment)   |

```json
{
  "comment": {
    "id": "clxnewcomment",
    "content": "Really insightful — thanks for sharing @elias!",
    "imageUrl": null,
    "parentId": null,
    "createdAt": "2026-06-14T12:00:00.000Z",
    "updatedAt": "2026-06-14T12:00:00.000Z",
    "author": {
      "profile": {
        "username": "janedoe",
        "firstName": "Jane",
        "lastName": "Doe",
        "avatar": null,
        "verified": false
      }
    },
    "likesCount": 0,
    "isLiked": false
  }
}
```

### Examples

**Top-level comment (JSON):**

```bash
curl -X POST "https://api.kirky.app/posts/clx1a2b3c/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Great work on this!"}'
```

**Comment with an image attached (multipart):**

```bash
curl -X POST "https://api.kirky.app/posts/clx1a2b3c/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -F "content=Here's a screenshot of what I mean" \
  -F "imageFile=@screenshot.png"
```

**Reply to a comment:**

```bash
curl -X POST "https://api.kirky.app/posts/clx1a2b3c/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Agreed!", "parentId": "clxcomment1"}'
```

### Errors

| Status | Description                                                   |
|--------|---------------------------------------------------------------|
| `401`  | Missing or invalid token                                      |
| `404`  | Post not found, or `parentId` not found on this post          |
| `502`  | CDN rejected the image upload                                 |
| `503`  | Auth service unreachable                                      |

---

## Update a Comment

**`PATCH /comments/:id`**

Updates the content of a comment you own. Only `content` can be changed — `imageUrl` is set at creation time via `imageFile` or `imageUrl` and cannot be edited afterward.

### Path Parameters

| Parameter | Type   | Description   |
|-----------|--------|---------------|
| `id`      | string | Comment CUID  |

### Request Body

| Field     | Type   | Required | Constraints  |
|-----------|--------|----------|--------------|
| `content` | string | Yes      | 1–5000 chars |

### Response `200`

| Field     | Type                               |
|-----------|------------------------------------|
| `comment` | [Comment](data-types.md#comment)   |

### Example

```bash
curl -X PATCH "https://api.kirky.app/comments/clxcomment1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated comment text."}'
```

### Errors

| Status | Description                       |
|--------|-----------------------------------|
| `401`  | Missing or invalid token          |
| `403`  | You do not own this comment       |
| `404`  | Comment not found                 |
| `503`  | Auth service unreachable          |

---

## Delete a Comment

**`DELETE /comments/:id`**

Permanently deletes a comment you own. All replies to this comment are also deleted in cascade.

### Response `200`

```json
{ "message": "Comment deleted" }
```

### Example

```bash
curl -X DELETE "https://api.kirky.app/comments/clxcomment1" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                   |
|--------|-------------------------------|
| `401`  | Missing or invalid token      |
| `403`  | You do not own this comment   |
| `404`  | Comment not found             |
| `503`  | Auth service unreachable      |

---

## Like a Comment

**`POST /comments/:id/like`**

Likes a comment. Sends a `LIKE_COMMENT` notification to the comment's author.

### Response `201`

```json
{ "message": "Comment liked" }
```

### Example

```bash
curl -X POST "https://api.kirky.app/comments/clxcomment1/like" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description               |
|--------|---------------------------|
| `401`  | Missing or invalid token  |
| `404`  | Comment not found         |
| `409`  | Already liked             |
| `503`  | Auth service unreachable  |

---

## Unlike a Comment

**`DELETE /comments/:id/like`**

Removes a like from a comment.

### Response `200`

```json
{ "message": "Comment unliked" }
```

### Example

```bash
curl -X DELETE "https://api.kirky.app/comments/clxcomment1/like" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                          |
|--------|--------------------------------------|
| `401`  | Missing or invalid token             |
| `404`  | Comment not found, or not liked      |
| `503`  | Auth service unreachable             |
