import "server-only";

// QA-034: los endpoints de upload validaban sólo el `file.type` (MIME) que declara el
// cliente en el FormData — un atacante puede subir cualquier binario etiquetado como
// "image/png". Esta función lee los primeros bytes reales del archivo y los compara
// contra la firma ("magic bytes") del formato esperado.
export type SniffedType = "png" | "jpeg" | "webp" | "pdf";

async function readHeader(file: File, len: number): Promise<Uint8Array> {
  const buf = await file.slice(0, len).arrayBuffer();
  return new Uint8Array(buf);
}

export async function sniffType(file: File): Promise<SniffedType | null> {
  const bytes = await readHeader(file, 12);

  // PNG: 89 50 4E 47
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  // PDF: "%PDF" (25 50 44 46)
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "pdf";
  }
  return null;
}

const MIME_TO_SNIFFED: Record<string, SniffedType> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// Verifica que el contenido real del archivo (magic bytes) sea consistente con el
// MIME declarado por el cliente. Devuelve true si coincide.
export async function matchesDeclaredType(file: File): Promise<boolean> {
  const expected = MIME_TO_SNIFFED[file.type];
  if (!expected) return false;
  const sniffed = await sniffType(file);
  return sniffed === expected;
}
