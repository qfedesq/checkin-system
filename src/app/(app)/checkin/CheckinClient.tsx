"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useSession } from "next-auth/react";
import { MapPin, Fingerprint, CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Open = { id: string; checkInAt: string; lat: number; lng: number } | null;

const WEBAUTHN_UNSUPPORTED_MSG =
  "Tu navegador no permite la verificación biométrica. Abrí Emmalva en Safari o Chrome (no dentro de WhatsApp) para fichar.";
const WEBAUTHN_GENERIC_ERROR_MSG = "No pudimos verificar tu identidad. Probá de nuevo.";

// Error "esperado": mensaje ya en español (propio o del servidor). Cualquier otro
// error (geolocalización/WebAuthn nativos del navegador, network, etc.) que no
// pase por acá muestra el mensaje genérico en vez del texto nativo en inglés.
class ExpectedError extends Error {}

function geoErrorMessage(code: number) {
  switch (code) {
    case 1: // PERMISSION_DENIED
      return "Necesitamos permiso de ubicación para fichar. Activalo en los ajustes del navegador.";
    case 2: // POSITION_UNAVAILABLE
      return "No pudimos obtener tu ubicación. Probá de nuevo.";
    case 3: // TIMEOUT
      return "La ubicación tardó demasiado. Probá de nuevo.";
    default:
      return "No pudimos obtener tu ubicación. Probá de nuevo.";
  }
}

export function CheckinClient({ open }: { open: Open }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [webauthnSupported, setWebauthnSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setWebauthnSupported(browserSupportsWebAuthn());
  }, []);

  async function doAction(kind: "checkin" | "checkout") {
    if (!webauthnSupported) {
      setErr(WEBAUTHN_UNSUPPORTED_MSG);
      return;
    }
    setBusy(true); setErr(null); setOk(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new ExpectedError("Geolocalización no disponible"));
        navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new ExpectedError(geoErrorMessage(e.code))), { enableHighAccuracy: true, timeout: 15000 });
      });

      // Biometría obligatoria
      const options = await fetch("/api/webauthn/authenticate/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: session?.user.email }),
      }).then((r) => r.json());
      if (options.needsEnrollment) throw new ExpectedError("Registrá primero tu dispositivo.");
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: options });
      } catch {
        throw new ExpectedError(WEBAUTHN_GENERIC_ERROR_MSG);
      }
      // La biometría se verifica DENTRO de /api/attendance/{kind} (un solo request atómico):
      // mandamos la aserción junto con la ubicación para que no se pueda fichar salteándola.
      const res = await fetch(`/api/attendance/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          assertion,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new ExpectedError(body.error ?? "Error");
      setOk(kind === "checkin" ? "Check-in registrado" : "Check-out registrado");
      router.refresh();
    } catch (e) {
      setErr(e instanceof ExpectedError ? e.message : WEBAUTHN_GENERIC_ERROR_MSG);
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
            <button onClick={() => doAction("checkout")} disabled={busy || webauthnSupported === false} className="btn-primary mx-auto mt-6">
              <Fingerprint className="h-4 w-4" />
              {busy ? "Registrando…" : "Hacer check-out"}
            </button>
          </>
        ) : (
          <>
            <div className="eyebrow mb-4">Registrar ingreso</div>
            <p className="text-sm text-muted-foreground">Vamos a tomar tu ubicación y pedirte tu biometría.</p>
            <button onClick={() => doAction("checkin")} disabled={busy || webauthnSupported === false} className="btn-primary mx-auto mt-6">
              <MapPin className="h-4 w-4" />
              {busy ? "Registrando…" : "Hacer check-in"}
            </button>
          </>
        )}
        {webauthnSupported === false && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{WEBAUTHN_UNSUPPORTED_MSG}</div>
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
