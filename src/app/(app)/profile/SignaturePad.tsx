"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, RotateCcw, Upload } from "lucide-react";

/**
 * Pad de firma: el empleado firma con el dedo/mouse en el canvas y se guarda como PNG
 * (fondo blanco) para usarse como firma digital en recibos y documentos.
 */
export function SignaturePad({ url, onUploaded, onError }: {
  url: string;
  onUploaded: (url: string) => void;
  onError: (text: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [editing, setEditing] = useState(!url);
  const [busy, setBusy] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#0a101c";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [editing]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
    if (!hasStrokes) setHasStrokes(true);
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    dirty.current = false;
    setHasStrokes(false);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) return onError("Firmá en el recuadro antes de guardar");
    setBusy(true);
    canvas.toBlob(async (blob) => {
      if (!blob) { setBusy(false); return onError("No pudimos generar la firma"); }
      const form = new FormData();
      form.set("file", new File([blob], "firma.png", { type: "image/png" }));
      form.set("kind", "signature");
      const res = await fetch("/api/profile/uploads", { method: "POST", body: form });
      const out = await res.json();
      setBusy(false);
      if (!res.ok) return onError(out.error ?? "No pudimos guardar la firma");
      onUploaded(out.url);
      setEditing(false);
    }, "image/png");
  }

  async function uploadImage(file: File) {
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "signature");
    const res = await fetch("/api/profile/uploads", { method: "POST", body: form });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) return onError(out.error ?? "No pudimos subir la imagen de firma");
    onUploaded(out.url);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-4">
        <div className="surface-card flex h-24 w-48 items-center justify-center overflow-hidden bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="firma" className="max-h-full max-w-full object-contain" />
        </div>
        <button type="button" className="btn-ghost" onClick={() => { setHasStrokes(false); setEditing(true); }}>
          <RotateCcw className="h-4 w-4" /> Volver a firmar
        </button>
      </div>
    );
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        aria-label="Área para dibujar tu firma con el dedo o el mouse"
        className="h-40 w-full max-w-md touch-none rounded-xl border border-dashed border-border/80 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={busy || !hasStrokes}>
          {busy ? "Guardando…" : "Guardar firma"}
        </button>
        <button type="button" className="btn-ghost" onClick={clear} disabled={busy}>
          <Eraser className="h-4 w-4" /> Borrar
        </button>
        <button type="button" className="btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          <Upload className="h-4 w-4" /> Subir imagen de firma
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) uploadImage(file);
          }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Firmá con el dedo dentro del recuadro y tocá “Guardar firma”, o subí una imagen si no podés dibujar.</p>
    </div>
  );
}
