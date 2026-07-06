import "server-only";
import webpush from "web-push";
import { prisma } from "./prisma";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:emmalvasas@gmail.com";

let configured = false;
function ensureConfigured(): boolean {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) {
    console.log(`[push:stub] user=${userId} title="${payload.title}"`);
    return { ok: false, stub: true as const };
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { ok: false, noSubscriptions: true as const };

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      ),
    ),
  );

  // Suscripciones muertas (endpoint dado de baja por el navegador): 404/410
  const deadEndpoints: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const statusCode = (r.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) deadEndpoints.push(subs[i].endpoint);
      else console.error(`[push] error sending to ${subs[i].endpoint.slice(0, 60)}…`, r.reason);
    }
  });
  if (deadEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: deadEndpoints } } }).catch(() => {});
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  if (sent > 0) {
    await prisma.pushSubscription.updateMany({
      where: { userId },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});
  }
  return { ok: sent > 0, sent };
}
