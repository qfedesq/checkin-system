"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Row = { id: string; title: string; type: "PAYSLIP" | "INTERNAL_DOC" | "OTHER"; recipient: string; openedAt: string | null; createdAt: string };

const TYPE_LABEL = { PAYSLIP: "Recibo de sueldo", INTERNAL_DOC: "Documento interno", OTHER: "Otro" };

export function DeliveriesClient({ employees, rows }: { employees: { id: string; label: string }[]; rows: Row[] }) {
  const router = useRouter();
  const [recipientId, setRecipientId] = useState(employees[0]?.id ?? "");
  const [type, setType] = useState<Row["type"]>("PAYSLIP");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onUpload(file: File) {
    if (!recipientId) return setErr("Elegí un destinatario");
    if (!title) return setErr("Indicá un título");
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("recipientId", recipientId);
    fd.append("type", type);
    fd.append("title", title);
    const res = await fetch("/api/admin/deliveries/upload", { method: "POST", body: fd });
    const out = await res.json();
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) return setErr(out.error ?? "No pudimos subir el archivo");
    setTitle("");
    router.refresh();
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
        <div className="mt-4">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          <button className="btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> {busy ? "Subiendo…" : "Subir PDF"}
          </button>
        </div>
        {err && <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
      </section>

      <section className="panel mt-6 p-0 overflow-hidden">
        <table className="w-full text-sm">
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
                <td className="px-3 py-3 text-xs">{r.openedAt ? <span className="badge-success">firmado {formatDateTime(r.openedAt)}</span> : <span className="badge-accent">sin abrir</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Sin entregas todavía.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
