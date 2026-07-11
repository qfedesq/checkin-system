"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";

export function LoginForm({ from, error }: { from?: string; error?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(error ?? null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (!res || res.error) {
      setErr("Credenciales inválidas.");
      setBusy(false);
      return;
    }

    // Challenge biométrico: si el usuario ya tiene WebAuthn registrado, pedir assertion
    try {
      const options = await fetch("/api/webauthn/authenticate/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }).then((r) => r.json());

      if (options.needsEnrollment) {
        router.push("/setup-biometrics");
        return;
      }

      const assertion = await startAuthentication({ optionsJSON: options });

      const verify = await fetch("/api/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assertion }),
      }).then((r) => r.json());

      if (!verify.ok) {
        setErr(verify.error ?? "Verificación biométrica fallida.");
        // sign out real (limpia la cookie de sesión) para no dejar al usuario
        // logueado tras un fallo de biometría
        await signOut({ redirect: false });
        setBusy(false);
        return;
      }

      router.push(from ?? "/");
      router.refresh();
    } catch (e) {
      setErr("No pudimos verificar tu biometría en este dispositivo.");
      await signOut({ redirect: false });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="eyebrow">Email</label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="surface-control mt-1"
          autoComplete="email"
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="login-password" className="eyebrow">Contraseña</label>
          <Link href="/forgot-password" className="text-[11px] text-[hsl(var(--primary-text))] underline underline-offset-4">
            Olvidé mi contraseña
          </Link>
        </div>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="surface-control mt-1"
          autoComplete="current-password"
        />
      </div>
      {err && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>
      )}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
        {busy ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
