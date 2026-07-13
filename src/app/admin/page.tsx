import Link from "next/link";
import { Users, Calendar, FileText, Clock, Send, ShieldCheck, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { TodayCards } from "./TodayCards";
import { AdminMiniCalendar } from "./AdminMiniCalendar";
import { formatCalendarDate, daysUntil } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PLACEHOLDER_YEAR = 2098; // libretas "2099-12-31" = sin dato

export default async function AdminHome() {
  // QA-010: "hoy"/mes deben calcularse en America/Argentina/Buenos_Aires (UTC-3, sin DST),
  // no con getters locales del proceso (en Vercel el proceso corre en UTC y desalinea
  // el día ~21:00-00:00 ART). Se obtiene el día-calendario ART restando el offset fijo.
  const artNow = new Date(Date.now() - 3 * 3600 * 1000);
  const y = artNow.getUTCFullYear();
  const m = artNow.getUTCMonth();
  const d = artNow.getUTCDate();
  // Asistencia de hoy: checkInAt es timestamp real -> comparar contra 00:00 ART / 00:00 ART del día siguiente.
  const todayStart = new Date(Date.UTC(y, m, d, 3, 0, 0));
  const todayEnd = new Date(Date.UTC(y, m, d + 1, 3, 0, 0));
  // Licencias de hoy: startDate/endDate se guardan como medianoche UTC del día-calendario.
  const todayCal = new Date(Date.UTC(y, m, d));
  // Calendario: desde el mes anterior en adelante, SIN tope superior. Antes se cortaba
  // en +3 meses y las vacaciones/francos aprobados más lejanos (ej. noviembre) no se
  // veían al navegar. Las licencias aprobadas futuras están acotadas en la práctica.
  const monthStart = new Date(Date.UTC(y, m - 1, 1));

  const [pendingUsers, pendingLeaves, pendingDocs, pendingProfileChanges, openAttendance, activeEmployees, todayAttendances, todayLeaves, profiles, monthLeaves] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.documentUpload.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.profileChangeRequest.count({ where: { status: "PENDING" } }),
    prisma.attendance.count({ where: { checkOutAt: null } }),
    prisma.user.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, select: { id: true } }),
    prisma.attendance.findMany({ where: { checkInAt: { gte: todayStart, lt: todayEnd } }, select: { userId: true, checkOutAt: true } }),
    prisma.leaveRequest.findMany({ where: { status: "APPROVED", startDate: { lte: todayCal }, endDate: { gte: todayCal } }, select: { userId: true } }),
    prisma.employeeProfile.findMany({
      where: { user: { status: "ACTIVE", role: "EMPLOYEE" } },
      select: { userId: true, firstName: true, lastName: true, category: true, professionalLicenseExpiry: true, healthCardExpiry: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", endDate: { gte: monthStart } },
      orderBy: { startDate: "asc" },
      include: { user: { include: { profile: true } } },
    }),
  ]);

  // --- Tortas del día ---
  const checkedInUsers = new Set(todayAttendances.map((a) => a.userId));
  const checkedOutUsers = new Set(todayAttendances.filter((a) => a.checkOutAt).map((a) => a.userId));
  // "En curso" = entró y todavía NO hizo check-out (jornada vigente). Distinto de "check-in":
  // alguien que entró y ya se fue va en check-out (terminó), no en la tarjeta de en-curso.
  const stillInUsers = new Set(todayAttendances.filter((a) => !a.checkOutAt).map((a) => a.userId));
  const onLeaveToday = new Set(todayLeaves.map((l) => l.userId));
  const totalActive = activeEmployees.length;
  const stillIn = stillInUsers.size;      // jornada en curso (tarjeta "Check-in de hoy")
  const checkedOut = checkedOutUsers.size; // terminaron (tarjeta "Check-out de hoy")
  const checkedIn = checkedInUsers.size;   // total que vino hoy (para "presentes"/ausentes)
  // Ausente: activo, sin check-in hoy y sin licencia aprobada hoy
  const absent = activeEmployees.filter((u) => !checkedInUsers.has(u.id) && !onLeaveToday.has(u.id)).length;

  // Listados de empleados por categoría (para las tarjetas clickeables del panel), sin duplicados.
  const nameByUser = new Map(profiles.map((p) => [p.userId, `${p.lastName}, ${p.firstName}`.trim() || "Empleado"]));
  const nameFor = (id: string) => nameByUser.get(id) ?? "Empleado";
  const checkinPeople = [...stillInUsers].map((id) => ({ name: nameFor(id) }));      // jornada en curso
  const checkoutPeople = [...checkedOutUsers].map((id) => ({ name: nameFor(id) }));  // terminaron
  const absentPeople = activeEmployees
    .filter((u) => !checkedInUsers.has(u.id) && !onLeaveToday.has(u.id))
    .map((u) => ({ name: nameFor(u.id) }));

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
  // professionalLicenseExpiry/healthCardExpiry son fechas-calendario (medianoche UTC), no timestamps:
  // se comparan contra todayCal (mismo criterio que las licencias), no contra todayStart.
  const upcoming = expiries
    .filter((e) => e.date >= todayCal)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);
  const expired = expiries.filter((e) => e.date < todayCal).length;

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

      {/* Tortas del día — clickeables: abren el listado de empleados de cada categoría */}
      <TodayCards
        cards={[
          {
            title: "Check-in de hoy",
            centerLabel: `${stillIn}`,
            segments: [
              { value: stillIn, color: cyan, label: "Jornada en curso" },
              { value: Math.max(0, totalActive - stillIn), color: gray, label: "Sin jornada abierta" },
            ],
            listTitle: "Jornada en curso (entraron y todavía no salieron)",
            people: checkinPeople,
            emptyText: "No hay jornadas en curso.",
          },
          {
            title: "Check-out de hoy",
            centerLabel: `${checkedOut}`,
            segments: [
              { value: checkedOut, color: green, label: "Terminaron la jornada" },
              { value: stillIn, color: gray, label: "Aún en curso" },
            ],
            listTitle: "Terminaron la jornada (entraron y se fueron)",
            people: checkoutPeople,
            emptyText: "Nadie terminó su jornada todavía.",
          },
          {
            title: "Ausentes de hoy",
            centerLabel: `${absent}`,
            segments: [
              { value: absent, color: red, label: "Ausentes" },
              { value: onLeaveToday.size, color: green, label: "Vacaciones / franco" },
              { value: checkedIn, color: gray, label: "Presentes" },
            ],
            listTitle: "Ausentes de hoy (sin check-in ni licencia)",
            people: absentPeople,
            emptyText: "No hay ausentes: todos hicieron check-in o están de licencia.",
          },
        ]}
      />

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
