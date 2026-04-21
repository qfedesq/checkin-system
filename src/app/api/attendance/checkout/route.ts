import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

const schema = z.object({ lat: z.number(), lng: z.number() });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const open = await prisma.attendance.findFirst({ where: { userId: session.user.id, checkOutAt: null }, orderBy: { checkInAt: "desc" } });
  if (!open) return NextResponse.json({ error: "No hay jornada abierta" }, { status: 404 });

  const now = new Date();
  const durationMin = Math.max(0, Math.round((now.getTime() - open.checkInAt.getTime()) / 60000));

  const updated = await prisma.attendance.update({
    where: { id: open.id },
    data: {
      checkOutAt: now,
      checkOutLat: parsed.data.lat,
      checkOutLng: parsed.data.lng,
      durationMin,
    },
  });
  await recordAudit({ actorId: session.user.id, action: "attendance.checkout", subjectId: updated.id, metadata: { durationMin } });
  return NextResponse.json({ ok: true, durationMin });
}
