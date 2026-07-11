import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminLeavesTable } from "./AdminLeavesTable";

export const dynamic = "force-dynamic";

export default async function AdminLeavesPage() {
  // Cota defensiva: prioriza pendientes (status asc) y próximas. TODO: paginación real si el volumen crece.
  const leaves = await prisma.leaveRequest.findMany({
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
    include: { user: { include: { profile: true } } },
    take: 100,
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
      <PageHeader eyebrow="admin · vacaciones / francos" title="Solicitudes" description="Aprobá o rechazá solicitudes de vacaciones (7/14 días de corrido, inicio lunes) y francos (máx 1 por mes por empleado)." />
      <AdminLeavesTable leaves={rows} />
    </>
  );
}
