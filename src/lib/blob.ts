import "server-only";
import { put } from "@vercel/blob";

export async function uploadBlob(kind: string, file: Blob | Buffer, filename: string, contentType?: string) {
  // Nota (QA-002): @vercel/blob 1.1.1 sólo soporta access:"public". Mitigación parcial:
  // addRandomSuffix agrega un token aleatorio largo a la key → la URL deja de ser adivinable
  // (antes era timestamp + 6 chars). El fix completo (proxy autenticado para que la URL del blob
  // nunca llegue al cliente) queda pendiente de decisión de arquitectura.
  const res = await put(`${kind}/${filename}`, file, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return res.url;
}
