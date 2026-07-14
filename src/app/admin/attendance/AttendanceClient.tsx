"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ArrowUp, ArrowDown } from "lucide-react";
import { formatDate, formatDateTime, minutesToHhmm } from "@/lib/utils";

async function closeAttendance(id: string) {
  const res = await fetch(`/api/admin/attendance/${id}/close`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo cerrar la jornada");
  }
}

type Row = {
  id: string;
  employee: string;
  lastName: string;
  legajo: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMin: number | null;
  checkInLat: number;
  checkInLng: number;
  checkOutLat: number | null;
  checkOutLng: number | null;
};

type SortKey = "employee" | "checkInAt";

function SortHeader({ label, sortKey, active, dir, onClick, className }: { label: string; sortKey: SortKey; active: SortKey; dir: "asc" | "desc"; onClick: (k: SortKey) => void; className?: string }) {
  const isActive = active === sortKey;
  return (
    <th className={className ?? "px-3 py-3"}>
      <button type="button" className="inline-flex items-center gap-1 uppercase tracking-[0.16em] text-[11px] hover:text-foreground" onClick={() => onClick(sortKey)}>
        {label}
        {isActive && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

export function AttendanceClient({ initial, employees, rows }: {
  initial: { from: string; to: string; userId: string };
  employees: { id: string; label: string }[];
  rows: Row[];
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [userId, setUserId] = useState(initial.userId);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("employee");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "employee":
          cmp = a.lastName.localeCompare(b.lastName, "es") || a.checkInAt.localeCompare(b.checkInAt);
          break;
        case "checkInAt":
          cmp = a.checkInAt.localeCompare(b.checkInAt);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  async function handleClose(id: string) {
    if (!confirm("¿Cerrar esta jornada huérfana? Se registrará el check-out con la hora actual.")) return;
    setClosingId(id);
    try {
      await closeAttendance(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo cerrar la jornada");
    } finally {
      setClosingId(null);
    }
  }

  function setMonth(offset: number) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setFrom(iso(first));
    setTo(iso(last));
  }

  function applyFilter() {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (userId) sp.set("userId", userId);
    router.push(`/admin/attendance?${sp.toString()}`);
  }

  function exportExcel() {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (userId) sp.set("userId", userId);
    window.location.href = `/api/attendance/export?${sp.toString()}`;
  }

  return (
    <>
      <section className="panel p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="eyebrow">Desde</span>
            <input type="date" className="surface-control mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="eyebrow">Hasta</span>
            <input type="date" className="surface-control mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="block">
            <span className="eyebrow">Empleado</span>
            <select className="surface-select mt-1" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Todos</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="btn-primary" onClick={applyFilter}>Filtrar</button>
            <button className="btn-ghost" onClick={exportExcel}><Download className="h-4 w-4" /> Excel</button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="eyebrow">Rápido</span>
          <button className="btn-ghost" onClick={() => setMonth(0)}>Este mes</button>
          <button className="btn-ghost" onClick={() => setMonth(-1)}>Mes anterior</button>
        </div>
      </section>

      <section className="panel mt-6 p-0 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <SortHeader label="Empleado" sortKey="employee" active={sortKey} dir={sortDir} onClick={onSort} className="px-5 py-3" />
              <SortHeader label="Fecha" sortKey="checkInAt" active={sortKey} dir={sortDir} onClick={onSort} />
              <th className="px-3 py-3">Check-in</th>
              <th className="px-3 py-3">Check-out</th>
              <th className="px-3 py-3">Duración</th>
              <th className="px-3 py-3">Ubic. in</th>
              <th className="px-3 py-3">Ubic. out</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3">
                  <div className="font-medium">{r.employee}</div>
                  <div className="mono text-xs text-muted-foreground">{r.legajo}</div>
                </td>
                <td className="px-3 py-3">{formatDate(r.checkInAt)}</td>
                <td className="px-3 py-3">{formatDateTime(r.checkInAt)}</td>
                <td className="px-3 py-3">{r.checkOutAt ? formatDateTime(r.checkOutAt) : <span className="badge-accent">abierta</span>}</td>
                <td className="px-3 py-3 mono">{minutesToHhmm(r.durationMin)}</td>
                <td className="px-3 py-3 mono text-[11px] text-muted-foreground">{r.checkInLat.toFixed(4)}, {r.checkInLng.toFixed(4)}</td>
                <td className="px-3 py-3 mono text-[11px] text-muted-foreground">{r.checkOutLat !== null && r.checkOutLng !== null ? `${r.checkOutLat.toFixed(4)}, ${r.checkOutLng.toFixed(4)}` : "—"}</td>
                <td className="px-3 py-3">
                  {!r.checkOutAt && (
                    <button
                      className="btn-ghost text-xs"
                      disabled={closingId === r.id}
                      onClick={() => handleClose(r.id)}
                    >
                      {closingId === r.id ? "Cerrando…" : "Cerrar jornada"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">Sin registros en ese rango.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
