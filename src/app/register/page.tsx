import { redirect } from "next/navigation";

// El registro autoservicio quedó deshabilitado: las cuentas las crea el administrador.
export default function RegisterPage() {
  redirect("/login");
}
