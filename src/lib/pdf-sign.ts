import "server-only";
import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type SignAnchor = "bottom-left" | "bottom-right" | "top-left" | "top-right";

const MARGIN = 40;
const BOX_W = 300;
const BOX_H = 110;
const PAD = 10;
const IMG_MAX_W = 90;
const IMG_MAX_H = 50;

// Recorta el texto (con "…") para que entre en maxWidth con la fuente/tamaño dados.
function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 0 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return cut.length > 0 ? `${cut}…` : cut;
}

export async function signPdf(
  originalBytes: Uint8Array,
  signatureImageBytes: Uint8Array | null,
  meta: { name: string; cuil: string; email: string },
  opts?: { anchor?: SignAnchor; page?: number | null },
) {
  const hash = crypto.createHash("sha256").update(originalBytes).digest("hex");
  const pdf = await PDFDocument.load(originalBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let sigImage = null;
  if (signatureImageBytes) {
    try { sigImage = await pdf.embedPng(signatureImageBytes); } catch {
      try { sigImage = await pdf.embedJpg(signatureImageBytes); } catch { sigImage = null; }
    }
  }

  const pages = pdf.getPages();
  const requestedPage = opts?.page;
  const pageIndex =
    requestedPage && requestedPage >= 1 && requestedPage <= pages.length ? requestedPage - 1 : pages.length - 1;
  const target = pages[pageIndex];
  const { width, height } = target.getSize();

  const anchor: SignAnchor = opts?.anchor ?? "bottom-left";
  const boxX = anchor === "bottom-right" || anchor === "top-right" ? width - BOX_W - MARGIN : MARGIN;
  const boxY = anchor === "top-left" || anchor === "top-right" ? height - BOX_H - MARGIN : MARGIN;

  target.drawRectangle({ x: boxX, y: boxY, width: BOX_W, height: BOX_H, borderColor: rgb(0.12, 0.14, 0.22), borderWidth: 1, color: rgb(0.98, 0.98, 0.99), opacity: 0.95 });

  // Las filas de nombre/CUIL/email/fecha caen dentro de la franja vertical de la imagen
  // de firma (si hay), así que se les recorta el ancho disponible para no pisarla.
  const textMaxWidth = BOX_W - PAD * 2 - (sigImage ? IMG_MAX_W + 8 : 0);

  target.drawText("FIRMADO DIGITALMENTE", { x: boxX + PAD, y: boxY + BOX_H - 16, size: 7, font: fontBold, color: rgb(0.2, 0.2, 0.3) });
  target.drawText(fitText(meta.name, fontBold, 10, textMaxWidth), { x: boxX + PAD, y: boxY + BOX_H - 32, size: 10, font: fontBold, color: rgb(0, 0, 0) });
  target.drawText(fitText(`CUIL: ${meta.cuil}`, font, 8, textMaxWidth), { x: boxX + PAD, y: boxY + BOX_H - 47, size: 8, font, color: rgb(0.1, 0.1, 0.1) });
  target.drawText(fitText(meta.email, font, 8, textMaxWidth), { x: boxX + PAD, y: boxY + BOX_H - 60, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
  target.drawText(fitText(`Firmado el ${new Date().toLocaleString("es-AR")}`, font, 7, textMaxWidth), { x: boxX + PAD, y: boxY + BOX_H - 73, size: 7, font, color: rgb(0.3, 0.3, 0.3) });
  target.drawText(`SHA-256: ${hash.slice(0, 32)}…`, { x: boxX + PAD, y: boxY + 10, size: 6, font, color: rgb(0.3, 0.3, 0.3) });

  if (sigImage) {
    const scale = Math.min(IMG_MAX_W / sigImage.width, IMG_MAX_H / sigImage.height);
    const w = sigImage.width * scale;
    const h = sigImage.height * scale;
    target.drawImage(sigImage, {
      x: boxX + BOX_W - w - PAD,
      y: boxY + (BOX_H - h) / 2,
      width: w,
      height: h,
    });
  }

  pdf.setSubject(`Firmado por ${meta.name} (${meta.cuil})`);
  pdf.setProducer("Emmalva");
  pdf.setKeywords(["signed", hash]);

  const out = await pdf.save();
  return { bytes: out, hash };
}
