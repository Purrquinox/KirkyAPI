# Kirky API

The Kirky API gives developers programmatic access to the full Kirky social platform — posts, comments, user profiles, feeds, notifications, and discovery. Every endpoint follows a consistent REST interface designed to be predictable, fast, and easy to integrate.

**Version:** `1.0.0`  
**Base URL:** `https://api.kirky.app`  
**Auth Base URL:** `https://auth.kirky.app`

---

## Environments

| Environment | Base URL                    | Notes                            |
|-------------|-----------------------------|----------------------------------|
| Production  | `https://api.kirky.app`     | Live data                        |
| Local       | `http://localhost:3000`     | Run with `bun run dev`           |

Auth is always validated against `https://auth.kirky.app` — even in local development. Set `AUTH_API_URL` in your `.env` to point at a local auth instance if needed.

---

## Quick Start

The fastest path to your first API call:

**1. Sign up and get tokens:**

```bash
curl -X POST "https://auth.kirky.app/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "yourpassword", "username": "yourhandle"}'
```

**2. Store the `accessToken` from the response, then call the API:**

```bash
curl "https://api.kirky.app/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**3. When your access token expires (after 15 minutes), refresh it:**

```bash
curl -X POST "https://auth.kirky.app/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "$REFRESH_TOKEN"}'
```

See [Authentication](authentication.md) for the full token lifecycle and all sign-in methods.

---

## Getting Started

### 1. Obtain a token

All API requests require a valid access token issued by [KirkyAuth](authentication.md). Tokens are short-lived JWTs. See [Authentication](authentication.md) for the full token lifecycle.

### 2. Make a request

Pass your token in the `Authorization` header on every request.

```http
GET /users/me HTTP/1.1
Host: api.kirky.app
Authorization: Bearer <your_access_token>
```

### 3. Handle the response

All responses are `application/json`. Successful responses return the resource or a `message` string. Errors always use this shape:

```json
{
  "error": "Human-readable description"
}
```

---

## Core Concepts

### Pagination

Paginated endpoints accept `limit` and `offset` as query parameters. When not specified, the default limit is `20`. Maximum limits vary per endpoint and are documented inline.

| Parameter | Type    | Default | Description                  |
|-----------|---------|---------|------------------------------|
| `limit`   | integer | `20`    | Number of results to return  |
| `offset`  | integer | `0`     | Number of results to skip    |

Responses from paginated endpoints include a `total` field reflecting the full result count before pagination. Use this to determine whether more pages exist:

```
hasNextPage = offset + limit < total
```

The Feed endpoint uses `hasMore: boolean` instead of `total` — see [Feed](feed.md).

### Drafts

Posts support a draft state. A post with `published: false` is only visible to its author via `GET /posts/mine`. Setting `published: true` on a `PATCH` publishes it and records `publishedAt` as the current timestamp.

### Hashtags

Hashtags are parsed automatically from post content on create and update. You do not need to submit them separately. They are returned on every post as a `hashtags: string[]` array, without the `#` prefix.

A valid hashtag is a `#` followed by one or more letters, digits, or underscores: `#([a-zA-Z0-9_]+)`. Tags are stored lowercase. Multiple hashtags in a single post are all captured.

### Mentions

Mentioning `@username` in post or comment content automatically triggers a `MENTION` notification for that user. Notifications are fire-and-forget — if the username does not exist, the notification is silently skipped.

### Block Behavior

When user A blocks user B:
- All follow relationships between them are removed in both directions, atomically.
- B's posts and reposts no longer appear in A's feed.
- A's posts and reposts no longer appear in B's feed.

Blocking does not prevent B from seeing A's public posts directly via `GET /posts/:id`.

---

## Rate Limiting

The API enforces a limit of **100 requests per minute per IP address**. Exceeding this returns `429 Too Many Requests`. Build in exponential backoff when retrying.

The Auth service has its own separate rate limit for login attempts: **5 failed logins** within a window locks the account for 15 minutes.

---

## Error Handling

All errors return a JSON body with a single `error` field:

```json
{
  "error": "Post not found"
}
```

### Handling 401s in client code

Access tokens expire after 15 minutes. The recommended pattern is to intercept `401` responses and silently refresh before retrying:

```
request → 401 → POST /auth/refresh → retry original request
                      ↓ 401 (refresh token also expired)
                   redirect to login
```

Do not proactively refresh before every request — call the API with your current token and only refresh when you get a `401`.

### Handling 503s

A `503` means the KirkyAuth service was unreachable when validating your token. This is transient — retry with the same token after a brief delay. Do not discard the token or redirect to login on a `503`.

---

## HTTP Status Codes

| Code  | Meaning                                                    |
|-------|------------------------------------------------------------|
| `200` | OK                                                         |
| `201` | Created                                                    |
| `400` | Bad Request — invalid parameters or business rule violated |
| `401` | Unauthorized — missing or invalid token                    |
| `403` | Forbidden — token valid, but you lack permission           |
| `404` | Not Found                                                  |
| `409` | Conflict — resource already exists                         |
| `429` | Too Many Requests — rate limit exceeded                    |
| `503` | Service Unavailable — auth service unreachable             |

---

## API Reference

| Section                             | Description                                   |
|-------------------------------------|-----------------------------------------------|
| [Authentication](authentication.md) | Token lifecycle, OAuth flows, and error codes |
| [System](system.md)                 | Health check and root endpoints               |
| [Feed](feed.md)                     | Home timeline with posts and reposts          |
| [Users](users.md)                   | Profiles, follow, block, and follower lists   |
| [Posts](posts.md)                   | Create, read, update, delete, like, and share |
| [Comments](comments.md)             | Threaded comments and likes                   |
| [Notifications](notifications.md)   | Activity notifications and read state         |
| [Search](search.md)                 | Full-text search for users, posts, hashtags   |

---

## Data Types

A complete reference for all shared objects returned across endpoints is available in [Data Types](data-types.md).
