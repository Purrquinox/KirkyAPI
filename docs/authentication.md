# Authentication

The Kirky API delegates all identity management to **KirkyAuth** (`https://auth.kirky.app`). Every request to the Kirky API must include a valid Bearer token. The API validates tokens by calling the KirkyAuth introspection endpoint on each request.

---

## Token Lifecycle

| Token         | Type           | Lifetime   | Storage recommendation                       |
|---------------|----------------|------------|----------------------------------------------|
| Access token  | JWT            | 15 minutes | In-memory only — never write to disk or localStorage |
| Refresh token | Opaque string  | 7 days     | Keychain (iOS/macOS) · HttpOnly cookie (web) |

Refresh tokens are **not rotated** on use. A new access token is issued each time you call the refresh endpoint; the same refresh token remains valid until it expires or is explicitly revoked via logout.

### Refresh Strategy

Do not proactively refresh before every request. Call the API with your current token; if you receive a `401`, refresh and retry once:

```
┌─ Make API request ──────────────────────────────────────────┐
│                                                              │
│  Response 200-299 → success                                  │
│                                                              │
│  Response 401 ──→ POST /auth/refresh                         │
│                       │                                      │
│                       ├─ 200 (new accessToken) → retry once  │
│                       │                                      │
│                       └─ 401 (refresh expired) → re-login    │
│                                                              │
│  Response 503 → transient auth outage; retry after delay     │
└──────────────────────────────────────────────────────────────┘
```

Never redirect to login on a `503` — the auth service was simply unreachable when your token was being validated. Retry with the same token after a brief backoff.

---

## Authorization Header

Include the access token on every API request:

```http
Authorization: Bearer <access_token>
```

Requests missing this header, or with a malformed or expired token, return `401 Unauthorized`.

---

## Auth Endpoints

All auth endpoints are hosted at `https://auth.kirky.app`.

---

### Sign Up

**`POST /auth/signup`**

Creates a new account with email and password. Returns both tokens immediately. An email verification message is sent, but email verification is **not required** to use the API.

#### Request body

| Field      | Type   | Required | Constraints             |
|------------|--------|----------|-------------------------|
| `email`    | string | Yes      | Must be unique          |
| `password` | string | Yes      | Minimum 8 characters    |
| `username` | string | Yes      | 3–20 chars, `^[a-zA-Z0-9_-]+$` |

#### Response `201`

```json
{
  "message": "Account created",
  "user": {
    "id": "clx1a2b3c",
    "email": "user@example.com",
    "username": "janedoe",
    "firstName": null,
    "lastName": null
  },
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "requiresEmailVerification": true
}
```

#### Example

```bash
curl -X POST "https://auth.kirky.app/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "password": "hunter2secret",
    "username": "janedoe"
  }'
```

---

### Log In

**`POST /auth/login`**

Authenticates with email and password. Returns both tokens.

#### Request body

| Field      | Type   | Required |
|------------|--------|----------|
| `email`    | string | Yes      |
| `password` | string | Yes      |

#### Response `200`

```json
{
  "message": "Login successful",
  "user": {
    "id": "clx1a2b3c",
    "email": "user@example.com",
    "username": "janedoe",
    "firstName": "Jane",
    "lastName": "Doe"
  },
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>"
}
```

#### Example

```bash
curl -X POST "https://auth.kirky.app/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@example.com", "password": "hunter2secret"}'
```

#### Error codes

| Status | Code                  | Trigger                                  |
|--------|-----------------------|------------------------------------------|
| `401`  | `INVALID_CREDENTIALS` | Wrong email or password                  |
| `403`  | `ACCOUNT_DISABLED`    | Account has been deactivated             |
| `429`  | `ACCOUNT_LOCKED`      | 5 consecutive failures → 15-min lockout  |

---

### Apple Sign-In

**`POST /auth/apple`**

Authenticates using Apple's identity token. On first sign-in, pass the `user` object from Apple's SDK response to populate name fields — Apple only provides this object on the very first authorization.

#### Request body

| Field           | Type   | Required           | Description                              |
|-----------------|--------|--------------------|------------------------------------------|
| `identityToken` | string | Yes                | JWT from Apple's SDK                     |
| `user`          | object | First sign-in only | `{ firstName, lastName, email }` from Apple |

#### Response `200`

```json
{
  "message": "Login successful",
  "user": {
    "id": "clx1a2b3c",
    "email": "user@privaterelay.appleid.com",
    "username": "janedoe",
    "firstName": "Jane",
    "lastName": "Doe"
  },
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "isNewUser": true
}
```

`isNewUser: true` on the first sign-in. Use this to decide whether to show an onboarding screen.

#### Example (Swift / iOS)

```swift
// After receiving ASAuthorization from Apple:
let credential = authorization.credential as! ASAuthorizationAppleIDCredential
let identityToken = String(data: credential.identityToken!, encoding: .utf8)!

var body: [String: Any] = ["identityToken": identityToken]

// Only on first sign-in — Apple omits user info on subsequent authorizations
if let fullName = credential.fullName {
    body["user"] = [
        "firstName": fullName.givenName ?? "",
        "lastName": fullName.familyName ?? ""
    ]
}
```

---

### GitHub OAuth — Authorize

**`GET /auth/github/authorize`**

Returns the GitHub authorization URL and a CSRF state token. Redirect the user to `url` to begin the OAuth flow.

#### Response `200`

```json
{
  "url": "https://github.com/login/oauth/authorize?client_id=...",
  "state": "<csrf_state>"
}
```

#### GitHub OAuth Flow (SPA / Mobile)

```
1. GET /auth/github/authorize
   → { url, state }

2. Redirect user to `url`
   → User authorizes on GitHub
   → GitHub redirects to your redirect_uri?code=CODE&state=STATE

3. Verify STATE matches what you stored in step 1 (CSRF check)

4. POST /auth/github/callback  { code: CODE, state: STATE }
   → { accessToken, refreshToken, isNewUser }
```

Store `state` in session storage (web) or memory (mobile) between steps 1 and 3. Never skip the state verification — it prevents CSRF attacks.

#### Example

```bash
curl "https://auth.kirky.app/auth/github/authorize"
```

---

### GitHub OAuth — Callback

**`POST /auth/github/callback`**

Exchange the GitHub authorization code for Kirky tokens.

#### Request body

| Field   | Type   | Required |
|---------|--------|----------|
| `code`  | string | Yes      |
| `state` | string | Yes      |

#### Response `200`

```json
{
  "message": "Login successful",
  "user": {
    "id": "clx1a2b3c",
    "email": "user@example.com",
    "username": "janedoe",
    "firstName": "Jane",
    "lastName": "Doe"
  },
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "isNewUser": false
}
```

#### Example

```bash
curl -X POST "https://auth.kirky.app/auth/github/callback" \
  -H "Content-Type: application/json" \
  -d '{"code": "GITHUB_CODE", "state": "STATE_FROM_STEP_1"}'
```

---

### Refresh Token

**`POST /auth/refresh`**

Exchange a valid refresh token for a new access token. The refresh token itself is unchanged.

#### Request body

| Field          | Type   | Required |
|----------------|--------|----------|
| `refreshToken` | string | Yes      |

#### Response `200`

```json
{
  "accessToken": "<new_jwt>"
}
```

#### Example

```bash
curl -X POST "https://auth.kirky.app/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<your_refresh_token>"}'
```

---

### Log Out

**`POST /auth/logout`**

Revokes the refresh token server-side. The access token remains technically valid until its 15-minute TTL expires — this is by design. Invalidate it client-side by deleting it from memory immediately.

#### Request body

| Field          | Type   | Required |
|----------------|--------|----------|
| `refreshToken` | string | Yes      |

#### Response `200`

```json
{
  "message": "Logged out"
}
```

#### Example

```bash
curl -X POST "https://auth.kirky.app/auth/logout" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<your_refresh_token>"}'
```

---

### Forgot Password

**`POST /auth/forgot-password`**

Sends a password reset email. Always returns `200` regardless of whether the email is registered, to prevent user enumeration attacks.

#### Request body

| Field   | Type   | Required |
|---------|--------|----------|
| `email` | string | Yes      |

Reset tokens expire in **1 hour** and are single-use.

#### Response `200`

```json
{
  "message": "If that email is registered, a reset link has been sent"
}
```

#### Example

```bash
curl -X POST "https://auth.kirky.app/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@example.com"}'
```

---

## Security Reference

| Behavior             | Details                                                                         |
|----------------------|---------------------------------------------------------------------------------|
| Brute-force guard    | 5 failed logins triggers a 15-minute account lockout (`429 ACCOUNT_LOCKED`)     |
| Rate limiting        | 100 requests per minute per IP                                                  |
| Apple tokens         | Decoded without signature verification — suitable for mobile SDK flow only      |
| Password reset       | Token expires in 1 hour; single-use                                             |
| Refresh token        | Not rotated on use; revoked explicitly via `POST /auth/logout`                  |
| Access token storage | Keep in memory only — never write to `localStorage`, disk, or logs              |
| Refresh token storage| Keychain (iOS/macOS), HttpOnly + Secure + SameSite=Strict cookie (web)          |
