# Users

The Users API provides access to user profiles, the social graph (follow/unfollow), content moderation (block/unblock), and per-user post listings.

**Base path:** `/users`

---

## Endpoints

| Method   | Path                         | Description                          |
|----------|------------------------------|--------------------------------------|
| `GET`    | `/users/me`                  | Get own full profile                 |
| `PATCH`  | `/users/me`                  | Update own profile                   |
| `GET`    | `/users/:username`           | Get a public profile by username     |
| `POST`   | `/users/:username/follow`    | Follow a user                        |
| `DELETE` | `/users/:username/follow`    | Unfollow a user                      |
| `POST`   | `/users/:username/block`     | Block a user                         |
| `DELETE` | `/users/:username/block`     | Unblock a user                       |
| `GET`    | `/users/blocks`              | List blocked users                   |
| `GET`    | `/users/:username/followers` | List a user's followers              |
| `GET`    | `/users/:username/following` | List who a user follows              |
| `GET`    | `/users/:username/posts`     | List a user's published posts        |

> **Route ordering note:** `/users/me` and `/users/blocks` are resolved before `/:username`. Searching for a user with the username `me` or `blocks` would conflict — those usernames should be reserved and disallowed during signup.

---

## Username Rules

Usernames are validated against `^[a-zA-Z0-9_-]{3,20}$`:

- **Length:** 3–20 characters
- **Allowed characters:** letters (a–z, A–Z), digits (0–9), underscore (`_`), hyphen (`-`)
- **Case:** stored as-is; lookups are case-sensitive on profile endpoints
- **Unique:** must be unique across the platform

Valid examples: `janedoe`, `jane_doe`, `jane-doe-99`, `j99`  
Invalid examples: `ja` (too short), `jane doe` (space not allowed), `@janedoe` (@ not allowed)

---

## Get Own Profile

**`GET /users/me`**

Returns the full private account record for the authenticated user, including email, verification status, and profile details.

### Response `200`

| Field  | Type                                      |
|--------|-------------------------------------------|
| `user` | [PrivateUser](data-types.md#privateuser)  |

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
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-06-14T08:00:00.000Z",
      "followersCount": 120,
      "followingCount": 85
    }
  }
}
```

### Example

```bash
curl "https://api.kirky.app/users/me" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                     |
|--------|---------------------------------|
| `401`  | Missing or invalid token        |
| `404`  | User record not found           |
| `503`  | Auth service unreachable        |

---

## Update Own Profile

**`PATCH /users/me`**

Updates the authenticated user's profile. All fields are optional — only the fields you provide are changed.

### Request Body

| Field          | Type           | Constraints                         | Description                          |
|----------------|----------------|-------------------------------------|--------------------------------------|
| `username`     | string         | 3–20 chars, `^[a-zA-Z0-9_-]+$`     | Unique handle                        |
| `firstName`    | string \| null | Max 50 chars                        | Display first name                   |
| `lastName`     | string \| null | Max 50 chars                        | Display last name                    |
| `bio`          | string \| null | Max 500 chars                       | Profile bio                          |
| `website`      | string \| null | Max 255 chars                       | Personal or project URL              |
| `location`     | string \| null | Max 100 chars                       | Location string                      |
| `avatar`           | string \| null | Max 2048 chars                      | Avatar image URL                     |
| `avatarFile`       | file           | Max 10 MB                           | Upload avatar directly; sets `avatar` |
| `bannerImage`      | string \| null | Max 2048 chars                      | Banner image URL                     |
| `bannerImageFile`  | file           | Max 10 MB                           | Upload banner directly; sets `bannerImage` |
| `pinnedPostId` | string \| null | Must be your own published post ID  | Post to pin to the profile           |

Pass `null` explicitly to clear a nullable field (e.g. `"bio": null` removes the bio).

> **Images:** Pass a file via `avatarFile` or `bannerImageFile` to upload and set in one request, or supply a pre-uploaded URL via `avatar` / `bannerImage`. When both are supplied, the file takes precedence. Send as `multipart/form-data` when including a file field. See [Images](images.md).

### Response `200`

| Field     | Type   |
|-----------|--------|
| `profile` | Updated profile fields with follow counts |

```json
{
  "profile": {
    "username": "janedoe",
    "firstName": "Jane",
    "lastName": "Doe",
    "bio": "Updated bio.",
    "website": "https://janedoe.dev",
    "location": "New York, NY",
    "bannerImage": "https://bytepurr.purrquinox.com/kirky/banner123/cover.jpg",
    "avatar": "https://bytepurr.purrquinox.com/kirky/avatar456/photo.jpg",
    "verified": false,
    "updatedAt": "2026-06-14T12:00:00.000Z",
    "followersCount": 120,
    "followingCount": 85
  }
}
```

### Examples

**Update text fields (JSON):**

```bash
curl -X PATCH "https://api.kirky.app/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio": "Building Kirky.", "location": "San Francisco, CA"}'
```

**Upload an avatar and update bio in one request (multipart):**

```bash
curl -X PATCH "https://api.kirky.app/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatarFile=@photo.jpg" \
  -F "bio=Building Kirky."
```

**Upload a banner image:**

```bash
curl -X PATCH "https://api.kirky.app/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -F "bannerImageFile=@banner.jpg"
```

**Set a pre-uploaded URL directly:**

```bash
curl -X PATCH "https://api.kirky.app/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"avatar": "https://bytepurr.purrquinox.com/kirky/abc123/photo.jpg"}'
```

**Pin a post:**

```bash
curl -X PATCH "https://api.kirky.app/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pinnedPostId": "clx1a2b3c"}'
```

**Remove pinned post:**

```bash
curl -X PATCH "https://api.kirky.app/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pinnedPostId": null}'
```

### Errors

| Status | Description                                                           |
|--------|-----------------------------------------------------------------------|
| `401`  | Missing or invalid token                                              |
| `404`  | Profile not found, or `pinnedPostId` does not exist or belong to you  |
| `502`  | CDN rejected the avatar or banner image upload                        |
| `503`  | Auth service unreachable                                              |

---

## Get Public Profile

**`GET /users/:username`**

Returns the public profile for any user by their username. Includes social graph context (`isFollowing`, `isBlocked`) relative to the authenticated user, and the user's pinned post if set.

### Path Parameters

| Parameter  | Type   | Description       |
|------------|--------|-------------------|
| `username` | string | The user's handle |

### Response `200`

| Field     | Type                                            |
|-----------|-------------------------------------------------|
| `profile` | [PublicProfile](data-types.md#publicprofile)    |

```json
{
  "profile": {
    "username": "elias",
    "firstName": "Elias",
    "lastName": "Mercer",
    "avatar": "https://cdn.kirky.app/avatars/elias.jpg",
    "bio": "Making Kirky.",
    "website": "https://kirky.app",
    "location": "San Francisco, CA",
    "bannerImage": null,
    "verified": true,
    "createdAt": "2025-12-01T00:00:00.000Z",
    "followersCount": 5400,
    "followingCount": 210,
    "isFollowing": true,
    "isBlocked": false,
    "pinnedPost": null
  }
}
```

### Example

```bash
curl "https://api.kirky.app/users/elias" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `404`  | Username not found       |
| `503`  | Auth service unreachable |

---

## Follow a User

**`POST /users/:username/follow`**

Follows the given user and sends them a `FOLLOW` notification. You cannot follow yourself.

### Path Parameters

| Parameter  | Type   | Description                  |
|------------|--------|------------------------------|
| `username` | string | Handle of the user to follow |

### Response `201`

```json
{ "message": "Following @elias" }
```

### Example

```bash
curl -X POST "https://api.kirky.app/users/elias/follow" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                 |
|--------|-----------------------------|
| `400`  | Cannot follow yourself      |
| `401`  | Missing or invalid token    |
| `404`  | Username not found          |
| `409`  | Already following this user |
| `503`  | Auth service unreachable    |

---

## Unfollow a User

**`DELETE /users/:username/follow`**

Removes a follow relationship. No notification is sent on unfollow.

### Response `200`

```json
{ "message": "Unfollowed @elias" }
```

### Example

```bash
curl -X DELETE "https://api.kirky.app/users/elias/follow" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                          |
|--------|--------------------------------------|
| `401`  | Missing or invalid token             |
| `404`  | Username not found, or not following |
| `503`  | Auth service unreachable             |

---

## Block a User

**`POST /users/:username/block`**

Blocks the given user. All existing follow relationships between the two accounts (in both directions) are removed atomically. You cannot block yourself.

Blocking does not prevent the blocked user from viewing public posts — it only affects feeds and the relationship state returned in profile lookups.

### Response `201`

```json
{ "message": "Blocked @someuser" }
```

### Example

```bash
curl -X POST "https://api.kirky.app/users/someuser/block" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                |
|--------|----------------------------|
| `400`  | Cannot block yourself      |
| `401`  | Missing or invalid token   |
| `404`  | Username not found         |
| `409`  | Already blocking this user |
| `503`  | Auth service unreachable   |

---

## Unblock a User

**`DELETE /users/:username/block`**

Removes a block. Previously removed follow relationships are not restored.

### Response `200`

```json
{ "message": "Unblocked @someuser" }
```

### Example

```bash
curl -X DELETE "https://api.kirky.app/users/someuser/block" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description                         |
|--------|-------------------------------------|
| `401`  | Missing or invalid token            |
| `404`  | Username not found, or not blocking |
| `503`  | Auth service unreachable            |

---

## List Blocked Users

**`GET /users/blocks`**

Returns the list of users blocked by the authenticated user, in reverse chronological order (most recently blocked first).

### Query Parameters

| Parameter | Type    | Default | Maximum |
|-----------|---------|---------|---------|
| `limit`   | integer | `20`    | `100`   |
| `offset`  | integer | `0`     | —       |

### Response `200`

| Field      | Type                                              |
|------------|---------------------------------------------------|
| `profiles` | [ProfileSummary](data-types.md#profilesummary)[]  |
| `total`    | number                                            |

### Example

```bash
curl "https://api.kirky.app/users/blocks" \
  -H "Authorization: Bearer $TOKEN"
```

---

## List Followers

**`GET /users/:username/followers`**

Returns users who follow the given account, in reverse chronological order (most recently followed first).

### Query Parameters

| Parameter | Type    | Default | Maximum |
|-----------|---------|---------|---------|
| `limit`   | integer | `20`    | `100`   |
| `offset`  | integer | `0`     | —       |

### Response `200`

| Field      | Type                                              |
|------------|---------------------------------------------------|
| `profiles` | [ProfileSummary](data-types.md#profilesummary)[]  |
| `total`    | number                                            |

### Example

```bash
curl "https://api.kirky.app/users/elias/followers?limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `404`  | Username not found       |
| `503`  | Auth service unreachable |

---

## List Following

**`GET /users/:username/following`**

Returns users that the given account follows, in reverse chronological order.

### Query Parameters

| Parameter | Type    | Default | Maximum |
|-----------|---------|---------|---------|
| `limit`   | integer | `20`    | `100`   |
| `offset`  | integer | `0`     | —       |

### Response `200`

| Field      | Type                                              |
|------------|---------------------------------------------------|
| `profiles` | [ProfileSummary](data-types.md#profilesummary)[]  |
| `total`    | number                                            |

### Example

```bash
curl "https://api.kirky.app/users/elias/following" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `404`  | Username not found       |
| `503`  | Auth service unreachable |

---

## List User's Posts

**`GET /users/:username/posts`**

Returns published posts by the given user, sorted newest first. Drafts are never included.

### Path Parameters

| Parameter  | Type   | Description       |
|------------|--------|-------------------|
| `username` | string | The user's handle |

### Query Parameters

| Parameter | Type    | Default | Maximum |
|-----------|---------|---------|---------|
| `limit`   | integer | `20`    | `100`   |
| `offset`  | integer | `0`     | —       |

### Response `200`

| Field   | Type                          |
|---------|-------------------------------|
| `posts` | [Post](data-types.md#post)[]  |
| `total` | number                        |

### Example

```bash
curl "https://api.kirky.app/users/elias/posts?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Errors

| Status | Description              |
|--------|--------------------------|
| `401`  | Missing or invalid token |
| `404`  | Username not found       |
| `503`  | Auth service unreachable |
