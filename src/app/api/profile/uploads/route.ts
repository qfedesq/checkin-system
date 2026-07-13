import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBlob } from "@/lib/blob";
import { recordAudit } from "@/lib/audit";
import { fileUrl } from "@/lib/file-token";
import { route } from "@/lib/route";
import { matchesDeclaredType } from "@/lib/file-validate";
import { isEmployeeProfileComplete } from "@/lib/profile";
import { notifyAdmins } from "@/lib/notify";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

// Imágenes del perfil. En onboarding (perfil incompleto) se guardan al instante; con el
// perfil ya completo, el cambio de imagen pasa por aprobación del admin (igual que el texto).
const KIND_TO_FIELD: Record<string, string> = {
  signature: "signatureBlobUrl",
  face: "faceImageBlobUrl",
  healthFront: "healthCardFrontBlobUrl",
  healthBack: "healthCardBackBlobUrl",
  licenseFront: "licenseFrontBlobUrl",
  licenseBack: "licenseBackBlobUrl",
  dniFront: "dniFrontBlobUrl",
  dniBack: "dniBackBlobUrl",
};

const FIELD_LABELS: Record<string, string> = {
  faceImageBlobUrl: "Foto de frente",
  signatureBlobUrl: "Firma",
  dniFrontBlobUrl: "DNI (frente)",
  dniBackBlobUrl: "DNI (dorso)",
  licenseFrontBlobUrl: "Carnet (frente)",
  licenseBackBlobUrl: "Carnet (dorso)",
  healthCardFrontBlobUrl: "Libreta (frente)",
  healthCardBackBlobUrl: "Libreta (dorso)",
};

export const POST = route("profile.uploads", async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const profile = await prisma.employeeProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Guardá tus datos primero." }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  const field = KIND_TO_FIELD[kind];

  if (!field) return NextResponse.json({ error: "Tipo de imagen inválido" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Formato no permitido (PNG, JPG o WEBP)" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Archivo demasiado grande (máx 8MB)" }, { status: 400 });
  // QA-034: confirmamos el formato real por magic bytes, no sólo el MIME declarado.
  if (!(await matchesDeclaredType(file))) return NextResponse.json({ error: "El archivo no coincide con el formato declarado" }, { status: 400 });

  const url = await uploadBlob(`employee-docs/${session.user.id}/${kind}`, file, file.name, file.type);

  // Onboarding: perfil todavía incompleto → se escribe directo para poder completarlo.
  if (!isEmployeeProfileComplete(profile)) {
    await prisma.employeeProfile.update({ where: { userId: session.user.id }, data: { [field]: url } });
    await recordAudit({ actorId: session.user.id, action: "profile.upload_image", subjectId: session.user.id, metadata: { kind } });
    return NextResponse.json({ ok: true, url: fileUrl(url) });
  }

  // Perfil completo (edición): la imagen NO se aplica; se mergea como cambio pendiente en la
  // solicitud del usuario (sin pisar otros campos ya pendientes) y el admin la revisa. Guardamos
  // la URL CRUDA del blob en `to` (la misma que se setearía en el campo al aprobar).
  const rawCurrent = ((profile[field as keyof typeof profile] as unknown) as string | null) ?? "";
  const change = { from: rawCurrent, to: url };

  const pending = await prisma.profileChangeRequest.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
  });
  if (pending) {
    const merged = { ...(pending.changes as Record<string, { from: string; to: string }>), [field]: change };
    await prisma.profileChangeRequest.update({ where: { id: pending.id }, data: { changes: merged } });
  } else {
    await prisma.profileChangeRequest.create({ data: { userId: session.user.id, changes: { [field]: change } } });
  }

  await recordAudit({ actorId: session.user.id, action: "profile.change.request", subjectId: session.user.id, metadata: { field, kind } });
  await notifyAdmins("profile.change.requested", {
    actorName: `${profile.firstName} ${profile.lastName}`.trim() || null,
    actorEmail: session.user.email ?? "",
    detail: `imagen: ${FIELD_LABELS[field] ?? field}`,
  }).catch((e) => console.error("[notify] profile.change (imagen)", e));

  return NextResponse.json({ ok: true, pendingApproval: true });
});
