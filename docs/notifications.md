# Notifications

The Notifications API provides access to the authenticated user's activity stream. Notifications are generated automatically when other users interact with your content — likes, comments, follows, reposts, quotes, and mentions.

**Base path:** `/notifications`

---

## Endpoints

| Method  | Path                          | Description                            |
|---------|-------------------------------|----------------------------------------|
| `GET`   | `/notifications`              | List notifications                     |
| `GET`   | `/notifications/unread-count` | Get unread notification count          |
| `PATCH` | `/notifications/read-all`     | Mark all notifications as read         |
| `PATCH` | `/notifications/:id/read`     | Mark a single notification as read     |

---

## Notification Types

| Type           | What happened                                     | `post` | `comment` |
|----------------|---------------------------------------------------|--------|-----------|
| `FOLLOW`       | Someone followed you                              | null   | null      |
| `LIKE_POST`    | Someone liked your post                           | ✓      | null      |
| `LIKE_COMMENT` | Someone liked your comment                        | null   | ✓         |
| `COMMENT`      | Someone commented on your post                    | ✓      | ✓         |
| `REPOST`       | Someone reposted your post                        | ✓      | null      |
| `QUOTE`        | Someone quoted your post                          | ✓      | null      |
| `MENTION`      | Someone mentioned `@you` in a post or comment     | ✓      | ✓ (if in a comment) |

The `post` and `comment` fields on a notification always contain just a snippet (`id`, `content`, `title`) — not the full object. Use the IDs to fetch the complete resource if needed.

---

## List Notifications

**`GET /notifications`**

Returns notifications for the authenticated user, sorted by `createdAt` descending.

### Query Parameters

| Parameter | Type    | Default | Maximum |
|-----------|---------|---------|---------|
| `limit`   | integer | `20`    | `100`   |
| `offset`  | integer | `0`     | —       |

### Response `200`

| Field           | Type                                               |
|-----------------|----------------------------------------------------|
| `notifications` | [Notification](data-types.md#notification)[]       |
| `total`         | number                                             |

```json
{
  "notifications": [
    {
      "id": "clxnotif1",
      "type": "LIKE_POST",
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
      "comment": null
    },
    {
      "id": "clxnotif2",
      "type": "FOLLOW",
      "read": true,
      "createdAt": "2026-06-13T09:00:00.000Z",
      "actor": {
        "profile": {
          "username": "alexsmith",
          "firstName": "Alex",
          "lastName": "Smith",
          "avatar": "https://cdn.kirky.app/avatars/alexsmith.jpg",
          "verified": false
        }
      },
      "post": null,
      "comment": null
    }
  ],
  "total": 47
}
```

### Example

```bash
curl "https://api.kirky.app/notifications?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Get Unread Count

**`GET /notifications/unread-count`**

Returns the number of unread notifications. Use this to drive badge counts in your UI without fetching the full notification list.

### Response `200`

| Field   | Type   | Description                     |
|---------|--------|---------------------------------|
| `count` | number | Number of unread notifications  |

```json
{
  "count": 5
}
```

### Example

```bash
curl "https://api.kirky.app/notifications/unread-count" \
  -H "Authorization: Bearer $TOKEN"
```

### Polling for Badge Counts

For badge count updates, poll `/notifications/unread-count` on a reasonable interval rather than subscribing to the full notification list. Recommended cadences:

| Context          | Suggested interval |
|------------------|--------------------|
| App in foreground | Every 30–60 seconds |
| App in background | Every 5–15 minutes  |
| After a tab/window focus event | Immediately |

Only increment the displayed badge; do not reset it on new fetches — allow users to explicitly clear it via mark-as-read actions.

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Mark All as Read

**`PATCH /notifications/read-all`**

Sets `read: true` on every unread notification for the authenticated user in a single operation. Call this when the user opens the notifications screen.

### Response `200`

```json
{ "message": "All notifications marked as read" }
```

### Example

```bash
curl -X PATCH "https://api.kirky.app/notifications/read-all" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Mark One as Read

**`PATCH /notifications/:id/read`**

Sets `read: true` on a single notification. You can only mark your own notifications.

### Path Parameters

| Parameter | Type   | Description        |
|-----------|--------|--------------------|
| `id`      | string | Notification CUID  |

### Response `200`

```json
{ "message": "Notification marked as read" }
```

### Example

```bash
curl -X PATCH "https://api.kirky.app/notifications/clxnotif1/read" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                                |
|--------|--------------------------------------------|
| `401`  | Missing or invalid token                   |
| `403`  | Notification does not belong to you        |
| `404`  | Notification not found                     |
| `503`  | Auth service unreachable                   |

---

## Recommended Read Pattern

A common UX pattern is to mark all notifications as read the moment the user opens the notification list, then immediately refresh the badge count to zero:

```
User opens notifications screen
  → PATCH /notifications/read-all
  → GET /notifications?limit=20        (render the list)
  → GET /notifications/unread-count    (verify badge = 0)
```

For individual "mark as read on tap" interactions, use `PATCH /notifications/:id/read` and optimistically update the local `read` state before the response returns.
