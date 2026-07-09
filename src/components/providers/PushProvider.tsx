"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";

const DISMISS_KEY = "emmalva-push-dismissed";
const IOS_HINT_DISMISS_KEY = "emmalva-push-ios-hint-dismissed";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari/iOS expone esta propiedad no estándar
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function subscribe(registration: ServiceWorkerRegistration, vapidKey: string) {
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
}

export function PushProvider() {
  const [showBanner, setShowBanner] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    // En iOS, Web Push sólo funciona si la app está instalada como PWA
    // (ícono en la pantalla de inicio, modo standalone). En Safari "normal"
    // el banner de activación nunca funcionaría, así que mostramos un hint
    // explicando cómo instalarla en vez de un botón que fallaría en silencio.
    if (isIos() && !isStandalone()) {
      if (!localStorage.getItem(IOS_HINT_DISMISS_KEY)) setShowIosHint(true);
      return;
    }
    if (!vapidKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      if (Notification.permission === "granted") {
        // Re-suscribir silenciosamente (mantiene la subscription fresca en el server)
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(existing.toJSON()),
          }).catch(() => {});
        } else {
          await subscribe(registration, vapidKey).catch(() => {});
        }
        return;
      }
      if (Notification.permission === "default" && !localStorage.getItem(DISMISS_KEY)) {
        setShowBanner(true);
      }
    }).catch((e) => console.error("[push] sw register", e));
  }, [vapidKey]);

  async function enable() {
    setShowBanner(false);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const registration = await navigator.serviceWorker.ready;
    await subscribe(registration, vapidKey).catch((e) => console.error("[push] subscribe", e));
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShowBanner(false);
  }

  function dismissIosHint() {
    localStorage.setItem(IOS_HINT_DISMISS_KEY, "1");
    setShowIosHint(false);
  }

  if (showIosHint) {
    return (
      <div className="fixed inset-x-4 bottom-20 z-50 md:bottom-6 md:left-auto md:right-6 md:w-[380px]">
        <div className="panel flex items-start gap-3 p-4 shadow-panel">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Notificaciones en iPhone</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Para recibir avisos acá necesitás instalar Emmalva: tocá Compartir → &quot;Agregar a inicio&quot;, y después abrila desde ese ícono.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button className="btn-ghost text-xs" onClick={dismissIosHint}>Entendido</button>
            </div>
          </div>
          <button className="rail-icon-button shrink-0" onClick={dismissIosHint} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 md:bottom-6 md:left-auto md:right-6 md:w-[380px]">
      <div className="panel flex items-start gap-3 p-4 shadow-panel">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Activá las notificaciones</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Enterate al instante de aprobaciones, documentos nuevos y recordatorios de check-out.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button className="btn-primary text-xs" onClick={enable}>Activar</button>
            <button className="btn-ghost text-xs" onClick={dismiss}>Ahora no</button>
          </div>
        </div>
        <button className="rail-icon-button shrink-0" onClick={dismiss} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
