import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { uploadBlob } from "@/lib/blob";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { route } from "@/lib/route";
import { matchesDeclaredType } from "@/lib/file-validate";

export const POST = route("admin.deliveries.upload", async (req: NextRequest) => {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const form = await req.formData();
  const file = form.get("file");
  const recipientId = String(form.get("recipientId") ?? "");
  const type = String(form.get("type") ?? "OTHER");
  const title = String(form.get("title") ?? "").trim();
  const signAnchorRaw = String(form.get("signAnchor") ?? "bottom-left");
  const signPageRaw = String(form.get("signPage") ?? "").trim();

  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "Sólo PDF" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Máx 15 MB" }, { status: 400 });
  // QA-034: confirmamos el formato real por magic bytes, no sólo el MIME declarado.
  if (!(await matchesDeclaredType(file))) return NextResponse.json({ error: "El archivo no coincide con el formato declarado" }, { status: 400 });
  if (!recipientId || !title) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  if (!["PAYSLIP", "INTERNAL_DOC", "OTHER"].includes(type)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  const SIGN_ANCHORS = ["bottom-left", "bottom-right", "top-left", "top-right"] as const;
  if (!SIGN_ANCHORS.includes(signAnchorRaw as (typeof SIGN_ANCHORS)[number])) {
    return NextResponse.json({ error: "Posición de firma inválida" }, { status: 400 });
  }
  const signAnchor = signAnchorRaw as (typeof SIGN_ANCHORS)[number];
  let signPage: number | null = null;
  if (signPageRaw !== "") {
    const parsed = Number(signPageRaw);
    if (!Number.isInteger(parsed) || parsed < 1) return NextResponse.json({ error: "Página de firma inválida" }, { status: 400 });
    signPage = parsed;
  }

  // El recipientId venía sin validar: un id inexistente tiraba 500 por violación de FK
  // recién al hacer el create, y encima ya se había subido el blob y se intentaba notificar
  // a un usuario que no existe. Validamos antes de tocar blob storage.
  const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { status: true, role: true } });
  if (!recipient || recipient.status !== "ACTIVE" || recipient.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Destinatario inválido" }, { status: 400 });
  }

  const url = await uploadBlob(`deliveries/${recipientId}`, file, file.name, file.type);

  const d = await prisma.deliveredDocument.create({
    data: {
      recipientId,
      createdById: session.user.id,
      type: type as "PAYSLIP" | "INTERNAL_DOC" | "OTHER",
      title,
      originalBlobUrl: url,
      signAnchor,
      signPage,
    },
  });

  await recordAudit({ actorId: session.user.id, action: "delivery.create", subjectId: d.id, metadata: { recipientId, type } });

  const kindLabel = type === "PAYSLIP" ? "recibo de sueldo" : "documento";
  notifyUser(recipientId, "delivery.new", { body: `Tenés un nuevo <strong>${kindLabel}</strong> disponible: “${title}”. Al abrirlo se firma automáticamente con tu firma digital.` }).catch((e) => console.error("[notify] delivery.new", e));

  return NextResponse.json({ ok: true, id: d.id });
});
