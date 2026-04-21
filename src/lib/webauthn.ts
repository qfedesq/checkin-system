import "server-only";
import crypto from "node:crypto";

export const rpName = process.env.WEBAUTHN_RP_NAME ?? "Checkin System";
export const rpID = process.env.WEBAUTHN_RP_ID ?? (process.env.VERCEL_URL ? new URL(`https://${process.env.VERCEL_URL}`).hostname : "localhost");
export const origin = process.env.AUTH_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export function deviceHashFromCredentialId(credentialId: Uint8Array | Buffer | string): string {
  const buf = typeof credentialId === "string" ? Buffer.from(credentialId, "base64url") : Buffer.from(credentialId);
  return crypto.createHash("sha256").update(buf).digest("hex");
}
