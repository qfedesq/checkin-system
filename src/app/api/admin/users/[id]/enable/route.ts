import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { route } from "@/lib/route";

export const POST = route("admin.users.enable", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;
  // expiryBlockClearedAt = ahora: el cron no vuelve a bloquear por vencimientos ya existentes;
  // el desbloqueo queda firme hasta un vencimiento posterior o un bloqueo manual del admin.
  await prisma.user.update({ where: { id }, data: { status: "ACTIVE", disabledReason: null, expiryBlockClearedAt: new Date() } });
  await recordAudit({ actorId: session.user.id, action: "user.enable", subjectId: id });
  return NextResponse.json({ ok: true });
});
