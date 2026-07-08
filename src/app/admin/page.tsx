import Link from "next/link";
import { Users, Calendar, FileText, Clock, Send, ShieldCheck, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { DonutChart } from "@/components/ui/DonutChart";
import { AdminMiniCalendar } from "./AdminMiniCalendar";
import { formatCalendarDate, daysUntil } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PLACEHOLDER_YEAR = 2098; // libretas "2099-12-31" = sin dato

export default async function AdminHome() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  // Ventana amplia para el calendario: mes anterior hasta +3 meses, así al navegar
  // se ven las vacaciones y francos aprobados de otros meses (no sólo el actual).
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0, 23, 59, 59);

  const [pendingUsers, pendingLeaves, pendingDocs, pendingProfileChanges, openAttendance, activeEmployees, todayAttendances, todayLeaves, profiles, monthLeaves] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.documentUpload.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.profileChangeRequest.count({ where: { status: "PENDING" } }),
    prisma.attendance.count({ where: { checkOutAt: null } }),
    prisma.user.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, select: { id: true } }),
    prisma.attendance.findMany({ where: { checkInAt: { gte: todayStart, lt: todayEnd } }, select: { userId: true, checkOutAt: true } }),
    prisma.leaveRequest.findMany({ where: { status: "APPROVED", startDate: { lte: todayEnd }, endDate: { gte: todayStart } }, select: { userId: true } }),
    prisma.employeeProfile.findMany({
      where: { user: { status: "ACTIVE", role: "EMPLOYEE" } },
      select: { userId: true, firstName: true, lastName: true, category: true, professionalLicenseExpiry: true, healthCardExpiry: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
      include: { user: { include: { profile: true } } },
    }),
  ]);

  // --- Tortas del día ---
  const checkedInUsers = new Set(todayAttendances.map((a) => a.userId));
  const checkedOutUsers = new Set(todayAttendances.filter((a) => a.checkOutAt).map((a) => a.userId));
  const onLeaveToday = new Set(todayLeaves.map((l) => l.userId));
  const totalActive = activeEmployees.length;
  const checkedIn = checkedInUsers.size;
  const checkedOut = checkedOutUsers.size;
  // Ausente: activo, sin check-in hoy y sin licencia aprobada hoy
  const absent = activeEmployees.filter((u) => !checkedInUsers.has(u.id) && !onLeaveToday.has(u.id)).length;

  const cyan = "hsl(199 76% 52%)";
  const green = "hsl(142 72% 45%)";
  const red = "hsl(1 79% 64%)";
  const gray = "hsl(var(--muted-foreground) / 0.35)";

  // --- Próximos 5 vencimientos ---
  const expiries: { name: string; userId: string; label: string; date: Date }[] = [];
  for (const p of profiles) {
    const name = `${p.lastName}, ${p.firstName}`.trim() || "—";
    if (p.category === "DRIVER" && p.professionalLicenseExpiry) {
      expiries.push({ name, userId: p.userId, label: "Carnet profesional", date: p.professionalLicenseExpiry });
    }
    if (p.healthCardExpiry && p.healthCardExpiry.getFullYear() <= PLACEHOLDER_YEAR) {
      expiries.push({ name, userId: p.userId, label: "Libreta sanitaria", date: p.healthCardExpiry });
    }
  }
  const upcoming = expiries
    .filter((e) => e.date >= todayStart)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);
  const expired = expiries.filter((e) => e.date < todayStart).length;

  // --- Calendario del mes ---
  const vacations = monthLeaves
    .filter((l) => l.type === "VACATION")
    .map((l) => ({
      from: l.startDate.toISOString(),
      to: l.endDate.toISOString(),
      label: `${l.user.profile ? `${l.user.profile.lastName}, ${l.user.profile.firstName}` : l.user.email}: ${formatCalendarDate(l.startDate)} → ${formatCalendarDate(l.endDate)}`,
    }));
  const dayOffs = monthLeaves
    .filter((l) => l.type === "DAY_OFF")
    .map((l) => ({
      from: l.startDate.toISOString(),
      to: l.endDate.toISOString(),
      label: `${l.user.profile ? `${l.user.profile.lastName}, ${l.user.profile.firstName}` : l.user.email}: franco el ${formatCalendarDate(l.startDate)}`,
    }));

  const kpis = [
    { href: "/admin/users", icon: Users, label: "Usuarios pendientes", value: pendingUsers },
    { href: "/admin/leaves", icon: Calendar, label: "Solicitudes pendientes", value: pendingLeaves },
    { href: "/admin/documents", icon: ShieldCheck, label: "Docs por validar", value: pendingDocs },
    { href: "/admin/profile-changes", icon: FileText, label: "Cambios de perfil", value: pendingProfileChanges },
    { href: "/admin/attendance", icon: Clock, label: "Jornadas abiertas", value: openAttendance },
  ];

  return (
    <>
      <PageHeader eyebrow="panel admin" title="Resumen" description="El estado del día y todo lo que espera tu revisión." />

      {/* Tortas del día */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="panel p-5">
          <h2 className="eyebrow">Check-in de hoy</h2>
          <div className="mt-3">
            <DonutChart
              centerLabel={`${checkedIn}`}
              segments={[
                { value: checkedIn, color: cyan, label: "Hicieron check-in" },
                { value: Math.max(0, totalActive - checkedIn), color: gray, label: "Sin check-in" },
              ]}
            />
          </div>
        </section>
        <section className="panel p-5">
          <h2 className="eyebrow">Check-out de hoy</h2>
          <div className="mt-3">
            <DonutChart
              centerLabel={`${checkedOut}`}
              segments={[
                { value: checkedOut, color: green, label: "Hicieron check-out" },
                { value: Math.max(0, checkedIn - checkedOut), color: gray, label: "Jornada abierta" },
              ]}
            />
          </div>
        </section>
        <section className="panel p-5">
          <h2 className="eyebrow">Ausentes de hoy</h2>
          <div className="mt-3">
            <DonutChart
              centerLabel={`${absent}`}
              segments={[
                { value: absent, color: red, label: "Ausentes" },
                { value: onLeaveToday.size, color: green, label: "Vacaciones / franco" },
                { value: checkedIn, color: gray, label: "Presentes" },
              ]}
            />
          </div>
        </section>
      </div>

      {/* Vencimientos + calendario */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Próximos 5 vencimientos</h2>
            {expired > 0 && (
              <span className="badge-danger flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {expired} vencido{expired === 1 ? "" : "s"}</span>
            )}
          </div>
          <ul className="mt-4 space-y-2">
            {upcoming.length === 0 && <li className="text-sm text-muted-foreground">Sin vencimientos cargados.</li>}
            {upcoming.map((e, i) => {
              const days = daysUntil(e.date) ?? 0;
              const urgent = days <= 30;
              return (
                <li key={i} className="surface-card flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <Link href={`/admin/employees/${e.userId}`} className="block truncate text-sm font-medium hover:text-primary hover:underline">{e.name}</Link>
                    <div className="text-xs text-muted-foreground">{e.label}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-sm font-semibold ${urgent ? "text-destructive" : ""}`}>{formatCalendarDate(e.date)}</div>
                    <div className={`text-xs ${urgent ? "text-destructive" : "text-muted-foreground"}`}>en {days} día{days === 1 ? "" : "s"}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Vacaciones y francos del mes</h2>
          <div className="mt-3">
            <AdminMiniCalendar vacations={vacations} dayOffs={dayOffs} />
          </div>
        </section>
      </div>

      {/* KPIs pendientes */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.href} href={k.href} className="panel p-5 hover:border-primary/30 transition">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-primary" />
                <div className="mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{k.label}</div>
              </div>
              <div className="mt-6 text-4xl font-semibold">{k.value}</div>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 panel p-6">
        <h2 className="text-lg font-semibold">Accesos rápidos</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link href="/admin/deliveries" className="surface-card surface-card-hover p-4 text-sm">
            <Send className="mb-2 h-4 w-4 text-primary" /> Enviar documento
          </Link>
          <Link href="/admin/attendance" className="surface-card surface-card-hover p-4 text-sm">
            <FileText className="mb-2 h-4 w-4 text-primary" /> Exportar jornadas
          </Link>
          <Link href="/admin/employees" className="surface-card surface-card-hover p-4 text-sm">
            <Users className="mb-2 h-4 w-4 text-primary" /> Fichas de empleados
          </Link>
        </div>
      </div>
    </>
  );
}
