"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCalendarDate } from "@/lib/utils";
import { CheckCircle2, XCircle, ArrowUp, ArrowDown } from "lucide-react";

type Row = { id: string; type: "VACATION" | "DAY_OFF"; startDate: string; endDate: string; days: number; status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string; employee: string; legajo: string | null };

type SortKey = "employee" | "type" | "startDate" | "status";

const STATUS_ORDER: Record<Row["status"], number> = { PENDING: 0, APPROVED: 1, REJECTED: 2 };

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

export function AdminLeavesTable({ leaves }: { leaves: Row[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("status");
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

  const sortedLeaves = useMemo(() => {
    const rows = [...leaves];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "employee":
          cmp = a.employee.localeCompare(b.employee, "es");
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "startDate":
          cmp = a.startDate.localeCompare(b.startDate);
          break;
        case "status":
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [leaves, sortKey, sortDir]);
  async function act(id: string, action: "approve" | "reject") {
    if (action === "reject" && !confirm("¿Seguro que querés rechazar esta solicitud?")) return;
    setBusy(id); setErr(null); setMsg(null);
    const res = await fetch(`/api/admin/leaves/${id}/${action}`, { method: "POST" });
    const out = await res.json();
    setBusy(null);
    if (!res.ok) {
      setErr(out.error ?? "No pudimos procesar la solicitud. Probá de nuevo.");
      return;
    }
    setMsg(action === "approve" ? "Solicitud aprobada." : "Solicitud rechazada.");
    setTimeout(() => setMsg(null), 4000);
    router.refresh();
  }
  return (
    <div className="panel p-0 overflow-hidden">
      {err && <div className="px-5 py-3 text-sm text-destructive bg-destructive/10 border-b border-destructive/20">{err}</div>}
      {msg && <div className="px-5 py-3 text-sm text-[hsl(var(--success-text))] bg-[hsl(var(--success))]/10 border-b border-[hsl(var(--success))]/20">{msg}</div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <SortHeader label="Empleado" sortKey="employee" active={sortKey} dir={sortDir} onClick={onSort} />
            <SortHeader label="Tipo" sortKey="type" active={sortKey} dir={sortDir} onClick={onSort} />
            <SortHeader label="Inicio" sortKey="startDate" active={sortKey} dir={sortDir} onClick={onSort} />
            <th className="px-3 py-3">Fin</th>
            <th className="px-3 py-3">Días</th>
            <SortHeader label="Estado" sortKey="status" active={sortKey} dir={sortDir} onClick={onSort} />
            <th className="px-5 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sortedLeaves.map((l) => (
            <tr key={l.id} className="border-b border-border/60 last:border-0">
              <td className="px-5 py-3">
                <div className="font-medium">{l.employee}</div>
                {l.legajo && <div className="mono text-xs text-muted-foreground">{l.legajo}</div>}
              </td>
              <td className="px-3 py-3">{l.type === "VACATION" ? "Vacaciones" : "Franco"}</td>
              <td className="px-3 py-3">{formatCalendarDate(l.startDate)}</td>
              <td className="px-3 py-3">{formatCalendarDate(l.endDate)}</td>
              <td className="px-3 py-3">{l.days}</td>
              <td className="px-3 py-3">
                {l.status === "PENDING" && <span className="badge-warning">pendiente</span>}
                {l.status === "APPROVED" && <span className="badge-success">aprobado</span>}
                {l.status === "REJECTED" && <span className="badge-danger">rechazado</span>}
              </td>
              <td className="px-5 py-3 text-right">
                {l.status === "PENDING" && (
                  <div className="inline-flex gap-2">
                    <button className="btn-success" disabled={busy === l.id} onClick={() => act(l.id, "approve")}><CheckCircle2 className="h-4 w-4" /> Aprobar</button>
                    <button className="btn-danger" disabled={busy === l.id} onClick={() => act(l.id, "reject")}><XCircle className="h-4 w-4" /> Rechazar</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {leaves.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">Sin solicitudes.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
