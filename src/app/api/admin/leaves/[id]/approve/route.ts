import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { formatCalendarDate } from "@/lib/utils";
import { checkVacationApprovable } from "@/lib/leaves";

class ApprovalConflictError extends Error {}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      if (leave.type === "DAY_OFF") {
        const collision = await tx.leaveRequest.findFirst({
          where: { type: "DAY_OFF", status: "APPROVED", startDate: leave.startDate, id: { not: id } },
        });
        if (collision) throw new ApprovalConflictError("Ya hay un franco aprobado para ese día");
      } else {
        const profile = await tx.employeeProfile.findUnique({ where: { userId: leave.userId } });
        if (!profile) throw new ApprovalConflictError("El empleado no tiene perfil completo");

        // Revalida cupo semanal por categoría y saldo anual antes de aprobar: sin esto, dos
        // solicitudes PENDING solapadas de la misma categoría podían aprobarse ambas (QA-004).
        const check = await checkVacationApprovable(tx, {
          userId: leave.userId,
          category: profile.category,
          startDate: leave.startDate,
          endDate: leave.endDate,
          days: leave.days,
          vacationWeeksPerYear: profile.vacationWeeksPerYear,
          balanceStatuses: ["APPROVED"],
          excludeLeaveId: id,
        });
        if (!check.ok) throw new ApprovalConflictError(check.error);
      }

      await tx.leaveRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: session.user.id },
      });
    });
  } catch (e) {
    if (e instanceof ApprovalConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  await recordAudit({ actorId: session.user.id, action: "leave.approve", subjectId: id });

  const label = leave.type === "VACATION" ? `Vacaciones (${leave.days} días desde ${formatCalendarDate(leave.startDate)})` : `Franco del ${formatCalendarDate(leave.startDate)}`;
  notifyUser(leave.userId, "leave.approved", { body: `Tu solicitud de <strong>${label}</strong> fue aprobada.` }).catch((e) => console.error("[notify] leave.approve", e));

  return NextResponse.json({ ok: true });
}
