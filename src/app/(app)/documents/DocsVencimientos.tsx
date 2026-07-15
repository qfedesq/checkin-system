"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { compressImage } from "@/lib/image-compress";

type Doc = {
  key: "health" | "food" | "license";
  label: string;
  date: string;
  front: string;
  back: string;
  frontKind: string;
  backKind: string;
};

export function DocsVencimientos({ category, health, food, license }: {
  category: "DRIVER" | "HELPER";
  health: { date: string; front: string; back: string };
  food: { date: string; front: string; back: string };
  license: { date: string; front: string; back: string };
}) {
  const docs: Doc[] = [
    { key: "health", label: "Libreta sanitaria", date: health.date, front: health.front, back: health.back, frontKind: "healthFront", backKind: "healthBack" },
    { key: "food", label: "Curso de manipulación de alimentos", date: food.date, front: food.front, back: food.back, frontKind: "foodFront", backKind: "foodBack" },
  ];
  if (category === "DRIVER") {
    docs.push({ key: "license", label: "Carnet profesional", date: license.date, front: license.front, back: license.back, frontKind: "licenseFront", backKind: "licenseBack" });
  }

  return (
    <section className="panel mb-6 p-5">
      <h2 className="text-lg font-semibold">Vencimientos</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cargá o renová la fecha y las fotos de frente y dorso. Se comparten con Mi perfil.</p>
      <div className="mt-4 space-y-6">
        {docs.map((d) => <DocRow key={d.key} doc={d} />)}
      </div>
    </section>
  );
}

function DocRow({ doc }: { doc: Doc }) {
  const router = useRouter();
  const [date, setDate] = useState(doc.date);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function saveDate() {
    if (!date) return setMsg({ kind: "err", text: "Indicá la fecha de vencimiento" });
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/profile/expiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: doc.key, date }),
    });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: out.error ?? "Error" });
    if (out.pendingApproval) setMsg({ kind: "ok", text: "Fecha enviada: queda pendiente de aprobación del administrador." });
    else setMsg({ kind: "ok", text: "Fecha guardada" });
    router.refresh();
  }

  return (
    <div className="surface-card p-4">
      <div className="text-sm font-semibold">{doc.label}</div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="eyebrow">Vence</span>
          <input type="date" className="surface-control mt-1 max-w-[220px]" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" className="btn-primary" onClick={saveDate} disabled={busy}>{busy ? "Guardando…" : "Guardar fecha"}</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:max-w-md">
        <ImageSlot label="Frente" kind={doc.frontKind} url={doc.front} onError={(t) => setMsg({ kind: "err", text: t })} onPending={(t) => setMsg({ kind: "ok", text: t })} />
        <ImageSlot label="Dorso" kind={doc.backKind} url={doc.back} onError={(t) => setMsg({ kind: "err", text: t })} onPending={(t) => setMsg({ kind: "ok", text: t })} />
      </div>
      {msg && (
        <div className={`mt-3 rounded-xl border px-4 py-2 text-sm ${msg.kind === "ok" ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{msg.text}</div>
      )}
    </div>
  );
}

function ImageSlot({ label, kind, url, onError, onPending }: { label: string; kind: string; url: string; onError: (t: string) => void; onPending?: (t: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(url);
  const [imgFailed, setImgFailed] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const toSend = await compressImage(file);
      const form = new FormData();
      form.set("file", toSend);
      form.set("kind", kind);
      const res = await fetch("/api/profile/uploads", { method: "POST", body: form });
      // Si la respuesta no es JSON (413 de Vercel, 5xx con HTML), .json() tira:
      // lo tratamos como error en vez de dejar el botón colgado en "Subiendo…".
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return onError(out.error ?? "No pudimos subir la imagen. Probá con una foto más liviana.");
      // Perfil completo: queda pendiente de aprobación → no reemplazamos la imagen actual.
      if (out.pendingApproval) return onPending?.("Imagen enviada: queda pendiente de aprobación del administrador.");
      setImgFailed(false);
      setCurrent(out.url);
      router.refresh();
    } catch {
      onError("No pudimos subir la imagen. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="eyebrow">{label}</span>
      <button
        type="button"
        className="mt-1 grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg border border-dashed border-border/80 bg-secondary/40 transition hover:border-primary/50"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {current && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt={label} loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setImgFailed(true)} />
        ) : (
          <span className="flex flex-col items-center gap-1 px-2 text-center text-xs text-muted-foreground">
            <Upload className="h-4 w-4" />
            {busy ? "Subiendo…" : current ? "Vista previa no disponible · tocá para volver a subir" : "Subir"}
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </div>
  );
}
