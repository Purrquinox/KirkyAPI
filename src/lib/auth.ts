import Elysia from "elysia";
import { status } from "elysia";

const AUTH_API_URL = process.env.AUTH_API_URL ?? "https://auth.kirky.app";

export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "scoped" },
  async ({ headers }) => {
    const auth = headers.authorization;
    if (!auth?.startsWith("Bearer ")) return status(401, { error: "Unauthorized" });

    const token = auth.slice(7);
    let data: { active: boolean; sub?: string } | null = null;

    try {
      const res = await fetch(`${AUTH_API_URL}/api/oauth/introspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) data = await res.json();
    } catch {
      return status(503, { error: "Auth service unavailable" });
    }

    if (!data?.active || !data.sub) return status(401, { error: "Unauthorized" });

    return { userId: data.sub };
  }
);
