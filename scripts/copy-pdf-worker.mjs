#!/usr/bin/env node
// Copia el worker de pdfjs-dist a /public para servirlo como asset estático simple
// (evita bundlear el worker vía import.meta.url, que complica el build de Next 15).
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const src = resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const dest = resolve("public/pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn("[copy-pdf-worker] no se encontró pdfjs-dist; se omite la copia");
  process.exit(0);
}
copyFileSync(src, dest);
console.log("[copy-pdf-worker] public/pdf.worker.min.mjs actualizado");
