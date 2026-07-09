import "server-only";
import crypto from "node:crypto";

// QA-002 (fix completo): las URLs de @vercel/blob son públicas (access:"public" es la única
// opción soportada por @vercel/blob 1.1.1). Para que la URL del blob nunca llegue al cliente,
// firmamos un token de corta vida que apunta a la URL real y la servimos vía proxy (/api/files).

const TOKEN_SEPARATOR = ".";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET no está configurado");
  return s;
}

function sign(payloadB64: string): string {
  return crypto.createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function signFileToken(blobUrl: string, ttlMs = 5 * 60 * 1000): string {
  const payload = JSON.stringify({ u: blobUrl, exp: Date.now() + ttlMs });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = sign(payloadB64);
  return `${payloadB64}${TOKEN_SEPARATOR}${sig}`;
}

export function verifyFileToken(token: string): string | null {
  if (!token) return null;
  const idx = token.indexOf(TOKEN_SEPARATOR);
  if (idx < 0) return null;
  const payloadB64 = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { u?: string; exp?: number };
    if (!payload.u || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload.u;
  } catch {
    return null;
  }
}

// Envuelve una blobUrl cruda en un link al proxy autenticado. Server-only: llamar siempre
// desde un server component o route handler, nunca desde el cliente.
export function fileUrl(blobUrl: string | null | undefined): string {
  if (!blobUrl) return "";
  return `/api/files?t=${encodeURIComponent(signFileToken(blobUrl))}`;
}
