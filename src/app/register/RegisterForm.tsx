"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setErr("Las contraseñas no coinciden.");
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "No pudimos registrarte.");
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (done) {
    return (
      <div className="space-y-3 rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-4 py-3 text-sm text-[hsl(var(--success))]">
        Tu cuenta fue creada. Un administrador debe habilitarla antes de que puedas ingresar.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="eyebrow">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="surface-control mt-1" />
      </div>
      <div>
        <label className="eyebrow">Contraseña</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="surface-control mt-1" autoComplete="new-password" />
      </div>
      <div>
        <label className="eyebrow">Confirmar contraseña</label>
        <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="surface-control mt-1" autoComplete="new-password" />
      </div>
      {err && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
        {busy ? "Creando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
