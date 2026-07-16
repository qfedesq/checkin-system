import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/session-guard";
import { prisma } from "@/lib/prisma";
import { uploadBlob } from "@/lib/blob";
import { recordAudit } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notify";
import { route } from "@/lib/route";
import { matchesDeclaredType } from "@/lib/file-validate";

const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];

export const POST = route("documents.upload", async (req: NextRequest) => {
  const { error, session } = await requireActiveUser();
  if (error) return error;

  const form = await req.formData();
  const file = form.get("file");
  const type = String(form.get("type") ?? "");
  const expiresAt = String(form.get("expiresAt") ?? "");

  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Formato no permitido" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Archivo demasiado grande (máx 10 MB)" }, { status: 400 });
  // QA-034: el MIME declarado por el cliente no alcanza; confirmamos con los magic bytes reales.
  if (!(await matchesDeclaredType(file))) return NextResponse.json({ error: "El archivo no coincide con el formato declarado" }, { status: 400 });
  if (!["DRIVER_LICENSE", "HEALTH_CARD", "OTHER"].includes(type)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  const exp = expiresAt ? new Date(expiresAt) : null;
  if (exp && Number.isNaN(exp.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  const url = await uploadBlob(`docs/${session.user.id}`, file, file.name, file.type);
  const doc = await prisma.documentUpload.create({
    data: {
      userId: session.user.id,
      type: type as "DRIVER_LICENSE" | "HEALTH_CARD" | "OTHER",
      blobUrl: url,
      mimeType: file.type,
      expiresAt: exp,
    },
  });

  await recordAudit({ actorId: session.user.id, action: "document.upload", subjectId: doc.id, metadata: { type } });

  const label = type === "DRIVER_LICENSE" ? "Carnet de conducir" : type === "HEALTH_CARD" ? "Libreta sanitaria" : "Documento";
  notifyAdmins("document.uploaded", {
    actorEmail: session.user.email,
    actorName: session.user.name,
    detail: label,
  }).catch((e) => console.error("[notify] doc", e));

  return NextResponse.json({ ok: true, id: doc.id });
});
