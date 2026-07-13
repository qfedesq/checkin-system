import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveUser } from "@/lib/session-guard";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { verifyUserAssertion } from "@/lib/webauthn-verify";
import { distanceMeters } from "@/lib/geo";
import { route } from "@/lib/route";

const schema = z.object({ lat: z.number(), lng: z.number(), assertion: z.unknown() });

export const POST = route("attendance.checkout", async (req: NextRequest) => {
  const { session, error } = await requireActiveUser();
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  // Biometría obligatoria verificada en el propio endpoint (ver checkin).
  const bio = await verifyUserAssertion(session.user.id, parsed.data.assertion);
  if (!bio.ok) return NextResponse.json({ error: bio.error }, { status: bio.status });

  // Geocerca de check-out: independiente de la de check-in (el empleado puede salir en otro
  // lugar). Si el admin fijó una zona (checkoutLat/Lng) en el perfil, sólo se puede cerrar la
  // jornada dentro de checkoutRadiusM metros de ese punto. Sin zona seteada, se permite desde
  // cualquier lado (compatibilidad con perfiles existentes, igual que check-in).
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId: session.user.id },
    select: { checkoutLat: true, checkoutLng: true, checkoutRadiusM: true },
  });
  if (profile?.checkoutLat != null && profile?.checkoutLng != null) {
    const distance = distanceMeters(profile.checkoutLat, profile.checkoutLng, parsed.data.lat, parsed.data.lng);
    if (distance > profile.checkoutRadiusM) {
      return NextResponse.json(
        { error: `Estás fuera de la zona permitida para el check-out (a ${Math.round(distance)}m de la zona). Acercate al lugar de salida.` },
        { status: 403 }
      );
    }
  }

  const open = await prisma.attendance.findFirst({ where: { userId: session.user.id, checkOutAt: null }, orderBy: { checkInAt: "desc" } });
  if (!open) return NextResponse.json({ error: "No hay jornada abierta" }, { status: 404 });

  const now = new Date();
  const durationMin = Math.max(0, Math.round((now.getTime() - open.checkInAt.getTime()) / 60000));

  // Guard de idempotencia (mismo espíritu que el índice único de check-in): el WHERE con
  // checkOutAt:null hace que, si dos checkout casi simultáneos leen la misma jornada abierta,
  // sólo uno la cierre — el otro ve count===0 en vez de pisar los datos del primero.
  const result = await prisma.attendance.updateMany({
    where: { id: open.id, checkOutAt: null },
    data: {
      checkOutAt: now,
      checkOutLat: parsed.data.lat,
      checkOutLng: parsed.data.lng,
      durationMin,
    },
  });
  if (result.count === 0) return NextResponse.json({ error: "La jornada ya fue cerrada" }, { status: 409 });
  await recordAudit({ actorId: session.user.id, action: "attendance.checkout", subjectId: open.id, metadata: { durationMin } });
  // La duración queda en DB (visible sólo al admin); al empleado sólo le confirmamos el cierre.
  return NextResponse.json({ ok: true });
});
