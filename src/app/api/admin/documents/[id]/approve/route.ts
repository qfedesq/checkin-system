import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { route } from "@/lib/route";

const DOC_LABEL: Record<string, string> = { DRIVER_LICENSE: "Carnet", HEALTH_CARD: "Libreta sanitaria", OTHER: "documento" };

export const POST = route("admin.documents.approve", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  // Guard atómico (QA-007): sólo transiciona si sigue PENDING_REVIEW; evita doble transición o
  // pisar un approve/reject concurrente de otro admin.
  const result = await prisma.documentUpload.updateMany({
    where: { id, status: "PENDING_REVIEW" },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: session.user.id, note: null },
  });
  if (result.count === 0) return NextResponse.json({ error: "La solicitud ya fue revisada" }, { status: 409 });

  await recordAudit({ actorId: session.user.id, action: "document.approve", subjectId: id });

  const doc = await prisma.documentUpload.findUnique({ where: { id }, select: { userId: true, type: true } });
  if (doc) {
    const label = DOC_LABEL[doc.type] ?? "documento";
    notifyUser(doc.userId, "document.approved", { body: `Tu <strong>${label}</strong> fue aprobado.` }).catch((e) => console.error("[notify] document.approve", e));
  }

  return NextResponse.json({ ok: true });
});
