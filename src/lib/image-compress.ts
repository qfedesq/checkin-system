// QA: Vercel limita el body de las funciones serverless a ~4.5 MB. Las fotos de
// iPhone (HEIC exportado a JPEG por el navegador) suelen pesar 3-10 MB, así que
// fallaban al subir aunque la app declare límites de 8/10/15 MB. Esta función
// redimensiona/recomprime la imagen EN EL CLIENTE antes de subirla, dejando
// margen bajo el límite real de Vercel.
//
// Funciones puras de navegador: nada de "use client" (no es un componente) ni
// imports de server. Ante cualquier error o resultado peor que el original,
// siempre devolvemos el File original — nunca tira.

export type CompressImageOptions = {
  maxDim?: number;
  quality?: number;
  maxBytes?: number;
};

const DEFAULT_MAX_DIM = 1600;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_MAX_BYTES = 3_800_000; // ~3.8MB, con margen bajo el límite de ~4.5MB de Vercel

function jpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^./\\]+$/, "");
  return `${base || "image"}.jpg`;
}

function drawToCanvas(bitmap: ImageBitmap, width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context (OffscreenCanvas)");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context (canvas)");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

async function canvasToJpegBlob(canvas: OffscreenCanvas | HTMLCanvasElement, quality: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob devolvió null"))),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Comprime/redimensiona una imagen en el navegador antes de subirla.
 * - No toca PDFs ni GIFs (los devuelve tal cual).
 * - "Hornea" la orientación EXIF (createImageBitmap con imageOrientation: "from-image").
 * - Reintenta con calidad decreciente hasta entrar bajo maxBytes.
 * - Ante cualquier error, o si el resultado no es más chico, devuelve el File original.
 */
export async function compressImage(file: File, opts?: CompressImageOptions): Promise<File> {
  const maxDim = opts?.maxDim ?? DEFAULT_MAX_DIM;
  const quality = opts?.quality ?? DEFAULT_QUALITY;
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;

  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const { width, height } = bitmap;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));

      const canvas = drawToCanvas(bitmap, targetWidth, targetHeight);

      const qualitySteps = [quality, 0.7, 0.6, 0.5];
      let blob: Blob | null = null;
      for (const q of qualitySteps) {
        const candidate = await canvasToJpegBlob(canvas, q);
        blob = candidate;
        if (candidate.size <= maxBytes) break;
      }
      if (!blob) return file;

      if (blob.size >= file.size) return file;

      return new File([blob], jpegFileName(file.name), { type: "image/jpeg" });
    } finally {
      bitmap.close?.();
    }
  } catch {
    return file;
  }
}
