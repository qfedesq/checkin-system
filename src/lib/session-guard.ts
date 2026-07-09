import "server-only";
import { NextResponse } from "next/server";
import { auth } from "./auth";
import { prisma } from "./prisma";

/**
 * Revalida la sesión JWT contra la DB en cada request sensible.
 * El JWT (Auth.js, strategy "jwt") no se revoca al deshabilitar una cuenta,
 * bajar de rol o forzar cambio de contraseña: esos campos sólo se refrescan
 * cuando el token expira (~30 días). Este guard cierra esa ventana.
 */
export async function requireActiveUser() {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
      session: null as never,
      user: null as never,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, role: true, mustChangePassword: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return {
      error: NextResponse.json(
        { error: "Tu cuenta está deshabilitada. Contactá al administrador." },
        { status: 403 }
      ),
      session: null as never,
      user: null as never,
    };
  }

  if (user.mustChangePassword) {
    return {
      error: NextResponse.json({ error: "Cambiá tu contraseña temporal primero." }, { status: 403 }),
      session: null as never,
      user: null as never,
    };
  }

  return { session, user, error: null as never };
}
