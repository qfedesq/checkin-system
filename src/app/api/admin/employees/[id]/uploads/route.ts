import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { uploadBlob } from "@/lib/blob";
import { recordAudit } from "@/lib/audit";
import { fileUrl } from "@/lib/file-token";
import { route } from "@/lib/route";
import { matchesDeclaredType } from "@/lib/file-validate";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

const KIND_TO_FIELD: Record<string, string> = {
  dniFront: "dniFrontBlobUrl",
  dniBack: "dniBackBlobUrl",
  licenseFront: "licenseFrontBlobUrl",
  licenseBack: "licenseBackBlobUrl",
  healthFront: "healthCardFrontBlobUrl",
  healthBack: "healthCardBackBlobUrl",
  foodFront: "foodCourseFrontBlobUrl",
  foodBack: "foodCourseBackBlobUrl",
  face: "faceImageBlobUrl",
  signature: "signatureBlobUrl",
};

export const POST = route("admin.employees.uploads", async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const profile = await prisma.employeeProfile.findUnique({ where: { userId: id } });
  if (!profile) return NextResponse.json({ error: "El empleado no tiene perfil todavía. Guardá la ficha primero." }, { status: 404 });

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

  const url = await uploadBlob(`employee-docs/${id}/${kind}`, file, file.name, file.type);
  await prisma.employeeProfile.update({ where: { userId: id }, data: { [field]: url } });

  await recordAudit({ actorId: session.user.id, action: "employee.upload_image", subjectId: id, metadata: { kind } });
  return NextResponse.json({ ok: true, url: fileUrl(url) });
});
