# Notifications

The Notifications API provides access to the authenticated user's activity stream. Notifications are generated automatically when other users interact with your content — likes, comments, follows, reposts, quotes, and mentions.

Real-time delivery is handled via **Server-Sent Events** (for web) and **push notifications** (for browsers and iOS).

**Base path:** `/notifications`

---

## Endpoints

| Method   | Path                              | Auth | Description                                    |
|----------|-----------------------------------|------|------------------------------------------------|
| `GET`    | `/notifications`                  | ✓    | List notifications                             |
| `GET`    | `/notifications/unread-count`     | ✓    | Get unread notification count                  |
| `PATCH`  | `/notifications/read-all`         | ✓    | Mark all notifications as read                 |
| `PATCH`  | `/notifications/:id/read`         | ✓    | Mark a single notification as read             |
| `GET`    | `/notifications/stream`           | ✓    | SSE stream for real-time delivery              |
| `GET`    | `/notifications/vapid-public-key` | —    | VAPID public key for Web Push subscriptions    |
| `POST`   | `/notifications/push/register`    | ✓    | Register a push device (browser or iOS)        |
| `DELETE` | `/notifications/push/unregister`  | ✓    | Unregister a push device                       |

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

---

## Real-Time Notifications (SSE)

**`GET /notifications/stream`**

Opens a persistent Server-Sent Events connection. The server pushes a `notification` event each time a new notification is created for the authenticated user. The connection is kept alive with a `: ping` comment every 25 seconds.

> This endpoint is intended for **web clients**. iOS apps receive notifications via APNs push — see [Push Notifications](#push-notifications) below.

### Event format

Each event has the `notification` type and a JSON `data` payload:

```
event: notification
data: {"id":"clxnotif1","type":"LIKE_POST","createdAt":"2026-06-14T11:00:00.000Z","actor":"janedoe"}

: ping
```

| Field       | Type   | Description                            |
|-------------|--------|----------------------------------------|
| `id`        | string | Notification CUID — use to fetch full details |
| `type`      | string | One of the [notification types](#notification-types) |
| `createdAt` | string | ISO 8601 timestamp                     |
| `actor`     | string | Username of the user who triggered it  |

### Browser example

```js
const es = new EventSource("/notifications/stream", {
  headers: { Authorization: `Bearer ${token}` },
});

es.addEventListener("notification", (e) => {
  const notif = JSON.parse(e.data);
  showToast(`@${notif.actor} — ${notif.type}`);
  refreshBadgeCount();
});

es.onerror = () => {
  // Reconnect after a short delay — EventSource retries automatically,
  // but you can control the backoff by closing and reopening.
};
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

## Push Notifications

Push notifications are delivered out-of-band — they arrive even when the app or tab is closed. Two platforms are supported:

| Platform | Mechanism           | Registration token          |
|----------|---------------------|-----------------------------|
| Web      | Web Push (VAPID)    | Push subscription endpoint  |
| iOS      | APNs (direct)       | APNs device token           |

---

### Get VAPID Public Key

**`GET /notifications/vapid-public-key`** — No auth required.

Returns the VAPID public key needed to create a Web Push subscription in the browser.

#### Response `200`

| Field       | Type   | Description                       |
|-------------|--------|-----------------------------------|
| `publicKey` | string | Base64url-encoded VAPID public key |

```json
{ "publicKey": "BNbZOaim2vExkn..." }
```

#### Browser example

```js
const { publicKey } = await fetch("/notifications/vapid-public-key").then(r => r.json());

const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: publicKey,
});

// Pass the subscription to the register endpoint below
await registerPushDevice("WEB", subscription);
```

---

### Register Push Device

**`POST /notifications/push/register`**

Registers a browser push subscription or an APNs device token for the authenticated user. Safe to call on every app launch — uses upsert so duplicate tokens are not created.

#### Request body

| Field      | Type                | Required           | Description                                     |
|------------|---------------------|--------------------|-------------------------------------------------|
| `platform` | `"WEB"` \| `"IOS"` | ✓                  | Platform type                                   |
| `token`    | string              | ✓                  | Push endpoint URL (WEB) or APNs device token (IOS) |
| `p256dh`   | string              | WEB only           | P-256 DH public key from the push subscription  |
| `auth`     | string              | WEB only           | Auth secret from the push subscription          |

#### Web example

```js
async function registerPushDevice(platform, subscription) {
  const { endpoint, keys } = subscription.toJSON();
  await fetch("/notifications/push/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      platform: "WEB",
      token: endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }),
  });
}
```

#### iOS (Swift) example

```swift
func application(
  _ application: UIApplication,
  didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
) {
  let tokenString = deviceToken.map { String(format: "%02x", $0) }.joined()

  Task {
    try await APIClient.shared.post("/notifications/push/register", body: [
      "platform": "IOS",
      "token": tokenString,
    ])
  }
}
```

#### Response `201`

```json
{ "message": "Device registered" }
```

#### Errors

| Status | Description                                    |
|--------|------------------------------------------------|
| `400`  | `p256dh` or `auth` missing for WEB platform   |
| `401`  | Missing or invalid token                       |
| `503`  | Auth service unreachable                       |

---

### Unregister Push Device

**`DELETE /notifications/push/unregister`**

Removes a push device. Call this on logout, or when the user revokes notification permission.

#### Request body

| Field   | Type   | Required | Description                           |
|---------|--------|----------|---------------------------------------|
| `token` | string | ✓        | The token that was used to register   |

#### Example

```js
await fetch("/notifications/push/unregister", {
  method: "DELETE",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ token: subscription.endpoint }),
});
```

#### Response `200`

```json
{ "message": "Device unregistered" }
```

#### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `503`  | Auth service unreachable |

---

### Push payload format

The notification text is generated server-side. Both platforms receive the same content:

| `type`         | `title`              | `body`                              |
|----------------|----------------------|-------------------------------------|
| `FOLLOW`       | New follower         | `@actor followed you`               |
| `LIKE_POST`    | Post liked           | `@actor liked your post`            |
| `LIKE_COMMENT` | Comment liked        | `@actor liked your comment`         |
| `COMMENT`      | New comment          | `@actor commented on your post`     |
| `REPOST`       | Post reposted        | `@actor reposted your post`         |
| `QUOTE`        | Post quoted          | `@actor quoted your post`           |
| `MENTION`      | You were mentioned   | `@actor mentioned you`              |

Expired or unregistered tokens are automatically removed from the database when a delivery fails — you do not need to handle cleanup on the client.

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
