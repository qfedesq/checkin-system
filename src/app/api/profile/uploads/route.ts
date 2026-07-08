import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBlob } from "@/lib/blob";
import { recordAudit } from "@/lib/audit";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

// Imágenes que el propio empleado puede subir a su perfil (se guardan al instante).
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

export async function POST(req: NextRequest) {
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

  const url = await uploadBlob(`employee-docs/${session.user.id}/${kind}`, file, file.name, file.type);
  await prisma.employeeProfile.update({ where: { userId: session.user.id }, data: { [field]: url } });

  await recordAudit({ actorId: session.user.id, action: "profile.upload_image", subjectId: session.user.id, metadata: { kind } });
  return NextResponse.json({ ok: true, url });
}
