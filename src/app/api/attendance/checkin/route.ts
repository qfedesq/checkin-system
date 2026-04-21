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

  const existing = await prisma.attendance.findFirst({ where: { userId: session.user.id, checkOutAt: null } });
  if (existing) return NextResponse.json({ error: "Ya tenés una jornada abierta" }, { status: 409 });

  const att = await prisma.attendance.create({
    data: {
      userId: session.user.id,
      checkInAt: new Date(),
      checkInLat: parsed.data.lat,
      checkInLng: parsed.data.lng,
    },
  });
  await recordAudit({ actorId: session.user.id, action: "attendance.checkin", subjectId: att.id });
  return NextResponse.json({ ok: true, id: att.id });
}
