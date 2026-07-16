import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // El JWT no se revoca al deshabilitar la cuenta o cambiar el rol: se revalida contra la DB en cada carga.
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { status: true, role: true } });
  if (!currentUser) redirect("/login");
  // Cuenta no activa (deshabilitada): a /blocked, NO a /login — /login rebotaría al usuario con
  // sesión todavía válida de vuelta a la app → loop de redirección (pantalla en blanco). El caso
  // PENDING con JWT vivo lo intercepta el middleware antes de llegar acá.
  if (currentUser.status !== "ACTIVE") redirect("/blocked");
  if (currentUser.role === "ADMIN") redirect("/admin");

  // Badge de "Recibidos": documentos que el empleado todavía no vio en la bandeja. "Visto"
  // (seenAt) se marca al entrar a /inbox — distinto de "abierto/firmado" (openedAt), que
  // requiere descargar. Antes contábamos openedAt=null, así que una notificación leída en la
  // lista pero no descargada quedaba contada para siempre.
  const unreadDeliveries = await prisma.deliveredDocument.count({
    where: { recipientId: session.user.id, seenAt: null },
  });

  return (
    <AppShell role="EMPLOYEE" userName={session.user.name ?? session.user.email} adminBadges={{ "/inbox": unreadDeliveries }}>
      {children}
    </AppShell>
  );
}
