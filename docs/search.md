# Search

The Search API provides discovery for users, posts, and hashtags. All search is case-insensitive. Results are capped at 50 per request.

**Base path:** `/search`

---

## Endpoints

| Method | Path                            | Description                                              |
|--------|---------------------------------|----------------------------------------------------------|
| `GET`  | `/search/all`                   | Unified search across users, posts, and hashtags         |
| `GET`  | `/search/users`                 | Search users by username or name                         |
| `GET`  | `/search/posts`                 | Search posts by content or title                         |
| `GET`  | `/search/hashtags`              | Search hashtags by prefix                                |
| `GET`  | `/search/hashtags/:tag/posts`   | Get posts tagged with a hashtag                          |

---

## Unified Search

**`GET /search/all`**

Searches users, posts, and hashtags in a single request. All three lookups run in parallel server-side, so the latency is bounded by the slowest individual search, not the sum.

This is the recommended endpoint for building a general-purpose search UI. Use the type-specific endpoints when you only need one category.

### Smart prefix detection

The `q` parameter is inspected for a leading prefix before the query is dispatched:

| Prefix | Example | Default behavior                              |
|--------|---------|-----------------------------------------------|
| `#`    | `#kirky` | Searches hashtags only; `#` is stripped from the query |
| `@`    | `@jane`  | Searches users only; `@` is stripped from the query    |
| *(none)* | `kirky` | Searches all three types                     |

The default is overridden if you supply a `types` parameter explicitly.

### Query Parameters

| Parameter | Type    | Required | Default              | Description                                          |
|-----------|---------|----------|----------------------|------------------------------------------------------|
| `q`       | string  | Yes      | —                    | Search query, max 100 chars. May be prefixed with `#` or `@`. |
| `types`   | string  | No       | Detected from prefix | Comma-separated list of types to search: `users`, `posts`, `hashtags` |
| `limit`   | integer | No       | `5`                  | Max results per type. Maximum `20`.                  |

### Response `200`

| Field      | Type                                              |
|------------|---------------------------------------------------|
| `query`    | string — the query after prefix stripping         |
| `users`    | [PublicProfile](data-types.md#publicprofile)[]    |
| `posts`    | [Post](data-types.md#post)[]                      |
| `hashtags` | [Hashtag](data-types.md#hashtag)[]                |

Types not included in the `types` filter are returned as empty arrays. `isFollowing` and `isBlocked` on users are always `false` — see [Search Users](#search-users) for details.

```json
{
  "query": "kirky",
  "users": [
    {
      "username": "kirkydev",
      "firstName": "Kirky",
      "lastName": "Dev",
      "avatar": null,
      "verified": false,
      "followersCount": 204,
      "followingCount": 31,
      "isFollowing": false,
      "isBlocked": false,
      "pinnedPost": null,
      ...
    }
  ],
  "posts": [
    {
      "id": "clxpost1",
      "content": "Just launched Kirky — a new social platform.",
      "hashtags": ["kirky", "launch"],
      ...
    }
  ],
  "hashtags": [
    { "tag": "kirky", "postsCount": 58 }
  ]
}
```

### Examples

**General search:**

```bash
curl "https://api.kirky.app/search/all?q=kirky&limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

**Hashtag prefix — only searches hashtags:**

```bash
curl "https://api.kirky.app/search/all?q=%23build&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**User prefix — only searches users:**

```bash
curl "https://api.kirky.app/search/all?q=%40jane" \
  -H "Authorization: Bearer $TOKEN"
```

**Override types explicitly:**

```bash
curl "https://api.kirky.app/search/all?q=kirky&types=users,hashtags" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Search Behavior

Each search type uses a different matching strategy:

| Endpoint              | Match type  | Fields searched                          |
|-----------------------|-------------|------------------------------------------|
| `/search/users`       | Substring   | `username`, `firstName`, `lastName`      |
| `/search/posts`       | Substring   | `content`, `title`                       |
| `/search/hashtags`    | Prefix      | `tag`                                    |

**Substring** — a query of `jane` matches `janedoe`, `mrjane`, and `jane`. Case is ignored.

**Prefix** — a query of `build` matches `buildinpublic` and `buildtools`, but not `inbuild`. The leading `#` is stripped automatically, so `#build` and `build` return the same results.

---

## Search Users

**`GET /search/users`**

Searches profiles by `username`, `firstName`, or `lastName`. Results are sorted alphabetically by `username`.

### Query Parameters

| Parameter | Type    | Required | Default | Maximum   | Description        |
|-----------|---------|----------|---------|-----------|--------------------|
| `q`       | string  | Yes      | —       | 100 chars | Search query       |
| `limit`   | integer | No       | `20`    | `50`      | Number of results  |
| `offset`  | integer | No       | `0`     | —         | Skip results       |

### Response `200`

| Field      | Type                                               |
|------------|----------------------------------------------------|
| `profiles` | [PublicProfile](data-types.md#publicprofile)[]     |
| `total`    | number                                             |

> `isFollowing` and `isBlocked` are always `false` in search results. For accurate relationship state, call `GET /users/:username` on the profile you're interested in.

```json
{
  "profiles": [
    {
      "username": "janedoe",
      "firstName": "Jane",
      "lastName": "Doe",
      "avatar": null,
      "bio": "Building cool things.",
      "website": null,
      "location": null,
      "bannerImage": null,
      "verified": false,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "followersCount": 120,
      "followingCount": 85,
      "isFollowing": false,
      "isBlocked": false,
      "pinnedPost": null
    }
  ],
  "total": 1
}
```

### Example

```bash
curl "https://api.kirky.app/search/users?q=jane&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Search Posts

**`GET /search/posts`**

Searches published posts by `content` or `title`. Results are sorted by `publishedAt` descending — most recent first.

### Query Parameters

| Parameter | Type    | Required | Default | Maximum   | Description          |
|-----------|---------|----------|---------|-----------|----------------------|
| `q`       | string  | Yes      | —       | 100 chars | Search query         |
| `limit`   | integer | No       | `20`    | `50`      | Number of results    |
| `offset`  | integer | No       | `0`     | —         | Skip results         |

### Response `200`

| Field   | Type                         |
|---------|------------------------------|
| `posts` | [Post](data-types.md#post)[] |
| `total` | number                       |

```json
{
  "posts": [
    {
      "id": "clxpost1",
      "content": "Shipping something big today. Really excited about this.",
      "title": null,
      "publishedAt": "2026-06-14T10:00:00.000Z",
      ...
    }
  ],
  "total": 3
}
```

### Example

```bash
curl "https://api.kirky.app/search/posts?q=shipping" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Search Hashtags

**`GET /search/hashtags`**

Searches hashtags by prefix. Results are sorted by post count descending — the most-used matching tag appears first.

The leading `#` is stripped from the query automatically if present, so `#build` and `build` produce identical results.

### Query Parameters

| Parameter | Type    | Required | Default | Maximum  | Description              |
|-----------|---------|----------|---------|----------|--------------------------|
| `q`       | string  | Yes      | —       | 50 chars | Hashtag prefix to search |
| `limit`   | integer | No       | `20`    | `50`     | Number of results        |
| `offset`  | integer | No       | `0`     | —        | Skip results             |

### Response `200`

| Field      | Type                               |
|------------|------------------------------------|
| `hashtags` | [Hashtag](data-types.md#hashtag)[] |
| `total`    | number                             |

```json
{
  "hashtags": [
    { "tag": "buildinpublic", "postsCount": 142 },
    { "tag": "buildtools",    "postsCount": 38  },
    { "tag": "buildspace",    "postsCount": 12  }
  ],
  "total": 3
}
```

### Example

```bash
curl "https://api.kirky.app/search/hashtags?q=build" \
  -H "Authorization: Bearer $TOKEN"
```

**With the # character (same result):**

```bash
curl "https://api.kirky.app/search/hashtags?q=%23build" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Get Posts by Hashtag

**`GET /search/hashtags/:tag/posts`**

Returns published posts that include a specific hashtag, sorted by `publishedAt` descending.

Provide the tag **without** the `#` prefix. The tag is matched case-insensitively. If the hashtag does not exist, an empty result set is returned — not a `404`.

### Path Parameters

| Parameter | Type   | Description                              |
|-----------|--------|------------------------------------------|
| `tag`     | string | Exact hashtag without `#`, e.g. `buildinpublic` |

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

```json
{
  "posts": [
    {
      "id": "clxpost1",
      "content": "Day 42 of #buildinpublic — shipped the search API.",
      "hashtags": ["buildinpublic"],
      ...
    }
  ],
  "total": 142
}
```

### Examples

```bash
curl "https://api.kirky.app/search/hashtags/buildinpublic/posts?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Paginate through all posts:**

```bash
# Page 1
curl "https://api.kirky.app/search/hashtags/buildinpublic/posts?limit=50&offset=0" \
  -H "Authorization: Bearer $TOKEN"

# Page 2
curl "https://api.kirky.app/search/hashtags/buildinpublic/posts?limit=50&offset=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Tips

- **Search bar:** Use `GET /search/all` to back a single search bar that handles all content types. As the user types `#` or `@`, the prefix detection automatically narrows the results.
- **Autocomplete:** Use `GET /search/hashtags?q=<prefix>` to power hashtag autocomplete as the user types `#`. It's faster than `GET /search/all` when you only need hashtags.
- **Mention autocomplete:** When building a `@username` mention autocomplete, use `GET /search/users?q=<query>` and show `username` as the primary result label.
- **Relationship state:** Search results intentionally omit accurate `isFollowing`/`isBlocked` state to keep responses fast. When the user selects a result and navigates to a profile page, call `GET /users/:username` to get the correct relationship context.
- **Empty hashtag results:** A `total: 0` on `/search/hashtags/:tag/posts` means the tag exists but has no posts, or the tag has never been used. Both cases return the same empty response.
