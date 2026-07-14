"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Los contadores de los badges del menú admin (Vacaciones/Francos, Documentación,
// etc.) se calculan en admin/layout.tsx, un server component. En navegación "soft"
// (Link) Next no vuelve a ejecutar el layout si ya estaba montado, así que los
// badges quedan desactualizados hasta un refresh manual. Este componente fuerza un
// router.refresh() cada vez que cambia el pathname para re-fetchear el layout.
// router.refresh() no cambia el pathname, así que el effect no se re-dispara solo.
export function AutoRefresh() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
