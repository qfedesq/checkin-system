import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { route } from "@/lib/route";

const DATE_FIELDS = ["dob", "professionalLicenseExpiry", "healthCardExpiry"];

const FIELD_LABELS: Record<string, string> = {
  lastName: "Apellido",
  firstName: "Nombre",
  dob: "Fecha de nacimiento",
  category: "Categoría",
  phone: "Teléfono",
  professionalLicenseExpiry: "Venc. carnet profesional",
  healthCardExpiry: "Venc. libreta sanitaria",
  shirtSize: "Talle remera",
  hoodieSize: "Talle buzo",
  jacketSize: "Talle campera",
  pantsSize: "Talle pantalón",
  shoeSize: "Talle calzado",
  address: "Dirección",
  addressNumber: "Numeración",
  neighborhood: "Barrio",
  city: "Localidad",
  postalCode: "Código postal",
  emergencyContact: "Contacto de emergencia",
  emergencyPhone: "Tel. de emergencia",
  // Imágenes (la lógica de aplicar ya funciona para strings).
  faceImageBlobUrl: "Foto de frente",
  signatureBlobUrl: "Firma",
  dniFrontBlobUrl: "DNI (frente)",
  dniBackBlobUrl: "DNI (dorso)",
  licenseFrontBlobUrl: "Carnet (frente)",
  licenseBackBlobUrl: "Carnet (dorso)",
  healthCardFrontBlobUrl: "Libreta (frente)",
  healthCardBackBlobUrl: "Libreta (dorso)",
};

function labelsOf(fields: string[]): string {
  return fields.map((f) => FIELD_LABELS[f] ?? f).join(", ");
}

export const POST = route("admin.profile-changes.approve", async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const request = await prisma.profileChangeRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (request.status !== "PENDING") return NextResponse.json({ error: "La solicitud ya fue revisada" }, { status: 409 });

  const changes = request.changes as Record<string, { from: string; to: string }>;
  const allFields = Object.keys(changes);

  const body = await req.json().catch(() => ({}));
  // Compatibilidad: si no viene approvedFields, se aprueban todos los campos (comportamiento anterior).
  const approvedFields = Array.isArray(body?.approvedFields)
    ? (body.approvedFields as unknown[]).filter((f): f is string => typeof f === "string" && f in changes)
    : allFields;
  const rejectedFields = allFields.filter((f) => !approvedFields.includes(f));

  const data: Record<string, unknown> = {};
  for (const field of approvedFields) {
    const to = changes[field].to;
    data[field] = DATE_FIELDS.includes(field) ? (to ? new Date(to) : null) : to;
  }

  // Re-validación de unicidad por si alguno de los campos aprobados toca dni/cuil/legajo/email.
  // Hoy el empleado no puede proponer cambios en esos campos (EDITABLE_FIELDS en /api/profile no
  // los incluye), pero dejamos la protección para no romper si se habilitan a futuro.
  if (typeof data.dni === "string" && data.dni) {
    const c = await prisma.employeeProfile.findFirst({ where: { dni: data.dni, userId: { not: request.userId } } });
    if (c) return NextResponse.json({ error: "Ese DNI ya está registrado en otro empleado." }, { status: 409 });
  }
  if (typeof data.cuil === "string" && data.cuil) {
    const c = await prisma.employeeProfile.findFirst({ where: { cuil: data.cuil, userId: { not: request.userId } } });
    if (c) return NextResponse.json({ error: "Ese CUIL ya está registrado en otro empleado." }, { status: 409 });
  }
  if (typeof data.legajo === "string" && data.legajo) {
    const c = await prisma.employeeProfile.findFirst({ where: { legajo: data.legajo, userId: { not: request.userId } } });
    if (c) return NextResponse.json({ error: "Ese legajo ya está asignado a otro empleado." }, { status: 409 });
  }
  if (typeof data.email === "string" && data.email) {
    const c = await prisma.user.findFirst({ where: { email: data.email, id: { not: request.userId } } });
    if (c) return NextResponse.json({ error: "Ese email ya está en uso por otro empleado." }, { status: 409 });
  }

  const note = [
    approvedFields.length > 0 ? `Aprobados: ${labelsOf(approvedFields)}.` : null,
    rejectedFields.length > 0 ? `Rechazados: ${labelsOf(rejectedFields)}.` : null,
  ].filter(Boolean).join(" ") || null;

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.employeeProfile.update({ where: { userId: request.userId }, data });
      }
      await tx.profileChangeRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: session.user.id, note },
      });
    });
  } catch (e) {
    // Defensa ante condición de carrera: dos requests simultáneos podrían pasar el chequeo de
    // arriba y chocar recién en el commit (mismo patrón que /admin/employees/[id]).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Uno de los valores aprobados ya está registrado en otro empleado." }, { status: 409 });
    }
    throw e;
  }

  await recordAudit({
    actorId: session.user.id,
    action: "profile.change.approve",
    subjectId: id,
    metadata: { userId: request.userId, approvedFields, rejectedFields },
  });

  // Un solo aviso resumido: si hubo campos rechazados dentro de la misma revisión, se lo contamos.
  const summary = rejectedFields.length === 0
    ? `El administrador aprobó los cambios de tu perfil (${approvedFields.length} campo/s). Ya están aplicados.`
    : approvedFields.length === 0
      ? `El administrador revisó tu solicitud y no aplicó ningún cambio (${rejectedFields.length} campo/s rechazados: ${labelsOf(rejectedFields)}).`
      : `El administrador revisó tu solicitud: aprobó ${labelsOf(approvedFields)} y rechazó ${labelsOf(rejectedFields)}.`;

  notifyUser(request.userId, approvedFields.length === 0 ? "profile.change.rejected" : "profile.change.approved", {
    body: summary,
  }).catch((e) => console.error("[notify] profile.change.approve", e));

  return NextResponse.json({ ok: true, approvedFields, rejectedFields });
});
