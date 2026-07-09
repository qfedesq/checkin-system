import "server-only";

// QA-053: logging estructurado mínimo para catch clauses que hoy se silencian
// (audit.ts, notify.ts, crons). No es un logger completo: sólo asegura que los
// errores queden en una línea JSON parseable en los logs de Vercel/CI.
export function logError(scope: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ scope, msg, at: new Date().toISOString() }));
}
