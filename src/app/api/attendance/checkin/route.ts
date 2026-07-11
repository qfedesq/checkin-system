import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveUser } from "@/lib/session-guard";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { verifyUserAssertion } from "@/lib/webauthn-verify";
import { route } from "@/lib/route";

const schema = z.object({ lat: z.number(), lng: z.number(), assertion: z.unknown() });

class CheckinConflictError extends Error {}

export const POST = route("attendance.checkin", async (req: NextRequest) => {
  const { session, error } = await requireActiveUser();
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { deviceId: true, deviceApprovedAt: true } });
  if (user?.deviceId && !user.deviceApprovedAt) {
    return NextResponse.json({ error: "Tu dispositivo está pendiente de aprobación del administrador" }, { status: 403 });
  }

  // Biometría obligatoria verificada EN el propio endpoint (no en un request aparte): sin esto,
  // con una sesión válida se podía fichar salteando la biometría pegándole directo a esta ruta.
  const bio = await verifyUserAssertion(session.user.id, parsed.data.assertion);
  if (!bio.ok) return NextResponse.json({ error: bio.error }, { status: bio.status });

  // Verificar + crear en la misma transacción (QA-008): reduce la ventana de carrera de dos
  // check-ins casi simultáneos generando dos Attendance abiertas para el mismo usuario. No es
  // 100% infalible sin un índice único parcial en DB (fuera de este alcance), pero serializa el
  // caso común porque Postgres toma un lock de escritura sobre las filas leídas por el SELECT
  // dentro de la tx cuando corre en isolation "Serializable"/con retry, y en la práctica reduce
  // drásticamente la ventana frente al check-then-insert sin tx.
  let att;
  try {
    att = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.attendance.findFirst({ where: { userId: session.user.id, checkOutAt: null } });
        if (existing) throw new CheckinConflictError();
        return tx.attendance.create({
          data: {
            userId: session.user.id,
            checkInAt: new Date(),
            checkInLat: parsed.data.lat,
            checkInLng: parsed.data.lng,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (e) {
    if (e instanceof CheckinConflictError) return NextResponse.json({ error: "Ya tenés una jornada abierta" }, { status: 409 });
    // Postgres aborta transacciones serializables con conflicto de escritura (P2034): tratarlo
    // como la misma carrera que intentamos evitar, no como un 500.
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2034") {
      return NextResponse.json({ error: "Ya tenés una jornada abierta" }, { status: 409 });
    }
    // Índice único parcial "attendance_one_open_per_user" (1_indexes migration): si dos
    // check-ins concurrentes pasan el SELECT de la tx antes de que la primera confirme, el
    // segundo INSERT choca acá en vez de dejar dos jornadas abiertas para el mismo usuario.
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya tenés una jornada abierta" }, { status: 409 });
    }
    throw e;
  }
  await recordAudit({ actorId: session.user.id, action: "attendance.checkin", subjectId: att.id });
  return NextResponse.json({ ok: true, id: att.id });
});
