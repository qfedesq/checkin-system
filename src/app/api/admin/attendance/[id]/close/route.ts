import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";

// Cierre manual de una jornada huérfana (QA-008): el admin puede cerrar un Attendance que quedó
// abierto (checkOutAt null) — p.ej. por una carrera de check-in o porque el empleado nunca
// hizo check-out. Usa updateMany con el guard checkOutAt:null para que sea idempotente si dos
// admins la cierran a la vez.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const open = await prisma.attendance.findUnique({ where: { id } });
  if (!open) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (open.checkOutAt) return NextResponse.json({ error: "Esa jornada ya está cerrada" }, { status: 409 });

  const now = new Date();
  const durationMin = Math.max(0, Math.round((now.getTime() - open.checkInAt.getTime()) / 60000));

  const result = await prisma.attendance.updateMany({
    where: { id, checkOutAt: null },
    data: {
      checkOutAt: now,
      durationMin,
    },
  });
  if (result.count === 0) return NextResponse.json({ error: "Esa jornada ya está cerrada" }, { status: 409 });

  await recordAudit({ actorId: session.user.id, action: "attendance.close.manual", subjectId: id, metadata: { durationMin } });
  return NextResponse.json({ ok: true });
}
