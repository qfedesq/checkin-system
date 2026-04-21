import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminLeavesTable } from "./AdminLeavesTable";

export const dynamic = "force-dynamic";

export default async function AdminLeavesPage() {
  const leaves = await prisma.leaveRequest.findMany({
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
    include: { user: { include: { profile: true } } },
  });
  const rows = leaves.map((l) => ({
    id: l.id,
    type: l.type,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate.toISOString(),
    days: l.days,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
    employee: l.user.profile ? `${l.user.profile.firstName} ${l.user.profile.lastName}` : l.user.email,
    legajo: l.user.profile?.legajo ?? null,
  }));
  return (
    <>
      <PageHeader eyebrow="admin · vacaciones / francos" title="Solicitudes" description="Aprobá o rechazá solicitudes de vacaciones (7/14 días, inicio lunes) y francos diarios (máx 1 por día)." />
      <AdminLeavesTable leaves={rows} />
    </>
  );
}
