import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({ where: { id }, select: { deviceId: true, deviceApprovedAt: true } });
  if (!user?.deviceId) return NextResponse.json({ error: "El usuario no tiene dispositivo registrado" }, { status: 400 });
  if (user.deviceApprovedAt) return NextResponse.json({ error: "El dispositivo ya está aprobado" }, { status: 409 });

  await prisma.user.update({
    where: { id },
    data: { deviceApprovedAt: new Date(), deviceApprovedById: session.user.id },
  });

  await recordAudit({ actorId: session.user.id, action: "user.approve_device", subjectId: id });
  notifyUser(id, "device.approved", { body: "El administrador aprobó tu dispositivo. Ya podés hacer check-in y check-out." }).catch((e) => console.error("[notify] device.approve", e));

  return NextResponse.json({ ok: true });
}
