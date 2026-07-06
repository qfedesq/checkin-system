import { NextResponse } from "next/server";

// El registro autoservicio quedó deshabilitado: las cuentas las crea el administrador
// desde /admin/users con la clave temporaria.
export async function POST() {
  return NextResponse.json(
    { error: "El registro está deshabilitado. Pedile al administrador que cree tu cuenta." },
    { status: 410 },
  );
}
