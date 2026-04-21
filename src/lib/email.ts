import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";

type Driver = "smtp" | "resend" | "stub";

const GMAIL_USER = process.env.GMAIL_USER ?? "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM = process.env.RESEND_FROM ?? "";

function pickDriver(): Driver {
  if (GMAIL_USER && GMAIL_APP_PASSWORD) return "smtp";
  if (RESEND_API_KEY) return "resend";
  return "stub";
}

let smtp: nodemailer.Transporter | null = null;
function getSmtp() {
  if (!smtp) {
    smtp = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s+/g, "") },
    });
  }
  return smtp;
}

let resend: Resend | null = null;
function getResend() {
  if (!resend) resend = new Resend(RESEND_API_KEY);
  return resend;
}

function defaultFrom(): string {
  if (GMAIL_USER) {
    const name = process.env.MAIL_FROM_NAME ?? "Emmalva";
    return `${name} <${GMAIL_USER}>`;
  }
  return RESEND_FROM || "Emmalva <no-reply@emmalva.local>";
}

export async function sendEmail(to: string, subject: string, html: string, opts?: { replyTo?: string }) {
  const driver = pickDriver();
  const from = defaultFrom();
  const replyTo = opts?.replyTo ?? GMAIL_USER ?? undefined;

  if (driver === "stub") {
    console.log(`[email:stub] from=${from} to=${to} subject="${subject}"`);
    return { ok: false, driver, stub: true as const };
  }

  try {
    if (driver === "smtp") {
      const info = await getSmtp().sendMail({ from, to, subject, html, replyTo });
      return { ok: true, driver, messageId: info.messageId };
    }
    const { error } = await getResend().emails.send({ from, to, subject, html, replyTo });
    if (error) throw error;
    return { ok: true, driver };
  } catch (err) {
    console.error(`[email:${driver}] error sending to ${to}`, err);
    return { ok: false, driver, error: err };
  }
}

export function expiryEmailHtml(name: string, label: string, expiresAt: Date, days: number) {
  const dateStr = expiresAt.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  return `
    <div style="font-family: Nunito, Arial, sans-serif; background:#0a101c; color:#eef1f7; padding:32px; border-radius:16px; max-width:560px;">
      <h2 style="color:#29ABE2; margin:0 0 12px;">Recordatorio de vencimiento</h2>
      <p>Hola ${name || "equipo"},</p>
      <p>Tu <strong>${label}</strong> vence el <strong>${dateStr}</strong> (en ${days} día${days === 1 ? "" : "s"}).</p>
      <p>Entrá a la plataforma y cargá la documentación actualizada.</p>
      <p style="opacity:0.7; font-size:12px; margin-top:24px;">Emmalva · Workforce</p>
    </div>
  `;
}

export function adminAlertHtml(title: string, body: string, actionUrl?: string, actionLabel?: string) {
  return `
    <div style="font-family: Nunito, Arial, sans-serif; background:#f4f7fa; color:#1b2030; padding:32px; border-radius:16px; max-width:560px;">
      <h2 style="color:#29ABE2; margin:0 0 12px;">${title}</h2>
      <p style="color:#374151; line-height:1.6;">${body}</p>
      ${actionUrl ? `<p style="margin-top:20px;"><a href="${actionUrl}" style="background:#29ABE2; color:#fff; padding:10px 18px; border-radius:10px; text-decoration:none; font-weight:600;">${actionLabel ?? "Revisar"}</a></p>` : ""}
      <p style="opacity:0.6; font-size:12px; margin-top:24px;">Emmalva · Workforce</p>
    </div>
  `;
}
