import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notify";
import { isEmployeeProfileComplete } from "@/lib/profile";

// Campos que el empleado puede proponer cambiar (el resto sólo los edita el admin
// desde la ficha: legajo, nombres, dob, DNI, CUIL, ingreso, categoría, email, foto, firma).
const EDITABLE_FIELDS = [
  "phone",
  "professionalLicenseExpiry",
  "healthCardExpiry",
  "shirtSize",
  "hoodieSize",
  "jacketSize",
  "pantsSize",
  "shoeSize",
  "address",
  "addressNumber",
  "neighborhood",
  "city",
  "postalCode",
  "emergencyContact",
  "emergencyPhone",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];
const DATE_FIELDS: EditableField[] = ["professionalLicenseExpiry", "healthCardExpiry"];

const editSchema = z.object({
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
});

// El alta inicial del perfil (empleado sin perfil todavía) sigue siendo directa:
// el admin la revisa después desde la ficha.
const createSchema = editSchema.extend({
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  dob: z.string(),
  cuil: z.string().min(1),
  category: z.enum(["DRIVER", "HELPER"]),
  signatureBlobUrl: z.string().optional().nullable(),
});

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDay(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const existing = await prisma.employeeProfile.findUnique({ where: { userId: session.user.id } });

  if (!existing) {
    // Alta inicial del perfil
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    if (d.category === "DRIVER" && !d.professionalLicenseExpiry) {
      return NextResponse.json({ error: "Los choferes deben cargar vencimiento de carnet profesional" }, { status: 400 });
    }
    const dob = asDate(d.dob);
    const healthCardExpiry = asDate(d.healthCardExpiry);
    if (!dob || !healthCardExpiry) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

    await prisma.employeeProfile.create({
      data: {
        userId: session.user.id,
        lastName: d.lastName,
        firstName: d.firstName,
        dob,
        cuil: d.cuil,
        category: d.category,
        phone: d.phone,
        professionalLicenseExpiry: asDate(d.professionalLicenseExpiry),
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
    await recordAudit({ actorId: session.user.id, action: "profile.create", subjectId: session.user.id });
    return NextResponse.json({ ok: true, created: true });
  }

  // Perfil existente: los cambios van a aprobación del admin
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  if (existing.category === "DRIVER" && !d.professionalLicenseExpiry) {
    return NextResponse.json({ error: "Los choferes deben cargar vencimiento de carnet profesional" }, { status: 400 });
  }

  // Primera carga de un perfil placeholder (usuario nuevo): se escribe directo, sin aprobación.
  // Recién cuando el perfil ya está completo, las ediciones pasan por el admin.
  if (!isEmployeeProfileComplete(existing)) {
    await prisma.employeeProfile.update({
      where: { userId: session.user.id },
      data: {
        phone: d.phone,
        professionalLicenseExpiry: asDate(d.professionalLicenseExpiry),
        healthCardExpiry: asDate(d.healthCardExpiry) ?? existing.healthCardExpiry,
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
      },
    });
    await recordAudit({ actorId: session.user.id, action: "profile.complete", subjectId: session.user.id });
    return NextResponse.json({ ok: true, completed: true });
  }

  const changes: Record<string, { from: string; to: string }> = {};
  for (const field of EDITABLE_FIELDS) {
    const proposed = (d[field] ?? "") as string;
    const current = DATE_FIELDS.includes(field)
      ? isoDay(existing[field] as Date | null)
      : ((existing[field] as string | null) ?? "");
    // Placeholder de libreta 2099 se muestra vacío en el form
    const normalizedCurrent = field === "healthCardExpiry" && current.startsWith("2099") ? "" : current;
    if (proposed !== normalizedCurrent) changes[field] = { from: normalizedCurrent, to: proposed };
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  if (DATE_FIELDS.some((f) => changes[f] && changes[f].to && !asDate(changes[f].to))) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const pending = await prisma.profileChangeRequest.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
  });
  if (pending) {
    return NextResponse.json({ error: "Ya tenés cambios pendientes de aprobación. Esperá a que el administrador los revise." }, { status: 409 });
  }

  const request = await prisma.profileChangeRequest.create({
    data: { userId: session.user.id, changes },
  });

  await recordAudit({ actorId: session.user.id, action: "profile.change.request", subjectId: request.id, metadata: { fields: Object.keys(changes) } });
  notifyAdmins("profile.change.requested", {
    actorName: `${existing.firstName} ${existing.lastName}`.trim() || null,
    actorEmail: session.user.email ?? "",
    detail: Object.keys(changes).length + " campo(s)",
  }).catch((e) => console.error("[notify] profile.change", e));

  return NextResponse.json({ ok: true, pendingApproval: true });
}
