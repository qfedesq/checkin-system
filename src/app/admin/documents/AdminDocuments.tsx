"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";

type Row = { id: string; type: "DRIVER_LICENSE" | "HEALTH_CARD" | "OTHER"; blobUrl: string; expiresAt: string | null; status: "PENDING_REVIEW" | "APPROVED" | "REJECTED"; note: string; createdAt: string; employee: string; email: string };

const LABEL = { DRIVER_LICENSE: "Carnet", HEALTH_CARD: "Libreta sanitaria", OTHER: "Otro" };

export function AdminDocuments({ docs }: { docs: Row[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const router = useRouter();

  async function act(id: string, action: "approve" | "reject", note?: string) {
    setBusy(id);
    await fetch(`/api/admin/documents/${id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="panel p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <th className="px-5 py-3">Empleado</th>
            <th className="px-3 py-3">Tipo</th>
            <th className="px-3 py-3">Vence</th>
            <th className="px-3 py-3">Estado</th>
            <th className="px-5 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className="border-b border-border/60 last:border-0">
              <td className="px-5 py-3">
                <div className="font-medium">{d.employee}</div>
                <div className="text-xs text-muted-foreground">{d.email}</div>
              </td>
              <td className="px-3 py-3">{LABEL[d.type]}</td>
              <td className="px-3 py-3">{formatDate(d.expiresAt)}</td>
              <td className="px-3 py-3">
                {d.status === "PENDING_REVIEW" && <span className="badge-accent">pendiente</span>}
                {d.status === "APPROVED" && <span className="badge-success">aprobado</span>}
                {d.status === "REJECTED" && <span className="badge-danger">rechazado</span>}
                {d.note && <div className="text-xs text-muted-foreground">{d.note}</div>}
              </td>
              <td className="px-5 py-3 text-right">
                <div className="inline-flex gap-2">
                  <a target="_blank" rel="noreferrer" href={d.blobUrl} className="btn-ghost"><ExternalLink className="h-4 w-4" /></a>
                  {d.status === "PENDING_REVIEW" && (
                    <>
                      <button className="btn-success" disabled={busy === d.id} onClick={() => act(d.id, "approve")}>
                        <CheckCircle2 className="h-4 w-4" /> Aprobar
                      </button>
                      <button className="btn-danger" onClick={() => { setRejectTarget(d); setNote(""); }}>
                        <XCircle className="h-4 w-4" /> Rechazar
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {docs.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Sin documentos.</td></tr>}
        </tbody>
      </table>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setRejectTarget(null)}>
          <div className="panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Rechazar documento</h3>
            <p className="mt-1 text-sm text-muted-foreground">{rejectTarget.employee}</p>
            <label className="eyebrow mt-4 block">Motivo</label>
            <textarea className="surface-textarea mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setRejectTarget(null)}>Cancelar</button>
              <button className="btn-danger" onClick={async () => { await act(rejectTarget.id, "reject", note); setRejectTarget(null); }}>Rechazar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
