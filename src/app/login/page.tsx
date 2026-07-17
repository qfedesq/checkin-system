import { redirect } from "next/navigation";
import Link from "next/link";
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
      footer={<>¿Primera vez? <Link href="/guia" className="text-[hsl(var(--primary-text))] underline underline-offset-4">Mirá cómo darte de alta</Link>. ¿No tenés cuenta? Pedile al administrador que la cree.</>}
    >
      <LoginForm from={sp.from} error={sp.error} />
    </AuthShell>
  );
}
