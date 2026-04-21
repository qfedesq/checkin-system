import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const body = z.object({ current: z.string().min(1), next: z.string().min(8) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const ok = await bcrypt.compare(parsed.data.current, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 401 });

  const passwordHash = await bcrypt.hash(parsed.data.next, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await recordAudit({ actorId: user.id, action: "password.change", subjectId: user.id });
  return NextResponse.json({ ok: true });
}
