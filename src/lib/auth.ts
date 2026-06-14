import Elysia from "elysia";
import { status } from "elysia";

const AUTH_API_URL = process.env.AUTH_API_URL ?? "https://auth.kirky.app";

const log = (msg: string) => console.log(`[${new Date().toISOString()}] [auth] ${msg}`);

type IntrospectResult = { active: boolean; sub?: string };

const authCache = new WeakMap<Request, IntrospectResult | null>();

export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "scoped" },
  async ({ headers, request }) => {
    const auth = headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      log("Missing or malformed Authorization header");
      return status(401, { error: "Unauthorized" });
    }

    const token = auth.slice(7);
    const tokenPreview = `${token.slice(0, 8)}...${token.slice(-4)}`;

    if (authCache.has(request)) {
      const cached = authCache.get(request)!;
      if (!cached?.active || !cached.sub) return status(401, { error: "Unauthorized" });
      log(`[cached] Authenticated user: ${cached.sub} (token: ${tokenPreview})`);
      return { userId: cached.sub };
    }

    log(`Verifying token: ${tokenPreview}`);

    let data: IntrospectResult | null = null;

    try {
      // Try OAuth introspect first (developer tokens have client_id)
      const introspectRes = await fetch(`${AUTH_API_URL}/api/oauth/introspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!introspectRes.ok) {
        log(`Introspect request failed — HTTP ${introspectRes.status}`);
        return status(503, { error: "Auth service unavailable" });
      }

      const introspectData = await introspectRes.json();
      log(`OAuth introspect: active=${introspectData?.active} sub=${introspectData?.sub ?? "none"}`);

      if (introspectData?.active && introspectData.sub) {
        data = { active: true, sub: introspectData.sub };
      } else {
        // Fall back to internal JWT — call the profile endpoint with the Bearer token
        const profileRes = await fetch(`${AUTH_API_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (profileRes.status === 401 || profileRes.status === 403) {
          data = { active: false };
        } else if (!profileRes.ok) {
          log(`Profile request failed — HTTP ${profileRes.status}`);
          return status(503, { error: "Auth service unavailable" });
        } else {
          const profileData = await profileRes.json();
          const sub = profileData?.user?.id;
          log(`Internal JWT profile: sub=${sub ?? "none"}`);
          data = sub ? { active: true, sub } : { active: false };
        }
      }
    } catch (err) {
      log(`Auth service unreachable: ${err instanceof Error ? err.message : String(err)}`);
      return status(503, { error: "Auth service unavailable" });
    }

    authCache.set(request, data);

    if (!data?.active || !data.sub) {
      log(`Token invalid or inactive — rejecting request`);
      return status(401, { error: "Unauthorized" });
    }

    log(`Authenticated user: ${data.sub} (token: ${tokenPreview})`);
    return { userId: data.sub };
  }
);