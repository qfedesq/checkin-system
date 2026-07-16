import { AuthShell } from "@/components/layout/AuthShell";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// Pantalla para cuentas deshabilitadas. Es el destino al que van los layouts cuando la
// revalidación contra la DB detecta status !== ACTIVE, en lugar de /login (que rebotaría al
// usuario de vuelta al tener todavía una cookie de sesión válida → loop de redirección).
export default async function BlockedPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Revalidar contra la DB: si en realidad está ACTIVE, no corresponde esta pantalla (la mandamos a "/").
  // Un JWT PENDING nunca llega hasta acá: el middleware lo redirige a /pending antes.
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { status: true } });
  if (u?.status === "ACTIVE") redirect("/");

  return (
    <AuthShell title="Cuenta bloqueada" subtitle="Tu cuenta está deshabilitada. Contactá al administrador para reactivarla.">
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          No podés operar en la plataforma mientras tu cuenta esté bloqueada. Si creés que es un error, escribile al administrador.
        </div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="btn-ghost w-full">Cerrar sesión</button>
        </form>
      </div>
    </AuthShell>
  );
}
