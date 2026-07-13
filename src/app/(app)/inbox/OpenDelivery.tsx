"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

// Botón de descarga/firma. Al abrir un documento sin firmar, el server marca openedAt,
// pero la lista ya renderizada quedaría vieja ("sin abrir"). Cuando el usuario vuelve a la
// app (focus) refrescamos la ruta para que la fila pase a "firmado". Fallback por timeout
// porque en algunos navegadores/PWA el evento focus no siempre dispara.
export function OpenDelivery({ id, opened }: { id: string; opened: boolean }) {
  const router = useRouter();

  function onClick() {
    if (opened) return; // ya firmado: no hace falta refrescar
    let done = false;
    const refresh = () => {
      if (done) return;
      done = true;
      window.removeEventListener("focus", onFocus);
      router.refresh();
    };
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    setTimeout(refresh, 4000);
  }

  return (
    <a className="btn-primary" href={`/api/deliveries/${id}/open`} target="_blank" rel="noreferrer" onClick={onClick}>
      <Download className="h-4 w-4" /> {opened ? "Descargar firmado" : "Descargar y firmar"}
    </a>
  );
}
