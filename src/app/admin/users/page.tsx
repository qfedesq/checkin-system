import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  // Cota defensiva: prioriza pendientes (status asc) y más recientes. TODO: paginación real si el headcount crece.
  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { profile: true, webauthnCredentials: { select: { id: true } } },
    take: 100,
  });

  const serializable = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    hasDevice: Boolean(u.deviceId),
    devicePending: Boolean(u.deviceId) && !u.deviceApprovedAt,
    createdAt: u.createdAt.toISOString(),
    firstName: u.profile?.firstName ?? "",
    lastName: u.profile?.lastName ?? "",
    legajo: u.profile?.legajo ?? null,
    hireDate: u.profile?.hireDate?.toISOString() ?? null,
  }));

  return (
    <>
      <PageHeader eyebrow="admin · usuarios" title="Usuarios" description="Aprobar altas, asignar legajo y fecha de ingreso, resetear contraseñas o dispositivo." />
      <UsersTable users={serializable} currentUserId={session?.user?.id ?? ""} />
    </>
  );
}
