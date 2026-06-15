import webpush from "web-push";
import { createSign } from "node:crypto";
import { prisma } from "./prisma";
import { PushPlatform } from "../generated/prisma";

// VAPID setup — skipped if env vars are missing (e.g. local dev without web push)
let vapidReady = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  vapidReady = true;
}

// APNs JWT — Apple allows up to 60 min, we refresh at 55 to be safe
let apnsJWTCache: { value: string; expiresAt: number } | null = null;

function getAPNsJWT(): string {
  if (apnsJWTCache && Date.now() < apnsJWTCache.expiresAt) return apnsJWTCache.value;

  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: process.env.APN_KEY_ID! })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: process.env.APN_TEAM_ID!, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const unsigned = `${header}.${payload}`;

  const sign = createSign("SHA256");
  sign.update(unsigned);
  // APNs requires IEEE P1363 (raw r||s), not DER
  const sig = sign.sign({ key: process.env.APN_PRIVATE_KEY!, dsaEncoding: "ieee-p1363" }).toString("base64url");

  const token = `${unsigned}.${sig}`;
  apnsJWTCache = { value: token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

async function sendAPNs(deviceToken: string, title: string, body: string): Promise<void> {
  const host = process.env.APN_PRODUCTION === "true"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";

  const res = await fetch(`${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${getAPNsJWT()}`,
      "apns-topic": process.env.APN_BUNDLE_ID!,
      "apns-push-type": "alert",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: { alert: { title, body }, sound: "default" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let reason = "";
    try { reason = JSON.parse(text).reason; } catch { /* not JSON */ }
    if (res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered") {
      await prisma.pushDevice.deleteMany({ where: { token: deviceToken } });
    } else {
      console.error(`APNs ${res.status} ${reason || text}`);
    }
  }
}

async function sendWebPush(endpoint: string, p256dh: string, auth: string, title: string, body: string): Promise<void> {
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify({ title, body }),
    );
  } catch (err: any) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await prisma.pushDevice.deleteMany({ where: { token: endpoint } });
    } else {
      console.error("Web push error:", err.message);
    }
  }
}

export async function dispatchPush(userId: string, title: string, body: string): Promise<void> {
  const apnsReady = !!(
    process.env.APN_PRIVATE_KEY &&
    process.env.APN_KEY_ID &&
    process.env.APN_TEAM_ID &&
    process.env.APN_BUNDLE_ID
  );

  const devices = await prisma.pushDevice.findMany({ where: { userId } });

  await Promise.allSettled(
    devices.map(d => {
      if (d.platform === PushPlatform.IOS) {
        if (!apnsReady) return Promise.resolve();
        return sendAPNs(d.token, title, body);
      }
      if (!vapidReady || !d.p256dh || !d.auth) return Promise.resolve();
      return sendWebPush(d.token, d.p256dh, d.auth, title, body);
    }),
  );
}
