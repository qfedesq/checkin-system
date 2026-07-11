"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Send, FileText, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Row = { id: string; title: string; type: "PAYSLIP" | "INTERNAL_DOC" | "OTHER"; recipient: string; openedAt: string | null; createdAt: string };
type SignAnchor = "bottom-left" | "bottom-right" | "top-left" | "top-right";

const TYPE_LABEL = { PAYSLIP: "Recibo de sueldo", INTERNAL_DOC: "Documento interno", OTHER: "Otro" };
const ANCHOR_LABEL: Record<SignAnchor, string> = {
  "bottom-left": "Abajo izquierda",
  "bottom-right": "Abajo derecha",
  "top-left": "Arriba izquierda",
  "top-right": "Arriba derecha",
};

export function DeliveriesClient({ employees, rows, initialRecipientId }: { employees: { id: string; label: string }[]; rows: Row[]; initialRecipientId?: string }) {
  const router = useRouter();
  const [recipientId, setRecipientId] = useState(
    initialRecipientId && employees.some((e) => e.id === initialRecipientId) ? initialRecipientId : employees[0]?.id ?? "",
  );
  const [type, setType] = useState<Row["type"]>("PAYSLIP");
  const [title, setTitle] = useState("");
  const [signAnchor, setSignAnchor] = useState<SignAnchor>("bottom-left");
  const [signPage, setSignPage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function clearFile() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Enviar es un paso explícito: primero se elige el PDF (queda a la vista) y recién
  // al tocar "Enviar" se sube y se entrega. Antes se enviaba solo al elegir el archivo.
  async function send() {
    if (!recipientId) return setErr("Elegí un destinatario");
    if (!title.trim()) return setErr("Indicá un título");
    if (!file) return setErr("Elegí el PDF a enviar");
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("recipientId", recipientId);
      fd.append("type", type);
      fd.append("title", title);
      fd.append("signAnchor", signAnchor);
      if (signPage.trim()) fd.append("signPage", signPage.trim());
      const res = await fetch("/api/admin/deliveries/upload", { method: "POST", body: fd });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(out.error ?? "No pudimos enviar el documento. Probá de nuevo.");
      setTitle("");
      setSignPage("");
      clearFile();
      router.refresh();
    } catch {
      setErr("No pudimos enviar el documento. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Nueva entrega</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
          <label className="block">
            <span className="eyebrow">Destinatario</span>
            <select className="surface-select mt-1" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow">Tipo</span>
            <select className="surface-select mt-1" value={type} onChange={(e) => setType(e.target.value as Row["type"])}>
              <option value="PAYSLIP">Recibo de sueldo</option>
              <option value="INTERNAL_DOC">Documento interno</option>
              <option value="OTHER">Otro</option>
            </select>
          </label>
        </div>
        <label className="block mt-4">
          <span className="eyebrow">Título</span>
          <input className="surface-control mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Recibo de sueldo · Abril 2026" />
        </label>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
          <label className="block">
            <span className="eyebrow">Posición de la firma</span>
            <select className="surface-select mt-1" value={signAnchor} onChange={(e) => setSignAnchor(e.target.value as SignAnchor)}>
              {(Object.keys(ANCHOR_LABEL) as SignAnchor[]).map((a) => <option key={a} value={a}>{ANCHOR_LABEL[a]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow">Página (dejá vacío = última)</span>
            <input
              className="surface-control mt-1"
              type="number"
              min={1}
              step={1}
              value={signPage}
              onChange={(e) => setSignPage(e.target.value)}
              placeholder="Última página"
            />
          </label>
        </div>
        <div className="mt-4">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { setErr(null); setFile(e.target.files?.[0] ?? null); }} />
          {!file ? (
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Elegir PDF
            </button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="surface-card flex min-w-0 flex-1 items-center gap-2 p-3 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{file.name}</span>
                <button type="button" className="rail-icon-button ml-auto shrink-0" onClick={clearFile} aria-label="Quitar archivo" disabled={busy}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button type="button" className="btn-primary shrink-0 justify-center" disabled={busy} onClick={send}>
                <Send className="h-4 w-4" /> {busy ? "Enviando…" : "Enviar"}
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Sólo PDF. El envío se confirma con el botón &quot;Enviar&quot;.</p>
        </div>
        {err && <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
      </section>

      <section className="panel mt-6 p-0 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-5 py-3">Título</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Destinatario</th>
              <th className="px-3 py-3">Enviado</th>
              <th className="px-3 py-3">Abierto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3">{r.title}</td>
                <td className="px-3 py-3">{TYPE_LABEL[r.type]}</td>
                <td className="px-3 py-3">{r.recipient}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                <td className="px-3 py-3 text-xs">{r.openedAt ? <span className="badge-success">firmado {formatDateTime(r.openedAt)}</span> : <span className="badge-warning">sin abrir</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Sin entregas todavía.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
