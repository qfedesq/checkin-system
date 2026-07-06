import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileChangesClient } from "./ProfileChangesClient";

export const dynamic = "force-dynamic";

export default async function AdminProfileChangesPage() {
  const requests = await prisma.profileChangeRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { user: { include: { profile: true } } },
  });

  const rows = requests.map((r) => ({
    id: r.id,
    employee: r.user.profile ? `${r.user.profile.lastName}, ${r.user.profile.firstName}` : r.user.email,
    userId: r.userId,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    changes: r.changes as Record<string, { from: string; to: string }>,
    note: r.note,
  }));

  return (
    <>
      <PageHeader
        eyebrow="admin · cambios de perfil"
        title="Cambios de perfil"
        description="Los empleados proponen cambios en sus datos; acá los aprobás o rechazás. Al resolverse, el empleado recibe una notificación."
      />
      <ProfileChangesClient rows={rows} />
    </>
  );
}
