"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Al entrar a la bandeja marca las entregas como vistas y, si había alguna sin ver,
// refresca la ruta para que el layout recalcule el badge de "no leídos" (en navegación
// soft el layout compartido no se re-renderiza por su cuenta).
export function MarkSeen() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    fetch("/api/inbox/seen", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d.marked === "number" && d.marked > 0) router.refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}
