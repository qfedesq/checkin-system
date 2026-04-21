import { AuthShell } from "@/components/layout/AuthShell";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PendingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.status === "ACTIVE") redirect("/");

  return (
    <AuthShell title="Cuenta pendiente de aprobación" subtitle="El administrador debe habilitar tu acceso antes de que puedas usar la plataforma.">
      <div className="space-y-4">
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          Apenas quedes aprobado te llegará un email. Podés cerrar esta pestaña.
        </div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="btn-ghost w-full">Cerrar sesión</button>
        </form>
      </div>
    </AuthShell>
  );
}
