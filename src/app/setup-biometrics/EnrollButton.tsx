"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { startRegistration } from "@simplewebauthn/browser";

export function EnrollButton({ hasWebauthn }: { hasWebauthn: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(hasWebauthn);

  async function enroll() {
    setBusy(true);
    setErr(null);
    try {
      const options = await fetch("/api/webauthn/register/options", { method: "POST" }).then((r) => r.json());
      const attestation = await startRegistration({ optionsJSON: options });
      const verify = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attestation }),
      }).then((r) => r.json());
      if (!verify.ok) throw new Error(verify.error ?? "No pudimos verificar tu dispositivo.");
      setOk(true);
      await update({ hasWebauthn: true });
      setTimeout(() => router.push("/"), 800);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fallo en el enrolamiento.");
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-4 py-3 text-sm text-[hsl(var(--success))]">
        Dispositivo registrado. Redirigiendo…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>• Usaremos la biometría nativa de este dispositivo.</li>
        <li>• A partir de acá, sólo podrás ingresar desde este teléfono/computadora.</li>
        <li>• Si cambiás de dispositivo, pedile al administrador que lo resetee.</li>
      </ul>
      {err && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
      <button onClick={enroll} disabled={busy} className="btn-primary w-full disabled:opacity-60">
        {busy ? "Registrando…" : "Registrar este dispositivo"}
      </button>
    </div>
  );
}
