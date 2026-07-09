"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Smartphone, XCircle, UserPlus, ShieldCheck, ShieldX } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

type Row = {
  id: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
  mustChangePassword: boolean;
  hasDevice: boolean;
  devicePending: boolean;
  createdAt: string;
  firstName: string;
  lastName: string;
  legajo: string | null;
  hireDate: string | null;
};

export function UsersTable({ users }: { users: Row[] }) {
  const [openApprove, setOpenApprove] = useState<Row | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; secret?: string } | null>(null);
  const [secretRevealed, setSecretRevealed] = useState(false);
  const router = useRouter();

  function showToast(text: string, secret?: string, ms = 5000) {
    setToast({ text, secret });
    setSecretRevealed(false);
    setTimeout(() => setToast(null), ms);
  }

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
      showToast(data.error ?? "No pudimos completar la acción. Probá de nuevo.");
      return null;
    }
    router.refresh();
    return data;
  }

  return (
    <>
    <div className="mb-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{users.length} usuario{users.length === 1 ? "" : "s"} en el sistema.</p>
      <button className="btn-primary" onClick={() => setOpenCreate(true)}>
        <UserPlus className="h-4 w-4" /> Nuevo usuario
      </button>
    </div>
    <div className="panel p-0 overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
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
            <tr key={u.id} className="border-b border-border/60 last:border-0">
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
                {u.mustChangePassword && <span className="badge-primary ml-1">clave temporal</span>}
              </td>
              <td className="px-3 py-3">
                {u.hasDevice ? (
                  u.devicePending ? <span className="badge-accent">pendiente de aprobación</span> : <span className="badge-primary">aprobado</span>
                ) : (
                  <span className="badge">sin dispositivo</span>
                )}
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
                      {u.devicePending && (
                        <>
                          <button
                            className="btn-success"
                            title="Aprobar dispositivo"
                            disabled={busy !== null}
                            onClick={() => post(`/api/admin/users/${u.id}/approve-device`)}
                          >
                            <ShieldCheck className="h-4 w-4" /> Aprobar disp.
                          </button>
                          <button
                            className="btn-ghost"
                            title="Rechazar dispositivo (borra la credencial)"
                            disabled={busy !== null}
                            onClick={() => {
                              if (confirm("¿Seguro que querés rechazar este dispositivo? Se borra la credencial registrada y el empleado va a tener que volver a registrarlo.")) {
                                post(`/api/admin/users/${u.id}/reject-device`);
                              }
                            }}
                          >
                            <ShieldX className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        className="btn-ghost"
                        title="Resetear contraseña"
                        disabled={busy !== null}
                        onClick={async () => {
                          const data = await post(`/api/admin/users/${u.id}/reset-password`);
                          if (data?.tempPassword) {
                            await navigator.clipboard.writeText(data.tempPassword).catch(() => {});
                            showToast("Clave temporal generada y copiada al portapapeles.", data.tempPassword, 12000);
                          }
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      {u.hasDevice && (
                        <button
                          className="btn-ghost"
                          title="Resetear dispositivo"
                          disabled={busy !== null}
                          onClick={() => {
                            if (confirm("¿Seguro que querés resetear el dispositivo? El empleado va a tener que volver a registrarlo.")) {
                              post(`/api/admin/users/${u.id}/reset-device`);
                            }
                          }}
                        >
                          <Smartphone className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        className="btn-danger"
                        title="Deshabilitar"
                        disabled={busy !== null}
                        onClick={() => {
                          if (confirm("¿Seguro que querés deshabilitar a este usuario? No va a poder ingresar hasta que lo reactives.")) {
                            post(`/api/admin/users/${u.id}/disable`);
                          }
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {u.status === "DISABLED" && (
                    <button className="btn-success" disabled={busy !== null} onClick={() => post(`/api/admin/users/${u.id}/enable`)}>
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
      </table></div>

      {openApprove && <ApproveDialog user={openApprove} onClose={() => setOpenApprove(null)} />}
      {toast && (
        <div className="fixed bottom-24 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:max-w-md rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-[hsl(var(--primary-text))] shadow-glow z-50">
          <div>{toast.text}</div>
          {toast.secret && (
            <div className="mt-2 flex items-center gap-2">
              <span className="mono text-sm">{secretRevealed ? toast.secret : "••••••••••"}</span>
              <button type="button" className="btn-ghost text-xs" onClick={() => setSecretRevealed((v) => !v)}>
                {secretRevealed ? "Ocultar" : "Ver"}
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => { if (toast.secret) navigator.clipboard.writeText(toast.secret).catch(() => {}); }}
              >
                Copiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
    {openCreate && (
      <CreateUserDialog
        onClose={() => setOpenCreate(false)}
        onCreated={(tempPassword, email) => {
          setOpenCreate(false);
          navigator.clipboard.writeText(tempPassword).catch(() => {});
          showToast(`Usuario ${email} creado. Clave temporal copiada al portapapeles.`, tempPassword, 20000);
          router.refresh();
        }}
      />
    )}
    </>
  );
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (tempPassword: string, email: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "ADMIN">("EMPLOYEE");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [legajo, setLegajo] = useState("");
  const [hireDate, setHireDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        role,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        legajo: legajo.trim() || undefined,
        hireDate: role === "EMPLOYEE" && hireDate ? hireDate : undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "No pudimos crear el usuario");
    onCreated(data.tempPassword, email.trim().toLowerCase());
  }

  return (
    <Modal onClose={onClose} labelledBy="create-user-title">
      <form onSubmit={submit}>
        <h3 id="create-user-title" className="text-lg font-bold">Nuevo usuario</h3>
        <p className="mt-1 text-sm text-muted-foreground">La cuenta queda activa de entrada. Vas a recibir una contraseña temporal para pasarle al usuario; el sistema lo fuerza a cambiarla en el primer login.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="cu-email" className="eyebrow">Email</label>
            <input id="cu-email" type="email" required className="surface-control mt-1" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="cu-role" className="eyebrow">Rol</label>
            <select id="cu-role" className="surface-select mt-1" value={role} onChange={(e) => setRole(e.target.value as "EMPLOYEE" | "ADMIN")}>
              <option value="EMPLOYEE">Empleado</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cu-first" className="eyebrow">Nombre (opcional)</label>
              <input id="cu-first" className="surface-control mt-1" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="cu-last" className="eyebrow">Apellido (opcional)</label>
              <input id="cu-last" className="surface-control mt-1" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          {role === "EMPLOYEE" && (
            <>
              <div>
                <label htmlFor="cu-legajo" className="eyebrow">Legajo (opcional)</label>
                <input id="cu-legajo" className="surface-control mt-1" value={legajo} onChange={(e) => setLegajo(e.target.value)} placeholder="Ej: L-00421" />
              </div>
              <div>
                <label htmlFor="cu-hire" className="eyebrow">Fecha de ingreso (opcional)</label>
                <input id="cu-hire" type="date" className="surface-control mt-1" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
              </div>
            </>
          )}
          {err && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy || !email}>
              {busy ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
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
    if (!res.ok) return setErr(data.error ?? "No pudimos aprobar al usuario. Probá de nuevo.");
    onClose();
    router.refresh();
  }

  return (
    <Modal onClose={onClose} labelledBy="approve-user-title">
      <h3 id="approve-user-title" className="text-lg font-semibold">Aprobar empleado</h3>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="ap-legajo" className="eyebrow">Legajo</label>
          <input id="ap-legajo" className="surface-control mt-1" value={legajo} onChange={(e) => setLegajo(e.target.value)} placeholder="Ej: L-00421" />
        </div>
        <div>
          <label htmlFor="ap-hire" className="eyebrow">Fecha de ingreso</label>
          <input id="ap-hire" type="date" className="surface-control mt-1" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
        </div>
        {err && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={busy || !legajo}>
            {busy ? "Aprobando…" : "Aprobar y habilitar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
