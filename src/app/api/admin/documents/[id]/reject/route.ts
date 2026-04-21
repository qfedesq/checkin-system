import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const { note } = await req.json().catch(() => ({ note: "" }));
  await prisma.documentUpload.update({
    where: { id },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: session.user.id, note: note || "Rechazado" },
  });
  await recordAudit({ actorId: session.user.id, action: "document.reject", subjectId: id, metadata: { note } });
  return NextResponse.json({ ok: true });
}
