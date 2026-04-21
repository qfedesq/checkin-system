import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, expiryEmailHtml } from "@/lib/email";
import { daysUntil } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization") ?? req.nextUrl.searchParams.get("key");
  if (process.env.CRON_SECRET && secret !== `Bearer ${process.env.CRON_SECRET}` && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const results = { profilesNotified: 0, docsNotified: 0 };
  const now = new Date();

  // Perfiles con vencimientos próximos
  const profiles = await prisma.employeeProfile.findMany({
    include: { user: { select: { email: true, status: true } } },
  });

  for (const p of profiles) {
    if (p.user.status !== "ACTIVE") continue;
    const name = `${p.firstName} ${p.lastName}`.trim();

    if (p.healthCardExpiry && p.healthCardExpiry.getTime() > 0) {
      const d = daysUntil(p.healthCardExpiry);
      if (d !== null && d <= 30 && d >= 0) {
        const last = p.notifiedHealthExpiryAt?.toDateString();
        if (last !== now.toDateString()) {
          await sendEmail(p.user.email, "Tu libreta sanitaria vence pronto", expiryEmailHtml(name, "libreta sanitaria", p.healthCardExpiry, d));
          await prisma.employeeProfile.update({ where: { userId: p.userId }, data: { notifiedHealthExpiryAt: now } });
          results.profilesNotified++;
        }
      }
    }

    if (p.category === "DRIVER" && p.professionalLicenseExpiry) {
      const d = daysUntil(p.professionalLicenseExpiry);
      if (d !== null && d <= 30 && d >= 0) {
        const last = p.notifiedLicenseExpiryAt?.toDateString();
        if (last !== now.toDateString()) {
          await sendEmail(p.user.email, "Tu carnet profesional vence pronto", expiryEmailHtml(name, "carnet profesional", p.professionalLicenseExpiry, d));
          await prisma.employeeProfile.update({ where: { userId: p.userId }, data: { notifiedLicenseExpiryAt: now } });
          results.profilesNotified++;
        }
      }
    }
  }

  // Documentos subidos con vencimiento
  const docs = await prisma.documentUpload.findMany({
    where: { expiresAt: { not: null }, status: "APPROVED" },
    include: { user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
  });

  for (const doc of docs) {
    if (!doc.expiresAt) continue;
    const d = daysUntil(doc.expiresAt);
    if (d === null || d > 30 || d < 0) continue;
    const last = doc.notifiedAt?.toDateString();
    if (last === now.toDateString()) continue;
    const name = doc.user.profile ? `${doc.user.profile.firstName} ${doc.user.profile.lastName}`.trim() : "";
    const label = doc.type === "DRIVER_LICENSE" ? "carnet de conducir" : doc.type === "HEALTH_CARD" ? "libreta sanitaria" : "documento";
    await sendEmail(doc.user.email, `Tu ${label} vence pronto`, expiryEmailHtml(name, label, doc.expiresAt, d));
    await prisma.documentUpload.update({ where: { id: doc.id }, data: { notifiedAt: now } });
    results.docsNotified++;
  }

  return NextResponse.json({ ok: true, ...results });
}
