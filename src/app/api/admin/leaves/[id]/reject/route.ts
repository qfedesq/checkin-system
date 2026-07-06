import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { formatDate } from "@/lib/utils";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  const leave = await prisma.leaveRequest.update({
    where: { id },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: session.user.id },
  });
  await recordAudit({ actorId: session.user.id, action: "leave.reject", subjectId: id });

  const label = leave.type === "VACATION" ? `Vacaciones (${leave.days} días desde ${formatDate(leave.startDate)})` : `Franco del ${formatDate(leave.startDate)}`;
  notifyUser(leave.userId, "leave.rejected", { body: `Tu solicitud de <strong>${label}</strong> fue rechazada. Consultá con el administrador.` }).catch((e) => console.error("[notify] leave.reject", e));

  return NextResponse.json({ ok: true });
}
