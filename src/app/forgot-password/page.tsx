import { AuthShell } from "@/components/layout/AuthShell";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Restablecer contraseña"
      subtitle="Pedile al administrador que te genere una contraseña temporal."
      footer={
        <>
          <Link href="/login" className="text-primary underline underline-offset-4">Volver al login</Link>
        </>
      }
    >
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          Por seguridad, sólo un administrador puede resetear tu contraseña. Contactate con RRHH para recibir una contraseña temporal.
        </p>
        <p>
          Cuando ingreses con esa contraseña temporal, el sistema te va a pedir que la cambies por una nueva.
        </p>
      </div>
    </AuthShell>
  );
}
