import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { toCalendarISODate } from "@/lib/utils";
import { AttendanceClient } from "./AttendanceClient";

export const dynamic = "force-dynamic";

export default async function AdminAttendancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; userId?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const defaultFromISO = toCalendarISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultToISO = toCalendarISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const fromISO = sp.from || defaultFromISO;
  const toISO = sp.to || defaultToISO;

  // Mismos límites de día-calendario ART (UTC-3) que usa el export (src/app/api/attendance/export/route.ts):
  // antes la pantalla parseaba "from"/"to" naive en UTC mientras el export usaba 03:00 UTC como
  // frontera del día ART, así que pantalla y Excel podían mostrar jornadas distintas para el mismo filtro.
  const parseArtDay = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
  };
  const fromParts = parseArtDay(fromISO);
  const toParts = parseArtDay(toISO);
  const from = fromParts ? new Date(Date.UTC(fromParts.y, fromParts.m, fromParts.d, 3, 0, 0)) : new Date(0);
  const to = toParts ? new Date(Date.UTC(toParts.y, toParts.m, toParts.d + 1, 3, 0, 0)) : new Date();

  const [employees, attendance] = await Promise.all([
    prisma.user.findMany({ where: { role: "EMPLOYEE" }, include: { profile: true }, orderBy: { email: "asc" } }),
    prisma.attendance.findMany({
      where: {
        checkInAt: { gte: from, lt: to },
        ...(sp.userId ? { userId: sp.userId } : {}),
      },
      orderBy: { checkInAt: "desc" },
      include: { user: { include: { profile: true } } },
    }),
  ]);

  const rows = attendance.map((a) => {
    const lastName = a.user.profile?.lastName?.trim() ?? "";
    const firstName = a.user.profile?.firstName?.trim() ?? "";
    const employee = lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName || a.user.email;
    return {
      id: a.id,
      employee,
      lastName: lastName || employee,
      legajo: a.user.profile?.legajo ?? "—",
      checkInAt: a.checkInAt.toISOString(),
      checkOutAt: a.checkOutAt?.toISOString() ?? null,
      durationMin: a.durationMin,
      checkInLat: a.checkInLat,
      checkInLng: a.checkInLng,
      checkOutLat: a.checkOutLat,
      checkOutLng: a.checkOutLng,
    };
  });

  const employeeOpts = employees.map((e) => ({ id: e.id, label: e.profile ? `${e.profile.firstName} ${e.profile.lastName}` : e.email }));

  return (
    <>
      <PageHeader eyebrow="admin · jornadas" title="Jornadas trabajadas" description="Sólo el administrador ve las duraciones. Exportá a Excel filtrando por fecha y/o empleado." />
      <AttendanceClient
        initial={{ from: fromISO, to: toISO, userId: sp.userId ?? "" }}
        employees={employeeOpts}
        rows={rows}
      />
    </>
  );
}
