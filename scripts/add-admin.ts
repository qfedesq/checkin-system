import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.NEW_ADMIN_EMAIL!;
  const password = process.env.NEW_ADMIN_PASSWORD!;
  const firstName = process.env.NEW_ADMIN_FIRSTNAME ?? "Admin";
  const lastName = process.env.NEW_ADMIN_LASTNAME ?? "";

  if (!email || !password) throw new Error("NEW_ADMIN_EMAIL y NEW_ADMIN_PASSWORD requeridos");

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      approvedAt: new Date(),
      mustChangePassword: true,
    },
    create: {
      email,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      approvedAt: new Date(),
      mustChangePassword: true,
    },
  });

  // Aseguramos perfil mínimo con el nombre (no requerido para admins, pero útil para mostrar)
  await prisma.employeeProfile.upsert({
    where: { userId: admin.id },
    update: { firstName, lastName },
    create: {
      userId: admin.id,
      firstName,
      lastName,
      dob: new Date("1970-01-01"),
      cuil: `ADMIN-${admin.id.slice(0, 8)}`,
      category: "HELPER",
      phone: "",
      healthCardExpiry: new Date("2099-12-31"),
      shirtSize: "",
      hoodieSize: "",
      jacketSize: "",
      pantsSize: "",
      shoeSize: "",
      address: "",
      addressNumber: "",
      neighborhood: "",
      city: "",
      postalCode: "",
      emergencyContact: "",
      emergencyPhone: "",
    },
  });

  console.log(`[admin] ${admin.email} (${firstName} ${lastName}) lista. Password inicial: ${password} — el sistema la forzará a cambiarla al primer login.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
