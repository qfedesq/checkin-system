import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";

// Clave temporaria fija pedida por el cliente; mustChangePassword fuerza el cambio en el primer login.
const TEMP_PASSWORD = "Emmalva01";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const tempPassword = TEMP_PASSWORD;
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  await recordAudit({ actorId: session.user.id, action: "user.reset_password", subjectId: id });
  return NextResponse.json({ ok: true, tempPassword });
}
