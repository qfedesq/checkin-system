"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, RotateCcw, Upload } from "lucide-react";

/**
 * Pad de firma: el empleado firma con el dedo/mouse en el canvas y se guarda como PNG
 * con FONDO TRANSPARENTE (sólo el trazo), para que al estamparse en un recibo/documento
 * no tape el texto de abajo. El recuadro se ve blanco en pantalla sólo por CSS (bg-white).
 */
export function SignaturePad({ url, onUploaded, onError, onPending, invalid }: {
  url: string;
  onUploaded: (url: string) => void;
  onError: (text: string) => void;
  onPending?: (text: string) => void;
  invalid?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [editing, setEditing] = useState(!url);
  const [busy, setBusy] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  function setupCanvas(preserve: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Si ya había trazo, lo exportamos antes de redimensionar (cambiar
    // canvas.width/height borra el contenido) para poder redibujarlo escalado
    // al nuevo tamaño (rotación de pantalla, resize, etc).
    let snapshot: HTMLImageElement | null = null;
    if (preserve && dirty.current && canvas.width > 0 && canvas.height > 0) {
      snapshot = new Image();
      snapshot.src = canvas.toDataURL("image/png");
    }
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    // Sin relleno de fondo: el canvas queda transparente (el blanco lo pone el CSS).
    // Así el PNG exportado sólo tiene el trazo y no tapa el texto del documento.
    ctx.strokeStyle = "#0a101c";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (snapshot) {
      snapshot.onload = () => {
        ctx.drawImage(snapshot!, 0, 0, rect.width, rect.height);
      };
    }
  }

  useEffect(() => {
    if (!editing) return;
    setupCanvas(false);

    function handleResize() {
      setupCanvas(true);
    }
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
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
    ctx.clearRect(0, 0, rect.width, rect.height); // limpia a transparente (no a blanco)
    dirty.current = false;
    setHasStrokes(false);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) return onError("Firmá en el recuadro antes de guardar");
    setBusy(true);
    canvas.toBlob(async (blob) => {
      if (!blob) { setBusy(false); return onError("No pudimos generar la firma"); }
      try {
        const form = new FormData();
        form.set("file", new File([blob], "firma.png", { type: "image/png" }));
        form.set("kind", "signature");
        const res = await fetch("/api/profile/uploads", { method: "POST", body: form });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) return onError(out.error ?? "No pudimos guardar la firma");
        // Perfil completo: queda pendiente de aprobación → mantenemos la firma actual visible.
        if (out.pendingApproval) onPending?.("Firma enviada: queda pendiente de aprobación del administrador.");
        else onUploaded(out.url);
        setEditing(false);
      } catch {
        onError("No pudimos guardar la firma. Revisá tu conexión e intentá de nuevo.");
      } finally {
        setBusy(false);
      }
    }, "image/png");
  }

  async function uploadImage(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", "signature");
      const res = await fetch("/api/profile/uploads", { method: "POST", body: form });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return onError(out.error ?? "No pudimos subir la imagen de firma");
      if (out.pendingApproval) onPending?.("Firma enviada: queda pendiente de aprobación del administrador.");
      else onUploaded(out.url);
      setEditing(false);
    } catch {
      onError("No pudimos subir la imagen. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-4">
        <div className="surface-card flex h-24 w-48 items-center justify-center overflow-hidden bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="firma"
            width={192}
            height={96}
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain"
          />
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
        className={`h-40 w-full max-w-md touch-none rounded-xl border border-dashed ${invalid ? "border-destructive" : "border-border/80"} bg-white`}
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
