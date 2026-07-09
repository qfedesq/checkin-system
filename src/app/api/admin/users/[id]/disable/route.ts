import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { route } from "@/lib/route";

export const POST = route("admin.users.disable", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  // QA-041: un admin no puede deshabilitarse a sí mismo (se quedaría afuera sin poder
  // revertirlo) ni dejar el sistema sin ningún ADMIN activo.
  if (id === session.user.id) {
    return NextResponse.json({ error: "No podés deshabilitar tu propia cuenta" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (target.role === "ADMIN" && target.status === "ACTIVE") {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (activeAdmins <= 1) {
      return NextResponse.json({ error: "No podés deshabilitar al único administrador activo" }, { status: 400 });
    }
  }

  await prisma.user.update({ where: { id }, data: { status: "DISABLED", disabledReason: "MANUAL" } });
  await recordAudit({ actorId: session.user.id, action: "user.disable", subjectId: id });
  return NextResponse.json({ ok: true });
});
