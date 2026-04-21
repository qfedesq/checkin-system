import "server-only";
import { prisma } from "./prisma";
import { sendEmail, adminAlertHtml } from "./email";

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

export async function notifyAdmins(kind: "user.registered" | "leave.created" | "document.uploaded", payload: {
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
  };

  const p = presets[kind];
  const html = adminAlertHtml(p.title, p.body, appUrl(p.path), p.label);

  await Promise.all(to.map((addr) => sendEmail(addr, p.subject, html)));
}
