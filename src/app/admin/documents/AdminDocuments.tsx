"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatCalendarDate } from "@/lib/utils";
import { CheckCircle2, XCircle, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

type Row = { id: string; type: "DRIVER_LICENSE" | "HEALTH_CARD" | "OTHER"; blobUrl: string; expiresAt: string | null; status: "PENDING_REVIEW" | "APPROVED" | "REJECTED"; note: string; createdAt: string; employee: string; lastName: string; email: string };

const LABEL = { DRIVER_LICENSE: "Carnet", HEALTH_CARD: "Libreta sanitaria", OTHER: "Otro" };

type SortKey = "employee" | "type" | "expiresAt" | "status";

const STATUS_ORDER: Record<Row["status"], number> = { PENDING_REVIEW: 0, APPROVED: 1, REJECTED: 2 };

function SortHeader({ label, sortKey, active, dir, onClick }: { label: string; sortKey: SortKey; active: SortKey; dir: "asc" | "desc"; onClick: (k: SortKey) => void }) {
  const isActive = active === sortKey;
  return (
    <th className="px-3 py-3 first:px-5">
      <button type="button" className="inline-flex items-center gap-1 uppercase tracking-[0.16em] text-[11px] hover:text-foreground" onClick={() => onClick(sortKey)}>
        {label}
        {isActive && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

export function AdminDocuments({ docs }: { docs: Row[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("employee");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const router = useRouter();

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedDocs = useMemo(() => {
    const rows = [...docs];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "employee":
          cmp = a.lastName.localeCompare(b.lastName, "es");
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "expiresAt": {
          const av = a.expiresAt ?? a.createdAt;
          const bv = b.expiresAt ?? b.createdAt;
          cmp = av.localeCompare(bv);
          break;
        }
        case "status":
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [docs, sortKey, sortDir]);

  async function act(id: string, action: "approve" | "reject", note?: string) {
    setBusy(id);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/admin/documents/${id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setErr(out.error ?? "No pudimos procesar el documento. Probá de nuevo.");
      return;
    }
    setMsg(action === "approve" ? "Documento aprobado." : "Documento rechazado.");
    setTimeout(() => setMsg(null), 4000);
    router.refresh();
  }

  return (
    <div className="panel p-0 overflow-hidden">
      {err && <div className="px-5 py-3 text-sm text-destructive bg-destructive/10 border-b border-destructive/20">{err}</div>}
      {msg && <div className="px-5 py-3 text-sm text-[hsl(var(--success-text))] bg-[hsl(var(--success))]/10 border-b border-[hsl(var(--success))]/20">{msg}</div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <SortHeader label="Empleado" sortKey="employee" active={sortKey} dir={sortDir} onClick={onSort} />
            <SortHeader label="Tipo" sortKey="type" active={sortKey} dir={sortDir} onClick={onSort} />
            <SortHeader label="Vence/Subido" sortKey="expiresAt" active={sortKey} dir={sortDir} onClick={onSort} />
            <SortHeader label="Estado" sortKey="status" active={sortKey} dir={sortDir} onClick={onSort} />
            <th className="px-5 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sortedDocs.map((d) => (
            <tr key={d.id} className="border-b border-border/60 last:border-0">
              <td className="px-5 py-3">
                <div className="font-medium">{d.employee}</div>
                <div className="text-xs text-muted-foreground">{d.email}</div>
              </td>
              <td className="px-3 py-3">{LABEL[d.type]}</td>
              <td className="px-3 py-3">{d.expiresAt ? formatCalendarDate(d.expiresAt) : formatDate(d.createdAt)}</td>
              <td className="px-3 py-3">
                {d.status === "PENDING_REVIEW" && <span className="badge-warning">pendiente</span>}
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
                      <button className="btn-danger" disabled={busy === d.id} onClick={() => { setRejectTarget(d); setNote(""); }}>
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
      </table></div>

      {rejectTarget && (
        <Modal onClose={() => setRejectTarget(null)} labelledBy="reject-doc-title">
          <h3 id="reject-doc-title" className="text-lg font-semibold">Rechazar documento</h3>
          <p className="mt-1 text-sm text-muted-foreground">{rejectTarget.employee}</p>
          <label htmlFor="reject-doc-note" className="eyebrow mt-4 block">Motivo</label>
          <textarea id="reject-doc-note" className="surface-textarea mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" disabled={busy === rejectTarget.id} onClick={() => setRejectTarget(null)}>Cancelar</button>
            <button
              className="btn-danger"
              disabled={busy === rejectTarget.id}
              onClick={async () => { await act(rejectTarget.id, "reject", note); setRejectTarget(null); }}
            >
              Rechazar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
