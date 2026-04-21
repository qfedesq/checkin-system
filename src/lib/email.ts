import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM ?? "Checkin System <no-reply@checkin.local>";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[email:stub] to=${to} subject=${subject}`);
    return { ok: false, stub: true };
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error("[email] error", error);
    return { ok: false, error };
  }
  return { ok: true };
}

export function expiryEmailHtml(name: string, label: string, expiresAt: Date, days: number) {
  const dateStr = expiresAt.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  return `
    <div style="font-family: Space Grotesk, Arial, sans-serif; background:#0a0e1a; color:#eef1f7; padding:32px; border-radius:16px;">
      <h2 style="color:#F54703; margin:0 0 12px;">Recordatorio de vencimiento</h2>
      <p>Hola ${name || "equipo"},</p>
      <p>Tu <strong>${label}</strong> vence el <strong>${dateStr}</strong> (en ${days} días).</p>
      <p>Entrá a la plataforma y cargá la documentación actualizada.</p>
      <p style="opacity:0.7; font-size:12px; margin-top:24px;">Checkin System · Protofire Suite</p>
    </div>
  `;
}
