import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, expiryEmailHtml, adminAlertHtml } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { notifyUser } from "@/lib/notify";
import { daysUntil, formatDate } from "@/lib/utils";

const PLACEHOLDER_YEAR = 2098; // libretas "2099-12-31" = sin dato, no cuentan

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization") ?? req.nextUrl.searchParams.get("key");
  if (process.env.CRON_SECRET && secret !== `Bearer ${process.env.CRON_SECRET}` && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const results = { profilesNotified: 0, docsNotified: 0, autoDisabled: 0 };
  const now = new Date();

  // Perfiles con vencimientos próximos
  const profiles = await prisma.employeeProfile.findMany({
    include: { user: { select: { email: true, status: true, role: true } } },
  });

  for (const p of profiles) {
    if (p.user.status !== "ACTIVE") continue;
    const name = `${p.firstName} ${p.lastName}`.trim();

    if (p.healthCardExpiry && p.healthCardExpiry.getFullYear() <= PLACEHOLDER_YEAR) {
      const d = daysUntil(p.healthCardExpiry);
      if (d !== null && d <= 30 && d >= 0) {
        const last = p.notifiedHealthExpiryAt?.toDateString();
        if (last !== now.toDateString()) {
          await sendEmail(p.user.email, "Tu libreta sanitaria vence pronto", expiryEmailHtml(name, "libreta sanitaria", p.healthCardExpiry, d));
          await sendPushToUser(p.userId, { title: "Libreta sanitaria por vencer", body: `Vence el ${formatDate(p.healthCardExpiry)} (en ${d} día${d === 1 ? "" : "s"}). Renovala para no quedar bloqueado.`, url: "/documents" });
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
          await sendPushToUser(p.userId, { title: "Carnet profesional por vencer", body: `Vence el ${formatDate(p.professionalLicenseExpiry)} (en ${d} día${d === 1 ? "" : "s"}). Renovalo para no quedar bloqueado.`, url: "/documents" });
          await prisma.employeeProfile.update({ where: { userId: p.userId }, data: { notifiedLicenseExpiryAt: now } });
          results.profilesNotified++;
        }
      }
    }

    // Bloqueo automático: al día siguiente del vencimiento, sólo el admin puede desbloquear
    if (p.user.role !== "ADMIN") {
      const healthExpired =
        p.healthCardExpiry && p.healthCardExpiry.getFullYear() <= PLACEHOLDER_YEAR && (daysUntil(p.healthCardExpiry) ?? 1) < 0;
      const licenseExpired =
        p.category === "DRIVER" && p.professionalLicenseExpiry && (daysUntil(p.professionalLicenseExpiry) ?? 1) < 0;

      if (healthExpired || licenseExpired) {
        const reason = licenseExpired ? "EXPIRED_LICENSE" : "EXPIRED_HEALTH_CARD";
        const label = licenseExpired ? "carnet profesional" : "libreta sanitaria";
        await prisma.user.update({ where: { id: p.userId }, data: { status: "DISABLED", disabledReason: reason } });
        await notifyUser(p.userId, "account.disabled.expiry", {
          body: `Tu cuenta fue <strong>bloqueada</strong> porque venció tu ${label}. Presentá la documentación renovada al administrador para que te desbloquee.`,
        });
        const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { email: true } });
        const html = adminAlertHtml("Empleado bloqueado por vencimiento", `<strong>${name}</strong> quedó bloqueado: venció su ${label}.`, undefined, undefined);
        await Promise.all(admins.map((a) => sendEmail(a.email, `Empleado bloqueado por vencimiento · ${name}`, html)));
        results.autoDisabled++;
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
