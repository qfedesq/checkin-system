"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Smartphone, XCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Row = {
  id: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
  mustChangePassword: boolean;
  hasDevice: boolean;
  createdAt: string;
  firstName: string;
  lastName: string;
  legajo: string | null;
  hireDate: string | null;
};

export function UsersTable({ users }: { users: Row[] }) {
  const [openApprove, setOpenApprove] = useState<Row | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  async function post(path: string, body?: unknown) {
    setBusy(path);
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setToast(data.error ?? "Error");
      setTimeout(() => setToast(null), 3500);
      return null;
    }
    router.refresh();
    return data;
  }

  return (
    <div className="panel p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <th className="px-5 py-3">Empleado</th>
            <th className="px-3 py-3">Legajo</th>
            <th className="px-3 py-3">Estado</th>
            <th className="px-3 py-3">Dispositivo</th>
            <th className="px-3 py-3">Alta</th>
            <th className="px-5 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-white/5 last:border-0">
              <td className="px-5 py-3">
                <div className="font-medium">{u.firstName || u.lastName ? `${u.firstName} ${u.lastName}` : "—"}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
                {u.role === "ADMIN" && <span className="badge-accent mt-1">admin</span>}
              </td>
              <td className="px-3 py-3 mono text-xs">{u.legajo ?? "—"}</td>
              <td className="px-3 py-3">
                {u.status === "PENDING_APPROVAL" && <span className="badge-accent">pendiente</span>}
                {u.status === "ACTIVE" && <span className="badge-success">activo</span>}
                {u.status === "DISABLED" && <span className="badge-danger">deshabilitado</span>}
                {u.mustChangePassword && <span className="badge-primary ml-1">pwd temp</span>}
              </td>
              <td className="px-3 py-3">
                {u.hasDevice ? <span className="badge-primary">registrado</span> : <span className="badge">sin dispositivo</span>}
              </td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(u.createdAt)}</td>
              <td className="px-5 py-3 text-right">
                <div className="inline-flex gap-2">
                  {u.status === "PENDING_APPROVAL" && (
                    <button className="btn-success" onClick={() => setOpenApprove(u)} disabled={busy !== null}>
                      <CheckCircle2 className="h-4 w-4" /> Aprobar
                    </button>
                  )}
                  {u.status === "ACTIVE" && (
                    <>
                      <button
                        className="btn-ghost"
                        title="Resetear contraseña"
                        onClick={async () => {
                          const data = await post(`/api/admin/users/${u.id}/reset-password`);
                          if (data?.tempPassword) {
                            await navigator.clipboard.writeText(data.tempPassword).catch(() => {});
                            setToast(`Contraseña temporal: ${data.tempPassword} (copiada)`);
                            setTimeout(() => setToast(null), 9000);
                          }
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      {u.hasDevice && (
                        <button
                          className="btn-ghost"
                          title="Resetear dispositivo"
                          onClick={() => post(`/api/admin/users/${u.id}/reset-device`)}
                        >
                          <Smartphone className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        className="btn-danger"
                        title="Deshabilitar"
                        onClick={() => post(`/api/admin/users/${u.id}/disable`)}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {u.status === "DISABLED" && (
                    <button className="btn-success" onClick={() => post(`/api/admin/users/${u.id}/enable`)}>
                      Reactivar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                No hay usuarios todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {openApprove && <ApproveDialog user={openApprove} onClose={() => setOpenApprove(null)} />}
      {toast && (
        <div className="fixed bottom-6 right-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary shadow-glow">
          {toast}
        </div>
      )}
    </div>
  );
}

function ApproveDialog({ user, onClose }: { user: Row; onClose: () => void }) {
  const router = useRouter();
  const [legajo, setLegajo] = useState("");
  const [hireDate, setHireDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/users/${user.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ legajo, hireDate }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "Error");
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Aprobar empleado</h3>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="eyebrow">Legajo</label>
            <input className="surface-control mt-1" value={legajo} onChange={(e) => setLegajo(e.target.value)} placeholder="Ej: L-00421" />
          </div>
          <div>
            <label className="eyebrow">Fecha de ingreso</label>
            <input type="date" className="surface-control mt-1" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
          </div>
          {err && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={busy || !legajo}>
              {busy ? "Aprobando…" : "Aprobar y habilitar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
