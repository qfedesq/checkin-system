import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  // Cota defensiva: se ordena alfabéticamente por apellido después. TODO: paginación real si el headcount crece.
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }],
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

  // Alfabético por apellido (los usuarios sin perfil, ej. admins, van al final por email).
  serializable.sort((a, b) => {
    const la = a.lastName.trim();
    const lb = b.lastName.trim();
    if (la && lb) return la.localeCompare(lb, "es") || a.firstName.localeCompare(b.firstName, "es");
    if (la && !lb) return -1;
    if (!la && lb) return 1;
    return a.email.localeCompare(b.email, "es");
  });

  return (
    <>
      <PageHeader eyebrow="admin · usuarios" title="Usuarios" description="Aprobar altas, asignar legajo y fecha de ingreso, resetear contraseñas o dispositivo." />
      <UsersTable users={serializable} currentUserId={session?.user?.id ?? ""} />
    </>
  );
}
