import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { route } from "@/lib/route";

// Rechazar el dispositivo equivale a un reset: borra la credencial para que
// el empleado pueda registrar otro.
export const POST = route("admin.users.reject-device", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  await prisma.$transaction([
    prisma.webAuthnCredential.deleteMany({ where: { userId: id } }),
    prisma.user.update({ where: { id }, data: { deviceId: null, deviceApprovedAt: null, deviceApprovedById: null } }),
  ]);

  await recordAudit({ actorId: session.user.id, action: "user.reject_device", subjectId: id });
  notifyUser(id, "device.rejected", { body: "El administrador rechazó tu dispositivo. Ingresá de nuevo y registrá la biometría en el dispositivo correcto." }).catch((e) => console.error("[notify] device.reject", e));

  return NextResponse.json({ ok: true });
});
