"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Sólo se llama tras un signIn fallido, para distinguir "cuenta bloqueada" de "credenciales inválidas".
// Devuelve "disabled" únicamente cuando la contraseña es CORRECTA y la cuenta está DISABLED, así no
// filtra el estado de una cuenta a quien no conoce la clave (no hay enumeración de cuentas).
export async function loginStatus(raw: { email: string; password: string }): Promise<"ok" | "invalid" | "disabled"> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return "invalid";
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { passwordHash: true, status: true },
  });
  if (!user) return "invalid";

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return "invalid";

  return user.status === "DISABLED" ? "disabled" : "ok";
}
