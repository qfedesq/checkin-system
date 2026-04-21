import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  if (leave.type === "DAY_OFF") {
    const collision = await prisma.leaveRequest.findFirst({
      where: { type: "DAY_OFF", status: "APPROVED", startDate: leave.startDate, id: { not: id } },
    });
    if (collision) return NextResponse.json({ error: "Ya hay un franco aprobado para ese día" }, { status: 409 });
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: session.user.id },
  });
  await recordAudit({ actorId: session.user.id, action: "leave.approve", subjectId: id });
  return NextResponse.json({ ok: true });
}
