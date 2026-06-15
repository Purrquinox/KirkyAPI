# Explore

The Explore API surfaces trending content and curated events. It is designed to back an Explore or Discover page — a view that shows what is happening across the platform right now, not just within the user's social graph.

All trending data is computed from recent post activity within a configurable time window.

**Base path:** `/explore`

---

## Endpoints

| Method   | Path                               | Auth | Description                                            |
|----------|------------------------------------|------|--------------------------------------------------------|
| `GET`    | `/explore`                         | ✓    | Overview — top trending hashtags, events, and posts    |
| `GET`    | `/explore/trending-hashtags`       | ✓    | Trending hashtags ranked by recent post activity       |
| `GET`    | `/explore/trending-posts`          | ✓    | Trending posts ranked by recent engagement             |
| `GET`    | `/explore/events`                  | ✓    | Active and upcoming events                             |
| `POST`   | `/explore/events`                  | ✓    | Create an event                                        |
| `PATCH`  | `/explore/events/:id/featured`     | ✓    | Feature or unfeature an event                          |

---

## Time Windows

Trending endpoints accept a `window` query parameter that controls how far back activity is counted:

| Value  | Lookback period |
|--------|-----------------|
| `24h`  | Last 24 hours *(default)* |
| `7d`   | Last 7 days     |
| `30d`  | Last 30 days    |

Use `24h` for a live "right now" feel and `7d` or `30d` for a weekly or monthly digest view.

---

## Explore Overview

**`GET /explore`**

Returns a combined summary suitable for rendering a full Explore page in one request: top 5 trending hashtags, up to 10 active/upcoming events, and up to 10 trending posts, all scoped to the given `window`.

### Query Parameters

| Parameter | Type   | Default | Description         |
|-----------|--------|---------|---------------------|
| `window`  | string | `24h`   | `24h`, `7d`, or `30d` |

### Response `200`

| Field               | Type                                           |
|---------------------|------------------------------------------------|
| `trendingHashtags`  | [Hashtag](data-types.md#hashtag)[] — up to 5  |
| `events`            | [Event](#event)[] — up to 10                  |
| `trendingPosts`     | [Post](data-types.md#post)[] — up to 10, ordered by engagement |

```json
{
  "trendingHashtags": [
    { "tag": "buildinpublic", "postsCount": 84 },
    { "tag": "kirky",         "postsCount": 58 },
    { "tag": "indiedev",      "postsCount": 41 }
  ],
  "events": [
    {
      "id": "clxevent1",
      "title": "Kirky Launch Week",
      "description": "A week of announcements, AMAs, and giveaways.",
      "imageUrl": "https://bytepurr.purrquinox.com/kirky/events/launch.jpg",
      "hashtag": { "tag": "kirkylaunch" },
      "startsAt": "2026-06-16T00:00:00.000Z",
      "endsAt":   "2026-06-22T23:59:59.000Z",
      "createdAt": "2026-06-10T09:00:00.000Z"
    }
  ],
  "trendingPosts": [
    {
      "id": "clxpost1",
      "content": "Just shipped the Explore page. #kirkylaunch",
      ...
    }
  ]
}
```

### Example

```bash
curl "https://api.kirky.app/explore?window=24h" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Trending Hashtags

**`GET /explore/trending-hashtags`**

Returns hashtags ranked by how many published posts have used them within the time window, most active first. Hashtags with zero posts in the window are excluded.

This is the full paginated version of the 5-item summary returned by `GET /explore`.

### Query Parameters

| Parameter | Type    | Default | Maximum | Description             |
|-----------|---------|---------|---------|-------------------------|
| `window`  | string  | `24h`   | —       | `24h`, `7d`, or `30d`  |
| `limit`   | integer | `20`    | `50`    | Results per page        |
| `offset`  | integer | `0`     | —       | Skip results            |

### Response `200`

| Field      | Type                               |
|------------|------------------------------------|
| `hashtags` | [Hashtag](data-types.md#hashtag)[] |
| `total`    | number                             |

```json
{
  "hashtags": [
    { "tag": "buildinpublic", "postsCount": 84 },
    { "tag": "kirky",         "postsCount": 58 },
    { "tag": "indiedev",      "postsCount": 41 },
    { "tag": "javascript",    "postsCount": 29 }
  ],
  "total": 4
}
```

> `postsCount` reflects posts published within the requested window — not the hashtag's all-time total. The same hashtag may show a very different count between `24h` and `7d`.

### Example

```bash
curl "https://api.kirky.app/explore/trending-hashtags?window=7d&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Trending Posts

**`GET /explore/trending-posts`**

Returns published posts from within the time window, ranked by total engagement. Engagement is the sum of likes, reposts, and comments on each post.

Posts with zero engagement are not excluded — they appear at the bottom if they were published in the window. In practice, use a `24h` window for a lively result set and a larger window for slower platforms.

### Ranking formula

```
engagement = likesCount + repostsCount + commentsCount
```

### Query Parameters

| Parameter | Type    | Default | Maximum | Description             |
|-----------|---------|---------|---------|-------------------------|
| `window`  | string  | `24h`   | —       | `24h`, `7d`, or `30d`  |
| `limit`   | integer | `20`    | `50`    | Number of posts         |

### Response `200`

| Field   | Type                         |
|---------|------------------------------|
| `posts` | [Post](data-types.md#post)[] |

Results are already sorted by engagement descending. There is no `total` — the endpoint returns the top N posts, not a paginated set.

```json
{
  "posts": [
    {
      "id": "clxpost1",
      "content": "Just shipped the Explore page. #kirkylaunch",
      "likesCount": 142,
      "repostsCount": 38,
      "commentsCount": 21,
      ...
    },
    {
      "id": "clxpost2",
      "content": "Hot take: #buildinpublic is the best growth strategy.",
      "likesCount": 89,
      "repostsCount": 14,
      "commentsCount": 55,
      ...
    }
  ]
}
```

### Example

```bash
curl "https://api.kirky.app/explore/trending-posts?window=24h&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Events

Events are curated entries that highlight notable happenings — platform milestones, community challenges, live streams, AMAs, or any time-bound topic worth promoting. Each event can optionally link to a hashtag so users can follow the conversation.

### Get Events

**`GET /explore/events`**

Returns active, upcoming, and recently-started events. By default returns everything that is currently ongoing or scheduled to start in the future.

#### Query Parameters

| Parameter  | Type    | Default | Maximum | Description                                                           |
|------------|---------|---------|---------|-----------------------------------------------------------------------|
| `featured` | boolean | —       | —       | If `true`, returns only featured events                               |
| `upcoming` | boolean | —       | —       | If `true`, returns only events that have not started yet              |
| `limit`    | integer | `20`    | `50`    | Results per page                                                      |
| `offset`   | integer | `0`     | —       | Skip results                                                          |

`featured` and `upcoming` can be combined: `?featured=true&upcoming=true` returns only featured events that haven't started yet.

When neither filter is set, the response includes all active and upcoming events:
- Events currently in progress (`startsAt` ≤ now, `endsAt` ≥ now or no `endsAt`)
- Events that have not started yet (`startsAt` > now)

In all cases, featured events are sorted to the top, followed by other events in ascending `startsAt` order.

#### Response `200`

| Field    | Type              |
|----------|-------------------|
| `events` | [Event](#event)[] |
| `total`  | number            |

```json
{
  "events": [
    {
      "id": "clxevent1",
      "title": "Kirky Launch Week",
      "description": "A week of announcements, AMAs, and giveaways.",
      "imageUrl": "https://bytepurr.purrquinox.com/kirky/events/launch.jpg",
      "hashtag": { "tag": "kirkylaunch" },
      "startsAt": "2026-06-16T00:00:00.000Z",
      "endsAt":   "2026-06-22T23:59:59.000Z",
      "createdAt": "2026-06-10T09:00:00.000Z"
    },
    {
      "id": "clxevent2",
      "title": "Monthly #buildinpublic Challenge",
      "description": null,
      "imageUrl": null,
      "hashtag": { "tag": "buildinpublic" },
      "startsAt": "2026-06-01T00:00:00.000Z",
      "endsAt":   "2026-06-30T23:59:59.000Z",
      "createdAt": "2026-05-28T12:00:00.000Z"
    }
  ],
  "total": 2
}
```

#### Examples

**All active and upcoming events:**

```bash
curl "https://api.kirky.app/explore/events" \
  -H "Authorization: Bearer $TOKEN"
```

**Upcoming only:**

```bash
curl "https://api.kirky.app/explore/events?upcoming=true" \
  -H "Authorization: Bearer $TOKEN"
```

#### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

### Create an Event

**`POST /explore/events`**

Creates a new event. If a `hashtag` is provided, it is upserted — the tag is created if it does not already exist.

#### Request Body

| Field         | Type            | Required | Description                                                          |
|---------------|-----------------|----------|----------------------------------------------------------------------|
| `title`       | string          | Yes      | Event title, 1–200 chars                                             |
| `description` | string \| null  | No       | Event description, max 1000 chars                                    |
| `imageUrl`    | string \| null  | No       | Cover image URL — use `POST /images/upload` to get a CDN URL first   |
| `featured`    | boolean         | No       | Whether to feature the event immediately. Defaults to `false`.       |
| `hashtag`     | string \| null  | No       | Associated hashtag (without `#`). Created if it does not yet exist.  |
| `startsAt`    | string          | Yes      | ISO 8601 datetime when the event begins                              |
| `endsAt`      | string \| null  | No       | ISO 8601 datetime when the event ends. Omit for open-ended events.   |

#### Response `200`

Returns the created [Event](#event) object.

#### Example

```bash
curl -X POST "https://api.kirky.app/explore/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Kirky Launch Week",
    "description": "A week of announcements, AMAs, and giveaways.",
    "imageUrl": "https://bytepurr.purrquinox.com/kirky/events/launch.jpg",
    "hashtag": "kirkylaunch",
    "startsAt": "2026-06-16T00:00:00.000Z",
    "endsAt": "2026-06-22T23:59:59.000Z"
  }'
```

#### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

### Feature an Event

**`PATCH /explore/events/:id/featured`**

Sets or clears the featured flag on an event. Featured events appear at the top of all event listings and in the `GET /explore` overview.

#### Path Parameters

| Parameter | Type   | Description   |
|-----------|--------|---------------|
| `id`      | string | Event CUID    |

#### Request Body

| Field      | Type    | Required | Description                    |
|------------|---------|----------|--------------------------------|
| `featured` | boolean | Yes      | `true` to feature, `false` to unfeature |

#### Response `200`

Returns the updated [Event](#event) object.

#### Examples

**Feature an event:**

```bash
curl -X PATCH "https://api.kirky.app/explore/events/clxevent1/featured" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "featured": true }'
```

**Unfeature an event:**

```bash
curl -X PATCH "https://api.kirky.app/explore/events/clxevent1/featured" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "featured": false }'
```

#### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `404`  | Event not found          |
| `503`  | Auth service unreachable |

---

## Event

The Event object shape returned by all `/explore/events` endpoints.

| Field         | Type                        | Description                                                      |
|---------------|-----------------------------|------------------------------------------------------------------|
| `id`          | string                      | CUID identifier                                                  |
| `title`       | string                      | Event title                                                      |
| `description` | string \| null              | Optional description                                             |
| `imageUrl`    | string \| null              | Cover image URL                                                  |
| `featured`    | boolean                     | Whether the event is currently featured                          |
| `hashtag`     | `{ tag: string }` \| null   | Linked hashtag, if any                                           |
| `startsAt`    | ISO 8601                    | When the event begins                                            |
| `endsAt`      | ISO 8601 \| null            | When the event ends; null for open-ended events                  |
| `createdAt`   | ISO 8601                    | When the record was created                                      |

---

## Tips

- **Explore page layout:** Call `GET /explore` once to hydrate the full page. For tabs or sections that need deeper pagination (e.g. "See all trending hashtags"), follow up with the dedicated endpoint.
- **Hashtag detail pages:** When a user taps a trending hashtag, use `GET /search/hashtags/:tag/posts` to fetch the posts for that tag.
- **Event hashtag feeds:** If an event has a linked `hashtag`, use `GET /search/hashtags/:tag/posts` to show all posts tagged with it alongside the event card.
- **Refresh cadence:** Trending data changes constantly. For a live feel, refresh `GET /explore/trending-posts` every 60–120 seconds while the page is visible. `GET /explore/events` changes slowly — once on load is usually sufficient.
- **Window selection:** Expose the `window` parameter as a UI toggle ("Today / This week / This month") rather than fixing it server-side, so users can choose their own scope.
