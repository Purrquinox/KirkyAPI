# System

System endpoints do not require authentication and are used for health checks and deployment verification.

---

## Endpoints

| Method | Path      | Description                  |
|--------|-----------|------------------------------|
| `GET`  | `/`       | Confirm the API is running   |
| `GET`  | `/health` | Structured health check      |

---

## Root

**`GET /`**

Returns a static confirmation that the API process is running. Use this as a lightweight liveness check.

### Response `200`

```json
{
  "message": "KirkyAPI is running"
}
```

### Example

```bash
curl "https://api.kirky.app/"
```

---

## Health Check

**`GET /health`**

Returns `{ "status": "ok" }` when the server is healthy. Use this in load balancer health checks, uptime monitors, and deployment readiness probes.

Unlike the root endpoint, this is explicitly tagged for monitoring tooling and may be extended in the future to include dependency status (database connectivity, auth service reachability).

### Response `200`

```json
{
  "status": "ok"
}
```

### Example

```bash
curl "https://api.kirky.app/health"
```

### Usage Notes

- **Load balancers** — configure your health check to hit `/health` and expect HTTP `200`.
- **Uptime monitors** — poll `/health` every 30–60 seconds.
- **Deployment readiness** — a successful response to `/health` confirms the process is bound and accepting connections.
