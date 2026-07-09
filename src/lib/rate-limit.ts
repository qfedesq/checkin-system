/**
 * Rate limiter best-effort, en memoria, por instancia del proceso.
 *
 * LIMITACIÓN IMPORTANTE (serverless): en Vercel/AWS Lambda cada invocación
 * puede ejecutarse en una instancia distinta (o una instancia "fría" nueva),
 * y este Map vive únicamente en la memoria de esa instancia. Es decir, el
 * conteo NO es global entre instancias: un atacante que reparta su tráfico
 * (o que simplemente tenga mala suerte de pegarle a instancias distintas)
 * puede superar el límite nominal. Esto sirve para frenar scripts simples de
 * fuerza bruta / enumeración de un solo hilo, pero NO es una defensa robusta.
 *
 * Para rate limiting correcto en un entorno serverless multi-instancia se
 * necesita un store compartido (ej. Upstash Redis + @upstash/ratelimit, o un
 * contador en la base de datos). Eso queda fuera de alcance de este fix
 * (QA-022) — se documenta la limitación en vez de implementarlo.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

// Poda perezosa: no hay timers persistentes entre invocaciones serverless,
// así que limpiamos buckets vencidos cuando el Map empieza a crecer.
function prune(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  opts: { limit?: number; windowMs?: number } = {},
): { ok: boolean; retryAfterSec?: number } {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();

  prune(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { ok: true };
}

/** Extrae una IP "mejor esfuerzo" de los headers estándar de proxy/CDN. */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
