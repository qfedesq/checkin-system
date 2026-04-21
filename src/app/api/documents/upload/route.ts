import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBlob } from "@/lib/blob";
import { recordAudit } from "@/lib/audit";

const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const type = String(form.get("type") ?? "");
  const expiresAt = String(form.get("expiresAt") ?? "");

  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Formato no permitido" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Archivo demasiado grande (máx 10 MB)" }, { status: 400 });
  if (!["DRIVER_LICENSE", "HEALTH_CARD", "OTHER"].includes(type)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

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
  return NextResponse.json({ ok: true, id: doc.id });
}
