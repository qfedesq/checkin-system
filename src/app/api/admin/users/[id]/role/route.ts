import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { route } from "@/lib/route";

// Cambiar el rol de un usuario (empleado ↔ administrador).
export const POST = route("admin.users.role", async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const role = body?.role;
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  // Un admin no puede cambiarse el rol a sí mismo (evita auto-degradarse y quedar sin
  // acceso a esta pantalla en medio de la operación).
  if (id === session.user.id) {
    return NextResponse.json({ error: "No podés cambiar tu propio rol" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (target.role === role) {
    return NextResponse.json({ error: "El usuario ya tiene ese rol" }, { status: 400 });
  }

  // No dejar el sistema sin ningún administrador activo.
  if (target.role === "ADMIN" && role === "EMPLOYEE" && target.status === "ACTIVE") {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (activeAdmins <= 1) {
      return NextResponse.json({ error: "No podés quitarle el rol de administrador al único admin activo" }, { status: 400 });
    }
  }

  await prisma.user.update({ where: { id }, data: { role } });
  await recordAudit({ actorId: session.user.id, action: "user.role", subjectId: id, metadata: { role } });
  return NextResponse.json({ ok: true, role });
});
