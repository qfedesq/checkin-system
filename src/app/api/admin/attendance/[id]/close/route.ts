import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { route } from "@/lib/route";

// Check-out por el admin (QA-008): el empleado se olvidó de fichar salida (o quedó una jornada
// huérfana). El admin cierra el Attendance abierto (checkOutAt null) indicando la HORA REAL de
// salida (o la actual por defecto). Sin geocerca ni biometría: es una corrección administrativa.
// updateMany con guard checkOutAt:null → idempotente si dos admins la cierran a la vez.
export const POST = route("admin.attendance.close", async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const open = await prisma.attendance.findUnique({ where: { id } });
  if (!open) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (open.checkOutAt) return NextResponse.json({ error: "Esa jornada ya está cerrada" }, { status: 409 });

  const now = new Date();
  const body = (await req.json().catch(() => ({}))) as { checkOutAt?: string };
  let checkOut = now;
  if (typeof body.checkOutAt === "string" && body.checkOutAt) {
    const d = new Date(body.checkOutAt);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    if (d.getTime() <= open.checkInAt.getTime()) return NextResponse.json({ error: "La salida debe ser posterior al check-in" }, { status: 400 });
    if (d.getTime() > now.getTime() + 60_000) return NextResponse.json({ error: "La salida no puede ser en el futuro" }, { status: 400 });
    checkOut = d;
  }
  const durationMin = Math.max(0, Math.round((checkOut.getTime() - open.checkInAt.getTime()) / 60000));

  const result = await prisma.attendance.updateMany({
    where: { id, checkOutAt: null },
    data: {
      checkOutAt: checkOut,
      durationMin,
    },
  });
  if (result.count === 0) return NextResponse.json({ error: "Esa jornada ya está cerrada" }, { status: 409 });

  await recordAudit({ actorId: session.user.id, action: "attendance.close.manual", subjectId: id, metadata: { durationMin, at: checkOut.toISOString(), by: "admin" } });
  return NextResponse.json({ ok: true });
});
