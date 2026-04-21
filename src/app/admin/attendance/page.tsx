import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { AttendanceClient } from "./AttendanceClient";

export const dynamic = "force-dynamic";

export default async function AdminAttendancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; userId?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const from = sp.from ? new Date(sp.from) : defaultFrom;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : defaultTo;

  const [employees, attendance] = await Promise.all([
    prisma.user.findMany({ where: { role: "EMPLOYEE" }, include: { profile: true }, orderBy: { email: "asc" } }),
    prisma.attendance.findMany({
      where: {
        checkInAt: { gte: from, lte: to },
        ...(sp.userId ? { userId: sp.userId } : {}),
      },
      orderBy: { checkInAt: "desc" },
      include: { user: { include: { profile: true } } },
    }),
  ]);

  const rows = attendance.map((a) => ({
    id: a.id,
    employee: a.user.profile ? `${a.user.profile.firstName} ${a.user.profile.lastName}` : a.user.email,
    legajo: a.user.profile?.legajo ?? "—",
    checkInAt: a.checkInAt.toISOString(),
    checkOutAt: a.checkOutAt?.toISOString() ?? null,
    durationMin: a.durationMin,
    checkInLat: a.checkInLat,
    checkInLng: a.checkInLng,
    checkOutLat: a.checkOutLat,
    checkOutLng: a.checkOutLng,
  }));

  const employeeOpts = employees.map((e) => ({ id: e.id, label: e.profile ? `${e.profile.firstName} ${e.profile.lastName}` : e.email }));

  return (
    <>
      <PageHeader eyebrow="admin · jornadas" title="Jornadas trabajadas" description="Sólo el administrador ve las duraciones. Exportá a Excel filtrando por fecha y/o empleado." />
      <AttendanceClient
        initial={{ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), userId: sp.userId ?? "" }}
        employees={employeeOpts}
        rows={rows}
      />
    </>
  );
}
