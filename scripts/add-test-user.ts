import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.NEW_USER_EMAIL!;
  const password = process.env.NEW_USER_PASSWORD!;
  const forceReset = process.env.NEW_USER_FORCE_RESET === "1";
  if (!email || !password) throw new Error("NEW_USER_EMAIL y NEW_USER_PASSWORD requeridos");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "EMPLOYEE",
      status: "ACTIVE",
      passwordHash,
      approvedAt: new Date(),
      mustChangePassword: forceReset,
      deviceId: null, // si lo re-creamos, reseteamos device
    },
    create: {
      email,
      passwordHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      approvedAt: new Date(),
      mustChangePassword: forceReset,
    },
  });

  // Por si existía, limpio credenciales WebAuthn viejas
  await prisma.webAuthnCredential.deleteMany({ where: { userId: user.id } });

  console.log(`[test user] ${user.email} listo. Password: ${password}`);
  console.log(`- status=ACTIVE, role=EMPLOYEE`);
  console.log(`- mustChangePassword=${forceReset}`);
  console.log(`- sin perfil cargado (se completa desde /profile)`);
  console.log(`- sin dispositivo registrado (se enrola biometría en el primer login)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
