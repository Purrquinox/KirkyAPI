import Elysia from "elysia";
import { status } from "elysia";

const AUTH_API_URL = process.env.AUTH_API_URL ?? "https://auth.kirky.app";

const log = (msg: string) => console.log(`[${new Date().toISOString()}] [auth] ${msg}`);

export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "scoped" },
  async ({ headers }) => {
    const auth = headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      log("Missing or malformed Authorization header");
      return status(401, { error: "Unauthorized" });
    }

    const token = auth.slice(7);
    const tokenPreview = `${token.slice(0, 8)}...${token.slice(-4)}`;
    log(`Introspecting token: ${tokenPreview}`);

    let data: { active: boolean; sub?: string } | null = null;

    try {
      const res = await fetch(`${AUTH_API_URL}/api/oauth/introspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        log(`Introspect request failed — HTTP ${res.status}`);
        return status(503, { error: "Auth service unavailable" });
      }

      data = await res.json();
      log(`Introspect response: active=${data?.active} sub=${data?.sub ?? "none"}`);
    } catch (err) {
      log(`Auth service unreachable: ${err instanceof Error ? err.message : String(err)}`);
      return status(503, { error: "Auth service unavailable" });
    }

    if (!data?.active || !data.sub) {
      log(`Token invalid or inactive — rejecting request`);
      return status(401, { error: "Unauthorized" });
    }

    log(`Authenticated user: ${data.sub} (token: ${tokenPreview})`);
    return { userId: data.sub };
  }
);
