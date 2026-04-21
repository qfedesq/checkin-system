"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { formatDate, formatDateTime, minutesToHhmm } from "@/lib/utils";

type Row = {
  id: string;
  employee: string;
  legajo: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMin: number | null;
  checkInLat: number;
  checkInLng: number;
  checkOutLat: number | null;
  checkOutLng: number | null;
};

export function AttendanceClient({ initial, employees, rows }: {
  initial: { from: string; to: string; userId: string };
  employees: { id: string; label: string }[];
  rows: Row[];
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [userId, setUserId] = useState(initial.userId);

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
      </section>

      <section className="panel mt-6 p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-5 py-3">Empleado</th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Check-in</th>
              <th className="px-3 py-3">Check-out</th>
              <th className="px-3 py-3">Duración</th>
              <th className="px-3 py-3">Ubic. in</th>
              <th className="px-3 py-3">Ubic. out</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
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
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">Sin registros en ese rango.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
