import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { LoginForm } from "./LoginForm";
import { auth } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ from?: string; error?: string }> }) {
  const session = await auth();
  const sp = await searchParams;
  if (session?.user) redirect("/");

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Ingresá con tu email y contraseña. Después te pediremos tu biometría."
      footer={<>¿Todavía no tenés cuenta? Pedile al administrador que la cree.</>}
    >
      <LoginForm from={sp.from} error={sp.error} />
    </AuthShell>
  );
}
