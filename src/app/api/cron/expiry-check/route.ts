import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, expiryEmailHtml, adminAlertHtml } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { notifyUser } from "@/lib/notify";
import { daysUntil, formatCalendarDate } from "@/lib/utils";
import { logError } from "@/lib/log";
import { route } from "@/lib/route";

const PLACEHOLDER_YEAR = 2098; // libretas "2099-12-31" = sin dato, no cuentan
const BATCH_SIZE = 10;

async function processInBatches<T>(items: T[], fn: (item: T) => Promise<void>, size = BATCH_SIZE) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

// QA-021: fail-closed (sin CRON_SECRET configurado, nadie pasa) + comparación timing-safe.
// Header preferido: Authorization: Bearer <secret>. Se acepta ?key= como fallback.
function isAuthorized(req: NextRequest): boolean {
  const secretEnv = process.env.CRON_SECRET;
  if (!secretEnv) return false;

  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : req.nextUrl.searchParams.get("key") ?? "";

  const a = Buffer.from(provided);
  const b = Buffer.from(secretEnv);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const maxDuration = 60;

export const GET = route("cron.expiry-check", async (req: NextRequest) => {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    return await runExpiryCheck();
  } catch (err) {
    logError("cron.expiry-check", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
});

async function runExpiryCheck() {
  const results = { profilesNotified: 0, docsNotified: 0, autoDisabled: 0 };
  const now = new Date();

  // Perfiles con vencimientos próximos
  const profiles = await prisma.employeeProfile.findMany({
    include: { user: { select: { email: true, status: true, role: true, expiryBlockClearedAt: true } } },
  });

  await processInBatches(profiles, async (p) => {
    if (p.user.status !== "ACTIVE") return;
    const name = `${p.firstName} ${p.lastName}`.trim();

    if (p.healthCardExpiry && p.healthCardExpiry.getFullYear() <= PLACEHOLDER_YEAR) {
      const d = daysUntil(p.healthCardExpiry);
      if (d !== null && d <= 30 && d >= 0) {
        const last = p.notifiedHealthExpiryAt?.toDateString();
        if (last !== now.toDateString()) {
          await sendEmail(p.user.email, "Tu libreta sanitaria vence pronto", expiryEmailHtml(name, "libreta sanitaria", p.healthCardExpiry, d));
          await sendPushToUser(p.userId, { title: "Libreta sanitaria por vencer", body: `Vence el ${formatCalendarDate(p.healthCardExpiry)} (en ${d} día${d === 1 ? "" : "s"}). Renovala para no quedar bloqueado.`, url: "/documents" });
          await prisma.employeeProfile.update({ where: { userId: p.userId }, data: { notifiedHealthExpiryAt: now } });
          results.profilesNotified++;
        }
      }
    }

    if (p.foodCourseExpiry && p.foodCourseExpiry.getFullYear() <= PLACEHOLDER_YEAR) {
      const d = daysUntil(p.foodCourseExpiry);
      if (d !== null && d <= 30 && d >= 0) {
        const last = p.notifiedFoodCourseExpiryAt?.toDateString();
        if (last !== now.toDateString()) {
          await sendEmail(p.user.email, "Tu curso de manipulación de alimentos vence pronto", expiryEmailHtml(name, "curso de manipulación de alimentos", p.foodCourseExpiry, d));
          await sendPushToUser(p.userId, { title: "Curso de manipulación de alimentos por vencer", body: `Vence el ${formatCalendarDate(p.foodCourseExpiry)} (en ${d} día${d === 1 ? "" : "s"}). Renovalo para no quedar bloqueado.`, url: "/documents" });
          await prisma.employeeProfile.update({ where: { userId: p.userId }, data: { notifiedFoodCourseExpiryAt: now } });
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
          await sendPushToUser(p.userId, { title: "Carnet profesional por vencer", body: `Vence el ${formatCalendarDate(p.professionalLicenseExpiry)} (en ${d} día${d === 1 ? "" : "s"}). Renovalo para no quedar bloqueado.`, url: "/documents" });
          await prisma.employeeProfile.update({ where: { userId: p.userId }, data: { notifiedLicenseExpiryAt: now } });
          results.profilesNotified++;
        }
      }
    }

    // Bloqueo automático: al día siguiente del vencimiento, sólo el admin puede desbloquear.
    // Si el admin ya desbloqueó (expiryBlockClearedAt), NO se re-bloquea por un vencimiento
    // anterior a esa marca: sólo por uno que venza DESPUÉS (documento distinto o renovación
    // que volvió a vencer). Así el desbloqueo del admin queda firme hasta un vencimiento nuevo.
    if (p.user.role !== "ADMIN") {
      const cleared = p.user.expiryBlockClearedAt;
      const blocks = (exp: Date | null) =>
        !!exp && exp.getFullYear() <= PLACEHOLDER_YEAR && (daysUntil(exp) ?? 1) < 0 && (!cleared || exp.getTime() > cleared.getTime());
      const healthExpired = blocks(p.healthCardExpiry);
      const foodExpired = blocks(p.foodCourseExpiry);
      const licenseExpired = p.category === "DRIVER" && blocks(p.professionalLicenseExpiry);

      if (healthExpired || licenseExpired || foodExpired) {
        const reason = licenseExpired ? "EXPIRED_LICENSE" : healthExpired ? "EXPIRED_HEALTH_CARD" : "EXPIRED_FOOD_COURSE";
        const label = licenseExpired ? "carnet profesional" : healthExpired ? "libreta sanitaria" : "curso de manipulación de alimentos";
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
  });

  // Documentos subidos con vencimiento (sólo de usuarios ACTIVE: antes se notificaba
  // igual a empleados deshabilitados/pendientes, que ni siquiera pueden entrar a renovar).
  const docs = await prisma.documentUpload.findMany({
    where: { expiresAt: { not: null }, status: "APPROVED" },
    include: { user: { select: { email: true, status: true, profile: { select: { firstName: true, lastName: true } } } } },
  });

  await processInBatches(docs, async (doc) => {
    if (doc.user.status !== "ACTIVE") return;
    if (!doc.expiresAt) return;
    const d = daysUntil(doc.expiresAt);
    if (d === null || d > 30 || d < 0) return;
    const last = doc.notifiedAt?.toDateString();
    if (last === now.toDateString()) return;
    const name = doc.user.profile ? `${doc.user.profile.firstName} ${doc.user.profile.lastName}`.trim() : "";
    const label = doc.type === "DRIVER_LICENSE" ? "carnet de conducir" : doc.type === "HEALTH_CARD" ? "libreta sanitaria" : "documento";
    await sendEmail(doc.user.email, `Tu ${label} vence pronto`, expiryEmailHtml(name, label, doc.expiresAt, d));
    await sendPushToUser(doc.userId, { title: `${label[0].toUpperCase()}${label.slice(1)} por vencer`, body: `Vence el ${formatCalendarDate(doc.expiresAt)} (en ${d} día${d === 1 ? "" : "s"}). Renovalo para no quedar bloqueado.`, url: "/documents" });
    await prisma.documentUpload.update({ where: { id: doc.id }, data: { notifiedAt: now } });
    results.docsNotified++;
  });

  return NextResponse.json({ ok: true, ...results });
}
