"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { useSession } from "next-auth/react";
import { MapPin, Fingerprint, CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Open = { id: string; checkInAt: string; lat: number; lng: number } | null;

export function CheckinClient({ open }: { open: Open }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function doAction(kind: "checkin" | "checkout") {
    setBusy(true); setErr(null); setOk(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocalización no disponible"));
        navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(e.message)), { enableHighAccuracy: true, timeout: 15000 });
      });

      // Biometría obligatoria
      const options = await fetch("/api/webauthn/authenticate/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: session?.user.email }),
      }).then((r) => r.json());
      if (options.needsEnrollment) throw new Error("Registrá primero tu dispositivo.");
      const assertion = await startAuthentication({ optionsJSON: options });
      const verify = await fetch("/api/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assertion }),
      }).then((r) => r.json());
      if (!verify.ok) throw new Error(verify.error ?? "Verificación biométrica fallida");

      const res = await fetch(`/api/attendance/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      setOk(kind === "checkin" ? "Check-in registrado" : "Check-out registrado");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
      <section className="panel p-8 text-center">
        {open ? (
          <>
            <div className="eyebrow mb-4">Jornada en curso</div>
            <CheckCircle2 className="mx-auto h-14 w-14 text-[hsl(var(--success))]" />
            <p className="mt-3 text-sm font-semibold">Check-in registrado</p>
            <p className="mt-1 text-xs text-muted-foreground">Desde {formatDateTime(open.checkInAt)}</p>
            <button onClick={() => doAction("checkout")} disabled={busy} className="btn-primary mx-auto mt-6">
              <Fingerprint className="h-4 w-4" />
              {busy ? "Registrando…" : "Hacer check-out"}
            </button>
          </>
        ) : (
          <>
            <div className="eyebrow mb-4">Registrar ingreso</div>
            <p className="text-sm text-muted-foreground">Vamos a tomar tu ubicación y pedirte tu biometría.</p>
            <button onClick={() => doAction("checkin")} disabled={busy} className="btn-primary mx-auto mt-6">
              <MapPin className="h-4 w-4" />
              {busy ? "Registrando…" : "Hacer check-in"}
            </button>
          </>
        )}
        {err && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
        {ok && <div className="mt-4 rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-4 py-2 text-sm text-[hsl(var(--success))] inline-flex gap-2 items-center"><CheckCircle2 className="h-4 w-4" /> {ok}</div>}
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Cómo funciona</h2>
        <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>1. Al tocar el botón, el navegador te pide acceso a tu ubicación.</li>
          <li>2. Después confirmás con Face ID, Touch ID o tu biometría nativa.</li>
          <li>3. El registro queda asociado a este dispositivo.</li>
          <li>4. La duración de tu jornada la ve únicamente el administrador.</li>
        </ol>
      </section>
    </div>
  );
}
