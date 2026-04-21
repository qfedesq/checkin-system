import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { RegisterForm } from "./RegisterForm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/");
  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Una vez registrado, el administrador te habilitará para ingresar."
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-primary underline underline-offset-4">Ingresar</Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
