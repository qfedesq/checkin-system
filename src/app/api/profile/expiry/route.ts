import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notify";
import { isEmployeeProfileComplete } from "@/lib/profile";

// Actualiza sólo un vencimiento (libreta o carnet) desde la sección Documentación.
// Misma regla que el perfil: primera carga directa, ediciones posteriores por aprobación.
const body = z.object({ kind: z.enum(["health", "license"]), date: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { kind, date } = parsed.data;
  const field = kind === "health" ? "healthCardExpiry" : "professionalLicenseExpiry";

  const profile = await prisma.employeeProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Completá tus datos en Mi perfil primero." }, { status: 400 });
  if (kind === "license" && profile.category !== "DRIVER") {
    return NextResponse.json({ error: "El carnet profesional es sólo para choferes" }, { status: 400 });
  }

  const newDate = new Date(date);
  if (Number.isNaN(newDate.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  if (!isEmployeeProfileComplete(profile)) {
    await prisma.employeeProfile.update({ where: { userId: session.user.id }, data: { [field]: newDate } });
    await recordAudit({ actorId: session.user.id, action: "profile.expiry.set", subjectId: session.user.id, metadata: { field } });
    return NextResponse.json({ ok: true, completed: true });
  }

  const currentRaw = (profile[field] as Date | null)?.toISOString().slice(0, 10) ?? "";
  const current = field === "healthCardExpiry" && currentRaw.startsWith("2099") ? "" : currentRaw;
  if (current === date) return NextResponse.json({ ok: true, unchanged: true });

  const pending = await prisma.profileChangeRequest.findFirst({ where: { userId: session.user.id, status: "PENDING" } });
  if (pending) return NextResponse.json({ error: "Ya tenés cambios pendientes de aprobación. Esperá a que el administrador los revise." }, { status: 409 });

  const request = await prisma.profileChangeRequest.create({
    data: { userId: session.user.id, changes: { [field]: { from: current, to: date } } },
  });
  await recordAudit({ actorId: session.user.id, action: "profile.change.request", subjectId: request.id, metadata: { fields: [field] } });
  notifyAdmins("profile.change.requested", {
    actorName: `${profile.firstName} ${profile.lastName}`.trim() || null,
    actorEmail: session.user.email ?? "",
    detail: kind === "health" ? "vencimiento libreta" : "vencimiento carnet",
  }).catch((e) => console.error("[notify] expiry", e));

  return NextResponse.json({ ok: true, pendingApproval: true });
}
