import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

// A las 7 h 45 m del check-in sin check-out, preguntar si sigue prestando servicio.
const REMINDER_AFTER_MIN = 7 * 60 + 45;
const BATCH_SIZE = 10;

async function processInBatches<T>(items: T[], fn: (item: T) => Promise<void>, size = BATCH_SIZE) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization") ?? req.nextUrl.searchParams.get("key");
  if (process.env.CRON_SECRET && secret !== `Bearer ${process.env.CRON_SECRET}` && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
