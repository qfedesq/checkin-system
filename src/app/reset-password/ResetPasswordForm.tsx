"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function ResetPasswordForm() {
  const router = useRouter();
  const { update } = useSession();
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres.");
    if (pwd !== pwd2) return setErr("Las contraseñas no coinciden.");
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/password/change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current, next: pwd }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "No pudimos cambiar tu contraseña.");
      setBusy(false);
      return;
    }
    await update({ mustChangePassword: false });
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="eyebrow">Contraseña actual</label>
        <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="surface-control mt-1" autoComplete="current-password" />
      </div>
      <div>
        <label className="eyebrow">Nueva contraseña</label>
        <input type="password" required value={pwd} onChange={(e) => setPwd(e.target.value)} className="surface-control mt-1" autoComplete="new-password" />
      </div>
      <div>
        <label className="eyebrow">Confirmar nueva contraseña</label>
        <input type="password" required value={pwd2} onChange={(e) => setPwd2(e.target.value)} className="surface-control mt-1" autoComplete="new-password" />
      </div>
      {err && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
        {busy ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
