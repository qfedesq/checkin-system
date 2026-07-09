import "server-only";
import { prisma } from "./prisma";
import { sendEmail, adminAlertHtml } from "./email";
import { sendPushToUser } from "./push";
import { logError } from "./log";

function appUrl(path = "") {
  const base = process.env.AUTH_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return base.replace(/\/$/, "") + path;
}

async function adminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { email: true },
  });
  return admins.map((a) => a.email);
}

export async function notifyAdmins(kind: "user.registered" | "leave.created" | "document.uploaded" | "profile.change.requested" | "device.pending", payload: {
  actorName?: string | null;
  actorEmail: string;
  detail?: string;
}) {
  const to = await adminEmails();
  if (to.length === 0) return;

  const actor = payload.actorName || payload.actorEmail;

  const presets: Record<typeof kind, { subject: string; title: string; body: string; path: string; label: string }> = {
    "user.registered": {
      subject: `Nuevo empleado pendiente · ${actor}`,
      title: "Nuevo empleado registrado",
      body: `<strong>${actor}</strong> creó una cuenta y está esperando validación.`,
      path: "/admin/users",
      label: "Aprobar usuario",
    },
    "leave.created": {
      subject: `Nueva solicitud · ${actor}`,
      title: "Nueva solicitud de vacaciones / franco",
      body: `<strong>${actor}</strong> envió una solicitud: ${payload.detail ?? ""}`,
      path: "/admin/leaves",
      label: "Revisar solicitud",
    },
    "document.uploaded": {
      subject: `Nuevo documento cargado · ${actor}`,
      title: "Documento pendiente de validación",
      body: `<strong>${actor}</strong> subió: ${payload.detail ?? "un documento"}`,
      path: "/admin/documents",
      label: "Revisar documento",
    },
    "profile.change.requested": {
      subject: `Cambios de perfil pendientes · ${actor}`,
      title: "Cambios de perfil para revisar",
      body: `<strong>${actor}</strong> propuso cambios en su perfil: ${payload.detail ?? ""}`,
      path: "/admin/profile-changes",
      label: "Revisar cambios",
    },
    "device.pending": {
      subject: `Dispositivo pendiente de aprobación · ${actor}`,
      title: "Dispositivo nuevo para aprobar",
      body: `<strong>${actor}</strong> registró su biometría en un dispositivo. Hasta que lo apruebes no va a poder fichar.`,
      path: "/admin/users",
      label: "Aprobar dispositivo",
    },
  };

  const p = presets[kind];
  const html = adminAlertHtml(p.title, p.body, appUrl(p.path), p.label);

  await Promise.all(to.map((addr) => sendEmail(addr, p.subject, html)));
}

export type EmployeeEvent =
  | "leave.approved"
  | "leave.rejected"
  | "profile.change.approved"
  | "profile.change.rejected"
  | "delivery.new"
  | "expiry.reminder"
  | "attendance.checkout.reminder"
  | "device.approved"
  | "device.rejected"
  | "account.disabled.expiry";

const EMPLOYEE_PRESETS: Record<EmployeeEvent, { subject: string; title: string; path: string; label: string }> = {
  "leave.approved": { subject: "Solicitud aprobada", title: "Tu solicitud fue aprobada", path: "/calendar", label: "Ver calendario" },
  "leave.rejected": { subject: "Solicitud rechazada", title: "Tu solicitud fue rechazada", path: "/calendar", label: "Ver calendario" },
  "profile.change.approved": { subject: "Cambios de perfil aprobados", title: "Tus cambios de perfil fueron aprobados", path: "/profile", label: "Ver perfil" },
  "profile.change.rejected": { subject: "Cambios de perfil rechazados", title: "Tus cambios de perfil fueron rechazados", path: "/profile", label: "Ver perfil" },
  "delivery.new": { subject: "Nuevo documento disponible", title: "Tenés un documento nuevo", path: "/inbox", label: "Abrir documento" },
  "expiry.reminder": { subject: "Recordatorio de vencimiento", title: "Documentación por vencer", path: "/documents", label: "Actualizar documentación" },
  "attendance.checkout.reminder": { subject: "¿Seguís prestando servicio?", title: "¿Seguís prestando servicio?", path: "/checkin", label: "Hacer check-out" },
  "device.approved": { subject: "Dispositivo aprobado", title: "Tu dispositivo fue aprobado", path: "/checkin", label: "Hacer check-in" },
  "device.rejected": { subject: "Dispositivo rechazado", title: "Tu dispositivo fue rechazado", path: "/login", label: "Ingresar" },
  "account.disabled.expiry": { subject: "Cuenta bloqueada por vencimiento", title: "Tu cuenta fue bloqueada", path: "/login", label: "Ingresar" },
};

/** Notifica a un empleado por email + push. El fallo de un canal nunca bloquea al otro. */
export async function notifyUser(userId: string, event: EmployeeEvent, payload: { body: string; detail?: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, profile: { select: { firstName: true } } },
  });
  if (!user) return;

  const p = EMPLOYEE_PRESETS[event];
  const html = adminAlertHtml(p.title, payload.body, appUrl(p.path), p.label);

  const results = await Promise.allSettled([
    sendEmail(user.email, p.subject, html),
    sendPushToUser(userId, { title: p.title, body: payload.body.replace(/<[^>]+>/g, ""), url: appUrl(p.path) }),
  ]);
  for (const r of results) {
    if (r.status === "rejected") logError("notify.notifyUser", r.reason);
  }
}
