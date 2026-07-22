import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { formatCalendarDate } from "@/lib/utils";
import { checkVacationApprovable } from "@/lib/leaves";
import { route } from "@/lib/route";

class ApprovalConflictError extends Error {}

export const POST = route("admin.leaves.approve", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  let outcome: { kind: "notfound" } | { kind: "conflict" } | { kind: "ok"; leave: Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>> };
  try {
    outcome = await prisma.$transaction(
      async (tx) => {
      // Releer el estado dentro de la tx (QA-007): si ya no está PENDING, otro admin (o esta
      // misma request duplicada) ya la resolvió — abortar sin re-aplicar ni notificar.
      const current = await tx.leaveRequest.findUnique({ where: { id } });
      if (!current) return { kind: "notfound" as const };
      if (current.status !== "PENDING") return { kind: "conflict" as const };

      if (current.type === "DAY_OFF") {
        // Un solo ausente por día: rechazar si otro empleado ya tiene un franco APROBADO
        // que se solape con el rango de esta solicitud.
        const collision = await tx.leaveRequest.findFirst({
          where: {
            type: "DAY_OFF",
            status: "APPROVED",
            id: { not: id },
            userId: { not: current.userId },
            startDate: { lte: current.endDate },
            endDate: { gte: current.startDate },
          },
        });
        if (collision) throw new ApprovalConflictError("Ya hay un franco aprobado de otro empleado en esas fechas");
      } else {
        const profile = await tx.employeeProfile.findUnique({ where: { userId: current.userId } });
        if (!profile) throw new ApprovalConflictError("El empleado no tiene perfil completo");

        // Revalida cupo semanal por categoría y saldo anual antes de aprobar: sin esto, dos
        // solicitudes PENDING solapadas de la misma categoría podían aprobarse ambas (QA-004).
        const check = await checkVacationApprovable(tx, {
          userId: current.userId,
          category: profile.category,
          startDate: current.startDate,
          endDate: current.endDate,
          days: current.days,
          vacationWeeksPerYear: profile.vacationWeeksPerYear,
          balanceStatuses: ["APPROVED"],
          excludeLeaveId: id,
        });
        if (!check.ok) throw new ApprovalConflictError(check.error);
      }

      // Guard atómico final (QA-007): el WHERE con status:"PENDING" hace que, si dos requests
      // concurrentes llegan hasta acá, sólo una actualice fila (la otra ve count===0).
      const result = await tx.leaveRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: session.user.id },
      });
      if (result.count === 0) return { kind: "conflict" as const };
      return { kind: "ok" as const, leave: current };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (e) {
    if (e instanceof ApprovalConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    // Postgres aborta transacciones serializables con conflicto de escritura (P2034): mismo
    // patrón que checkin — pedirle al cliente que reintente en vez de un 500 crudo.
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2034") {
      return NextResponse.json({ error: "Conflicto al aprobar, reintentá" }, { status: 409 });
    }
    throw e;
  }

  if (outcome.kind === "notfound") return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (outcome.kind === "conflict") return NextResponse.json({ error: "La solicitud ya fue revisada" }, { status: 409 });

  const leave = outcome.leave!;
  await recordAudit({ actorId: session.user.id, action: "leave.approve", subjectId: id });

  const label =
    leave.type === "VACATION"
      ? `Vacaciones (${leave.days} días desde ${formatCalendarDate(leave.startDate)})`
      : leave.days > 1
        ? `Franco (${leave.days} días desde ${formatCalendarDate(leave.startDate)})`
        : `Franco del ${formatCalendarDate(leave.startDate)}`;
  notifyUser(leave.userId, "leave.approved", { body: `Tu solicitud de <strong>${label}</strong> fue aprobada.` }).catch((e) => console.error("[notify] leave.approve", e));

  return NextResponse.json({ ok: true });
});
