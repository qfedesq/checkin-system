import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  await prisma.documentUpload.update({
    where: { id },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: session.user.id, note: null },
  });
  await recordAudit({ actorId: session.user.id, action: "document.approve", subjectId: id });
  return NextResponse.json({ ok: true });
}
