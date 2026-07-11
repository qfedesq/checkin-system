import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { route } from "@/lib/route";

class LastAdminError extends Error {}

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

  // No dejar el sistema sin ningún administrador activo. El count + update va en una única
  // transacción Serializable (TOCTOU): sin esto, dos requests concurrentes podían leer
  // activeAdmins===2 cada una y degradar a los dos últimos admins a la vez.
  try {
    await prisma.$transaction(
      async (tx) => {
        if (target.role === "ADMIN" && role === "EMPLOYEE" && target.status === "ACTIVE") {
          const activeAdmins = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
          if (activeAdmins <= 1) {
            throw new LastAdminError("No podés quitarle el rol de administrador al único admin activo");
          }
        }
        await tx.user.update({ where: { id }, data: { role } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (e) {
    if (e instanceof LastAdminError) return NextResponse.json({ error: e.message }, { status: 400 });
    // Postgres aborta transacciones serializables con conflicto de escritura (P2034): mismo
    // patrón que checkin — pedirle al cliente que reintente en vez de un 500 crudo.
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2034") {
      return NextResponse.json({ error: "Conflicto de concurrencia, reintentá" }, { status: 409 });
    }
    throw e;
  }

  await recordAudit({ actorId: session.user.id, action: "user.role", subjectId: id, metadata: { role } });
  return NextResponse.json({ ok: true, role });
});
