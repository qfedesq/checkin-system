import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";

const body = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
  legajo: z.string().optional(),
  hireDate: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

function genTempPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out.slice(0, 12);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });

  if (parsed.data.legajo) {
    const legajoCollision = await prisma.employeeProfile.findUnique({ where: { legajo: parsed.data.legajo } });
    if (legajoCollision) return NextResponse.json({ error: "Ese legajo ya está asignado" }, { status: 409 });
  }

  const hireDate = parsed.data.hireDate ? new Date(parsed.data.hireDate) : null;
  if (hireDate && Number.isNaN(hireDate.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  const tempPassword = genTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: parsed.data.role,
      status: "ACTIVE",
      mustChangePassword: true,
      approvedAt: new Date(),
      approvedById: session.user.id,
    },
  });

  // Si el admin pasó legajo/hireDate/nombres, creamos el perfil con esos datos + placeholders mínimos
  if (parsed.data.legajo || hireDate || parsed.data.firstName || parsed.data.lastName) {
    await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        legajo: parsed.data.legajo ?? null,
        hireDate,
        firstName: parsed.data.firstName ?? "",
        lastName: parsed.data.lastName ?? "",
        dob: new Date("1970-01-01"),
        cuil: `PENDING-${user.id.slice(0, 8)}`,
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
  }

  await recordAudit({
    actorId: session.user.id,
    action: "user.create",
    subjectId: user.id,
    metadata: { email, role: parsed.data.role, legajo: parsed.data.legajo },
  });

  return NextResponse.json({ ok: true, id: user.id, tempPassword });
}
