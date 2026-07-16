import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "./AutoRefresh";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // El JWT no se revoca al deshabilitar la cuenta o bajar de rol: se revalida contra la DB en cada carga.
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { status: true, role: true } });
  if (!currentUser) redirect("/login");
  // Cuenta no activa (deshabilitada): a /blocked, NO a /login — /login rebotaría al usuario con
  // sesión todavía válida de vuelta a la app → loop de redirección. El caso PENDING con JWT vivo
  // lo intercepta el middleware antes de llegar acá.
  if (currentUser.status !== "ACTIVE") redirect("/blocked");
  if (currentUser.role !== "ADMIN") redirect("/dashboard");

  const [pendingUsers, pendingLeaves, pendingDocs, pendingProfileChanges] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.documentUpload.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.profileChangeRequest.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <AppShell
      role="ADMIN"
      userName={session.user.name ?? session.user.email}
      adminBadges={{
        "/admin/users": pendingUsers,
        "/admin/leaves": pendingLeaves,
        "/admin/documents": pendingDocs,
        "/admin/profile-changes": pendingProfileChanges,
      }}
    >
      <AutoRefresh />
      {children}
    </AppShell>
  );
}
