import { NextResponse } from "next/server";
import { route } from "@/lib/route";

// El registro autoservicio quedó deshabilitado: las cuentas las crea el administrador
// desde /admin/users con la clave temporaria.
export const POST = route("register", async () => {
  return NextResponse.json(
    { error: "El registro está deshabilitado. Pedile al administrador que cree tu cuenta." },
    { status: 410 },
  );
});
