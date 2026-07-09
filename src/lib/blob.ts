import "server-only";
import { put } from "@vercel/blob";

// QA-035: `filename` viene del cliente (nombre original del archivo elegido) y se
// concatenaba tal cual en la key del blob. Como ya usamos addRandomSuffix, el nombre
// es puramente cosmético (no hace falta que sea único) — pero sin sanitizar podía
// meter "/", "..", espacios o caracteres raros en la key. Nos quedamos sólo con
// [a-zA-Z0-9._-] y recortamos longitud para que nunca rompa el path del blob.
function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  return cleaned || "file";
}

export async function uploadBlob(kind: string, file: Blob | Buffer, filename: string, contentType?: string) {
  // Nota (QA-002): @vercel/blob 1.1.1 sólo soporta access:"public". Mitigación parcial:
  // addRandomSuffix agrega un token aleatorio largo a la key → la URL deja de ser adivinable
  // (antes era timestamp + 6 chars). El fix completo (proxy autenticado para que la URL del blob
  // nunca llegue al cliente) queda pendiente de decisión de arquitectura.
  const res = await put(`${kind}/${sanitizeFilename(filename)}`, file, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return res.url;
}
