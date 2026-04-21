import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  dob: z.string(),
  cuil: z.string().min(1),
  category: z.enum(["DRIVER", "HELPER"]),
  phone: z.string().min(1),
  professionalLicenseExpiry: z.string().optional().nullable(),
  healthCardExpiry: z.string(),
  shirtSize: z.string(),
  hoodieSize: z.string(),
  jacketSize: z.string(),
  pantsSize: z.string(),
  shoeSize: z.string(),
  address: z.string().min(1),
  addressNumber: z.string().min(1),
  neighborhood: z.string(),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  emergencyContact: z.string().min(1),
  emergencyPhone: z.string().min(1),
  signatureBlobUrl: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  if (d.category === "DRIVER" && !d.professionalLicenseExpiry) {
    return NextResponse.json({ error: "Los choferes deben cargar vencimiento de carnet profesional" }, { status: 400 });
  }

  const dob = new Date(d.dob);
  const healthCardExpiry = new Date(d.healthCardExpiry);
  const licenseExpiry = d.professionalLicenseExpiry ? new Date(d.professionalLicenseExpiry) : null;

  await prisma.employeeProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      lastName: d.lastName,
      firstName: d.firstName,
      dob,
      cuil: d.cuil,
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
      signatureBlobUrl: d.signatureBlobUrl || null,
    },
    update: {
      lastName: d.lastName,
      firstName: d.firstName,
      dob,
      cuil: d.cuil,
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
      signatureBlobUrl: d.signatureBlobUrl || null,
    },
  });

  await recordAudit({ actorId: session.user.id, action: "profile.update", subjectId: session.user.id });
  return NextResponse.json({ ok: true });
}
