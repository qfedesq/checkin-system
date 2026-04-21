import "server-only";
import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function signPdf(originalBytes: Uint8Array, signatureImageBytes: Uint8Array | null, meta: { name: string; cuil: string; email: string }) {
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
  const last = pages[pages.length - 1];
  const { width } = last.getSize();

  const boxH = 110;
  const boxW = width - 80;
  const boxX = 40;
  const boxY = 40;

  last.drawRectangle({ x: boxX, y: boxY, width: boxW, height: boxH, borderColor: rgb(0.12, 0.14, 0.22), borderWidth: 1, color: rgb(0.98, 0.98, 0.99), opacity: 0.95 });
  last.drawText("FIRMADO DIGITALMENTE", { x: boxX + 12, y: boxY + boxH - 18, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.3) });
  last.drawText(meta.name, { x: boxX + 12, y: boxY + boxH - 34, size: 11, font: fontBold, color: rgb(0, 0, 0) });
  last.drawText(`CUIL: ${meta.cuil}`, { x: boxX + 12, y: boxY + boxH - 50, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
  last.drawText(`${meta.email}`, { x: boxX + 12, y: boxY + boxH - 64, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  last.drawText(`Firmado el ${new Date().toLocaleString("es-AR")}`, { x: boxX + 12, y: boxY + boxH - 78, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
  last.drawText(`SHA-256: ${hash.slice(0, 48)}…`, { x: boxX + 12, y: boxY + 10, size: 7, font, color: rgb(0.3, 0.3, 0.3) });

  if (sigImage) {
    const maxW = 150, maxH = 60;
    const scale = Math.min(maxW / sigImage.width, maxH / sigImage.height);
    const w = sigImage.width * scale;
    const h = sigImage.height * scale;
    last.drawImage(sigImage, {
      x: boxX + boxW - w - 12,
      y: boxY + (boxH - h) / 2,
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
