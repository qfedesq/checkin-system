"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, ExternalLink } from "lucide-react";
import { daysUntil, formatDate, formatCalendarDate } from "@/lib/utils";

type Doc = {
  id: string;
  type: "DRIVER_LICENSE" | "HEALTH_CARD" | "OTHER";
  blobUrl: string;
  mimeType: string;
  expiresAt: string | null;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  note: string | null;
  createdAt: string;
};

const LABEL: Record<Doc["type"], string> = {
  DRIVER_LICENSE: "Carnet de conducir",
  HEALTH_CARD: "Libreta sanitaria",
  OTHER: "Otro",
};

export function DocumentsClient({ documents }: { documents: Doc[] }) {
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onUpload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "OTHER");
      fd.append("expiresAt", expires);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(body.error ?? "No pudimos subir el archivo. Probá con uno más liviano.");
      setExpires("");
      router.refresh();
    } catch {
      setErr("No pudimos subir el archivo. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Otros documentos</h2>
        <p className="mt-1 text-sm text-muted-foreground">Para libreta y carnet usá el bloque de arriba. Acá podés adjuntar cualquier otro documento.</p>
        <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/30 p-4">
          <label className="block">
            <span className="eyebrow">Vencimiento (opcional)</span>
            <input type="date" className="surface-control mt-1 w-full" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          <button type="button" className="btn-primary mt-3 w-full justify-center" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> {busy ? "Subiendo…" : "Seleccionar archivo"}
          </button>
          <p className="mt-3 text-xs text-muted-foreground">PDF, JPG o PNG · máx 10 MB</p>
        </div>
        {err && <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
      </section>

      <section className="panel mt-6 p-0 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-5 py-3">Tipo</th>
              <th className="px-3 py-3">Vencimiento</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Subido</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => {
              const days = daysUntil(d.expiresAt);
              return (
                <tr key={d.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {LABEL[d.type]}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {formatCalendarDate(d.expiresAt)}
                    {days !== null && days <= 30 && (
                      <span className={`ml-2 text-xs ${days <= 0 ? "text-destructive" : "text-primary"}`}>
                        {days <= 0 ? "vencido" : `en ${days}d`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {d.status === "APPROVED" && <span className="badge-success">aprobado</span>}
                    {d.status === "PENDING_REVIEW" && <span className="badge-accent">pendiente</span>}
                    {d.status === "REJECTED" && <span className="badge-danger">rechazado</span>}
                    {d.note && <div className="mt-1 text-xs text-muted-foreground">{d.note}</div>}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(d.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <a href={d.blobUrl} target="_blank" rel="noreferrer" className="btn-ghost">
                      <ExternalLink className="h-4 w-4" /> Ver
                    </a>
                  </td>
                </tr>
              );
            })}
            {documents.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Sin documentos cargados.</td></tr>
            )}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
