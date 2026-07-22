import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { formatCalendarDate } from "@/lib/utils";
import { route } from "@/lib/route";

export const POST = route("admin.leaves.reject", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  // Guard atómico (QA-007): sólo transiciona si sigue PENDING; evita doble transición o
  // pisar un approve/reject concurrente de otro admin.
  const result = await prisma.leaveRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: session.user.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "La solicitud ya fue revisada" }, { status: 409 });

  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) return NextResponse.json({ ok: true });

  await recordAudit({ actorId: session.user.id, action: "leave.reject", subjectId: id });

  const label =
    leave.type === "VACATION"
      ? `Vacaciones (${leave.days} días desde ${formatCalendarDate(leave.startDate)})`
      : leave.days > 1
        ? `Franco (${leave.days} días desde ${formatCalendarDate(leave.startDate)})`
        : `Franco del ${formatCalendarDate(leave.startDate)}`;
  notifyUser(leave.userId, "leave.rejected", { body: `Tu solicitud de <strong>${label}</strong> fue rechazada. Consultá con el administrador.` }).catch((e) => console.error("[notify] leave.reject", e));

  return NextResponse.json({ ok: true });
});
