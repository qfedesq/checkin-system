import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { uploadBlob } from "@/lib/blob";
import { recordAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const form = await req.formData();
  const file = form.get("file");
  const recipientId = String(form.get("recipientId") ?? "");
  const type = String(form.get("type") ?? "OTHER");
  const title = String(form.get("title") ?? "").trim();

  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "Sólo PDF" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Máx 15 MB" }, { status: 400 });
  if (!recipientId || !title) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  if (!["PAYSLIP", "INTERNAL_DOC", "OTHER"].includes(type)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });

  const url = await uploadBlob(`deliveries/${recipientId}`, file, file.name, file.type);

  const d = await prisma.deliveredDocument.create({
    data: {
      recipientId,
      createdById: session.user.id,
      type: type as "PAYSLIP" | "INTERNAL_DOC" | "OTHER",
      title,
      originalBlobUrl: url,
    },
  });

  await recordAudit({ actorId: session.user.id, action: "delivery.create", subjectId: d.id, metadata: { recipientId, type } });
  return NextResponse.json({ ok: true, id: d.id });
}
