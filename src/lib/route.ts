import "server-only";
import { NextResponse } from "next/server";
import { logError } from "@/lib/log";

// QA-013: la mayoría de los route handlers no tenían try/catch propio, así que una excepción
// no controlada (Prisma, Blob, pdf-lib, fetch, etc.) salía como un 500 crudo de Next, sin
// loguear nada. Este wrapper es la defensa en profundidad: si el handler no capturó el error,
// lo logueamos acá (logError) y devolvemos un 500 JSON uniforme en vez de exponer el stack.
// No cambia el comportamiento normal: sólo actúa cuando `fn` lanza/rechaza.
export function route<T extends (...args: any[]) => Promise<Response>>(scope: string, fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (e) {
      logError(scope, e);
      return NextResponse.json({ error: "Error interno. Intentá de nuevo." }, { status: 500 });
    }
  }) as T;
}
