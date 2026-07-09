import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { logError } from "@/lib/log";

// A las 7 h 45 m del check-in sin check-out, preguntar si sigue prestando servicio.
const REMINDER_AFTER_MIN = 7 * 60 + 45;
const BATCH_SIZE = 10;

async function processInBatches<T>(items: T[], fn: (item: T) => Promise<void>, size = BATCH_SIZE) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

// QA-021: fail-closed (sin CRON_SECRET configurado, nadie pasa) + comparación timing-safe.
// Header preferido: Authorization: Bearer <secret>. Se acepta ?key= como fallback.
function isAuthorized(req: NextRequest): boolean {
  const secretEnv = process.env.CRON_SECRET;
  if (!secretEnv) return false;

  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : req.nextUrl.searchParams.get("key") ?? "";

  const a = Buffer.from(provided);
  const b = Buffer.from(secretEnv);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    return await runCheckoutReminder();
  } catch (err) {
    logError("cron.checkout-reminder", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function runCheckoutReminder() {
  const threshold = new Date(Date.now() - REMINDER_AFTER_MIN * 60 * 1000);

  const open = await prisma.attendance.findMany({
    where: {
      checkOutAt: null,
      checkoutReminderSentAt: null,
      checkInAt: { lte: threshold },
      user: { status: "ACTIVE" },
    },
    select: { id: true, userId: true, checkInAt: true },
  });

  let notified = 0;
  await processInBatches(open, async (a) => {
    await notifyUser(a.userId, "attendance.checkout.reminder", {
      body: `Pasaron 7 h 45 m desde tu check-in de las ${a.checkInAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}. ¿Seguís prestando servicio? Si ya terminaste tu jornada, no olvides hacer el check-out.`,
    });
    await prisma.attendance.update({ where: { id: a.id }, data: { checkoutReminderSentAt: new Date() } });
    notified++;
  });

  return NextResponse.json({ ok: true, notified });
}
