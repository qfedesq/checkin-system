"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

type Row = { id: string; type: "VACATION" | "DAY_OFF"; startDate: string; endDate: string; days: number; status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string; employee: string; legajo: string | null };

export function AdminLeavesTable({ leaves }: { leaves: Row[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  async function act(id: string, action: "approve" | "reject") {
    setBusy(id); setErr(null);
    const res = await fetch(`/api/admin/leaves/${id}/${action}`, { method: "POST" });
    const out = await res.json();
    setBusy(null);
    if (!res.ok) setErr(out.error ?? "Error");
    else router.refresh();
  }
  return (
    <div className="panel p-0 overflow-hidden">
      {err && <div className="px-5 py-3 text-sm text-destructive bg-destructive/10 border-b border-destructive/20">{err}</div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <th className="px-5 py-3">Empleado</th>
            <th className="px-3 py-3">Tipo</th>
            <th className="px-3 py-3">Inicio</th>
            <th className="px-3 py-3">Fin</th>
            <th className="px-3 py-3">Días</th>
            <th className="px-3 py-3">Estado</th>
            <th className="px-5 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {leaves.map((l) => (
            <tr key={l.id} className="border-b border-white/5 last:border-0">
              <td className="px-5 py-3">
                <div className="font-medium">{l.employee}</div>
                {l.legajo && <div className="mono text-xs text-muted-foreground">{l.legajo}</div>}
              </td>
              <td className="px-3 py-3">{l.type === "VACATION" ? "Vacaciones" : "Franco"}</td>
              <td className="px-3 py-3">{formatDate(l.startDate)}</td>
              <td className="px-3 py-3">{formatDate(l.endDate)}</td>
              <td className="px-3 py-3">{l.days}</td>
              <td className="px-3 py-3">
                {l.status === "PENDING" && <span className="badge-accent">pendiente</span>}
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
      </table>
    </div>
  );
}
