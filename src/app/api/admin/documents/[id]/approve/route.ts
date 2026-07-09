import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  return NextResponse.json({ ok: true });
}
