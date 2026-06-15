# Feed

The Feed API provides two timelines: a chronological **Following** feed of posts and reposts from accounts the user follows, and an algorithmic **For You** feed that ranks all recent platform content by engagement, recency, and social signals.

**Base path:** `/feed`

---

## Endpoints

| Method | Path            | Description                                              |
|--------|-----------------|----------------------------------------------------------|
| `GET`  | `/feed`         | Following feed — chronological posts and reposts         |
| `GET`  | `/feed/for-you` | For You — algorithmic feed ranked by score               |

---

## For You Feed

**`GET /feed/for-you`**

Returns a personalized ranked feed of recent posts from across the platform. Posts are scored using a combination of engagement metrics, time decay, and social signals relative to the authenticated viewer.

### Scoring formula

```
score = (likes × 2 + reposts × 3 + comments × 1.5)
        ─────────────────────────────────────────────
               (hours_since_published + 2) ^ 1.8

      + 10.0   if the viewer follows the author
      + 1.5    if the author is verified
```

**Engagement weights** — reposts are the strongest signal (×3), followed by likes (×2) and comments (×1.5). A repost means someone thought the content was worth redistributing; a comment means engagement but can be negative.

**Time decay** — the denominator uses a gravity exponent of `1.8`, matching the [Hacker News algorithm](https://news.ycombinator.com/item?id=1781417). Fresh posts from a few hours ago score much higher than older posts with the same engagement. The `+ 2` offset prevents brand-new posts from receiving an outsized boost.

**Following boost** (`+10`) — posts from accounts the viewer follows are strongly preferred. A new post with zero engagement from a followed user scores around `10 / 4 = 2.5`, comparable to a post with ~15 likes from 1 hour ago.

**Verified boost** (`+1.5`) — a small additional signal for verified accounts.

### What is excluded

- The viewer's own posts
- Posts from blocked users (in either direction)
- Posts older than 7 days

### Query Parameters

| Parameter | Type    | Default | Maximum | Description               |
|-----------|---------|---------|---------|---------------------------|
| `limit`   | integer | `20`    | `100`   | Number of posts to return |
| `offset`  | integer | `0`     | —       | Number of posts to skip   |

### Response `200`

| Field     | Type                         | Description                                             |
|-----------|------------------------------|---------------------------------------------------------|
| `items`   | [Post](data-types.md#post)[] | Posts ordered by score descending                       |
| `hasMore` | boolean                      | `true` if more scored posts exist beyond this page      |

Items are plain [Post](data-types.md#post) objects — not FeedItems. The For You feed contains only original posts; reposts are not surfaced here (use `GET /feed` for reposts).

```json
{
  "items": [
    {
      "id": "clx1a2b3c",
      "content": "Just shipped a big performance improvement. #buildinpublic",
      "likesCount": 84,
      "repostsCount": 22,
      "commentsCount": 11,
      "isLiked": false,
      "isReposted": false,
      "isBookmarked": false,
      "hashtags": ["buildinpublic"],
      ...
    }
  ],
  "hasMore": true
}
```

### Example

```bash
curl "https://api.kirky.app/feed/for-you?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Following Feed

**`GET /feed`**

Returns posts and reposts from accounts the authenticated user follows, merged and sorted by recency. The authenticated user's own posts and reposts are always included.

### How the feed is built

1. Collect the IDs of all users the viewer follows, plus the viewer's own ID.
2. Remove any IDs that are in a block relationship (in either direction) with the viewer.
3. Fetch the most recent published posts from those users and the most recent reposts from those users.
4. Merge the two sets and sort by effective date — `repostedAt` for reposts, `publishedAt` for original posts.
5. Apply `offset` and `limit` to the merged, sorted result.

This means a heavily-reposted item can appear at the top of the feed even if the original post is several days old.

### Query Parameters

| Parameter | Type    | Default | Maximum | Description                    |
|-----------|---------|---------|---------|--------------------------------|
| `limit`   | integer | `20`    | `100`   | Number of feed items to return |
| `offset`  | integer | `0`     | —       | Number of feed items to skip   |

### Response `200`

| Field     | Type                                                   | Description                                        |
|-----------|--------------------------------------------------------|----------------------------------------------------|
| `items`   | [FeedItem](data-types.md#feeditem)[]                   | Ordered list of feed items, newest first           |
| `hasMore` | boolean                                                | `true` if there are additional items beyond `offset + limit` |

```json
{
  "items": [
    {
      "id": "clx1a2b3c",
      "type": "repost",
      "content": "Just shipped something big.",
      "title": null,
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
      "isReposted": true,
      "isBookmarked": false,
      "hashtags": [],
      "repostedBy": {
        "username": "janedoe",
        "firstName": "Jane",
        "lastName": "Doe",
        "avatar": null,
        "verified": false
      },
      "repostedAt": "2026-06-14T11:30:00.000Z"
    },
    {
      "id": "clxorigpost",
      "type": "post",
      "content": "Writing a thread on building in public. #buildinpublic",
      "title": null,
      "imageUrl": null,
      "publishedAt": "2026-06-14T09:00:00.000Z",
      "createdAt": "2026-06-14T08:58:00.000Z",
      "updatedAt": "2026-06-14T08:58:00.000Z",
      "author": { ... },
      "quoteOf": null,
      "likesCount": 8,
      "repostsCount": 2,
      "commentsCount": 1,
      "isLiked": true,
      "isReposted": false,
      "isBookmarked": false,
      "hashtags": ["buildinpublic"],
      "repostedBy": null,
      "repostedAt": null
    }
  ],
  "hasMore": true
}
```

### Errors

| Status | Description                     |
|--------|---------------------------------|
| `401`  | Missing or invalid token        |
| `503`  | Auth service unreachable        |

### Example

```bash
curl "https://api.kirky.app/feed?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Implementing Infinite Scroll

Use `hasMore` to determine whether to show a "load more" control or trigger the next page fetch:

```
page 1:  GET /feed?limit=20&offset=0   → { items: [...], hasMore: true }
page 2:  GET /feed?limit=20&offset=20  → { items: [...], hasMore: true }
page 3:  GET /feed?limit=20&offset=40  → { items: [...], hasMore: false }
                                                               ↑ stop
```

When `hasMore` is `false`, no further items exist and you should hide the load-more trigger.

> The feed does not support cursor-based pagination. If new posts arrive between page requests, the same item may appear on two pages. Deduplicate by `id` on the client.
