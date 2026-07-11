import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { fileUrl } from "@/lib/file-token";
import { route } from "@/lib/route";

const schema = z.object({
  email: z.string().email(),
  legajo: z.string().optional().nullable(),
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  dob: z.string(),
  dni: z.string().optional().nullable(),
  cuil: z.string().min(1),
  hireDate: z.string().optional().nullable(),
  category: z.enum(["DRIVER", "HELPER"]),
  phone: z.string(),
  professionalLicenseExpiry: z.string().optional().nullable(),
  healthCardExpiry: z.string(),
  shirtSize: z.string(),
  hoodieSize: z.string(),
  jacketSize: z.string(),
  pantsSize: z.string(),
  shoeSize: z.string(),
  address: z.string(),
  addressNumber: z.string(),
  neighborhood: z.string(),
  city: z.string(),
  postalCode: z.string(),
  emergencyContact: z.string(),
  emergencyPhone: z.string(),
  vacationWeeksPerYear: z.number().int().min(0).max(10),
});

export const GET = route("admin.employees.get", async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { profile: true },
  });
  if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const profile = user.profile
    ? {
        ...user.profile,
        dniFrontBlobUrl: fileUrl(user.profile.dniFrontBlobUrl) || null,
        dniBackBlobUrl: fileUrl(user.profile.dniBackBlobUrl) || null,
        licenseFrontBlobUrl: fileUrl(user.profile.licenseFrontBlobUrl) || null,
        licenseBackBlobUrl: fileUrl(user.profile.licenseBackBlobUrl) || null,
        healthCardFrontBlobUrl: fileUrl(user.profile.healthCardFrontBlobUrl) || null,
        healthCardBackBlobUrl: fileUrl(user.profile.healthCardBackBlobUrl) || null,
        faceImageBlobUrl: fileUrl(user.profile.faceImageBlobUrl) || null,
        signatureBlobUrl: fileUrl(user.profile.signatureBlobUrl) || null,
      }
    : null;

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    hasDevice: Boolean(user.deviceId),
    profile,
  });
});

export const PUT = route("admin.employees.put", async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({ where: { id }, include: { profile: true } });
  if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const email = d.email.toLowerCase();
  const emailCollision = await prisma.user.findFirst({ where: { email, id: { not: id } } });
  if (emailCollision) return NextResponse.json({ error: "Ese email ya está en uso" }, { status: 409 });

  if (d.legajo) {
    const c = await prisma.employeeProfile.findFirst({ where: { legajo: d.legajo, userId: { not: id } } });
    if (c) return NextResponse.json({ error: "Ese legajo ya está asignado" }, { status: 409 });
  }
  if (d.dni) {
    const c = await prisma.employeeProfile.findFirst({ where: { dni: d.dni, userId: { not: id } } });
    if (c) return NextResponse.json({ error: "Ese DNI ya está registrado" }, { status: 409 });
  }
  const cuilCollision = await prisma.employeeProfile.findFirst({ where: { cuil: d.cuil, userId: { not: id } } });
  if (cuilCollision) return NextResponse.json({ error: "Ese CUIL ya está registrado" }, { status: 409 });

  const dob = new Date(d.dob);
  const healthCardExpiry = new Date(d.healthCardExpiry);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(healthCardExpiry.getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const hireDate = d.hireDate ? new Date(d.hireDate) : null;
  const licenseExpiry = d.professionalLicenseExpiry ? new Date(d.professionalLicenseExpiry) : null;

  // Un chofer sin vencimiento de carnet queda fuera del monitoreo del cron de vencimientos
  // (src/app/api/cron/expiry-check/route.ts sólo chequea DRIVER con professionalLicenseExpiry).
  if (d.category === "DRIVER" && !licenseExpiry && !user.profile?.professionalLicenseExpiry) {
    return NextResponse.json({ error: "Un chofer necesita fecha de vencimiento del carnet profesional" }, { status: 400 });
  }

  const profileData = {
    legajo: d.legajo || null,
    lastName: d.lastName,
    firstName: d.firstName,
    dob,
    dni: d.dni || null,
    cuil: d.cuil,
    hireDate,
    category: d.category,
    phone: d.phone,
    professionalLicenseExpiry: licenseExpiry,
    healthCardExpiry,
    shirtSize: d.shirtSize,
    hoodieSize: d.hoodieSize,
    jacketSize: d.jacketSize,
    pantsSize: d.pantsSize,
    shoeSize: d.shoeSize,
    address: d.address,
    addressNumber: d.addressNumber,
    neighborhood: d.neighborhood,
    city: d.city,
    postalCode: d.postalCode,
    emergencyContact: d.emergencyContact,
    emergencyPhone: d.emergencyPhone,
    vacationWeeksPerYear: d.vacationWeeksPerYear,
  };

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { email } }),
      prisma.employeeProfile.upsert({
        where: { userId: id },
        create: { userId: id, ...profileData },
        update: profileData,
      }),
    ]);
  } catch (e) {
    // QA-040: defensa ante condición de carrera — los pre-checks de arriba ya cubren el caso
    // normal, pero dos requests simultáneos pueden pasar ambos checks y chocar en el commit.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const field = String(e.meta?.target ?? "");
      const message = field.includes("email")
        ? "Ese email ya está en uso"
        : field.includes("legajo")
          ? "Ese legajo ya está asignado"
          : field.includes("dni")
            ? "Ese DNI ya está registrado"
            : field.includes("cuil")
              ? "Ese CUIL ya está registrado"
              : "Ya existe un registro con ese valor";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw e;
  }

  await recordAudit({ actorId: session.user.id, action: "employee.update", subjectId: id });
  return NextResponse.json({ ok: true });
});
