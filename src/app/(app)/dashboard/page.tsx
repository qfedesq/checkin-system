import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { daysUntil, formatDate, formatDateTime } from "@/lib/utils";
import { Calendar, FileText, Inbox, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmployeeDashboard() {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const [profile, lastAttendance, pendingLeaves, inboxCount, upcomingDocs] = await Promise.all([
    prisma.employeeProfile.findUnique({ where: { userId } }),
    prisma.attendance.findFirst({ where: { userId }, orderBy: { checkInAt: "desc" } }),
    prisma.leaveRequest.count({ where: { userId, status: "PENDING" } }),
    prisma.deliveredDocument.count({ where: { recipientId: userId, openedAt: null } }),
    prisma.documentUpload.findMany({ where: { userId, expiresAt: { not: null } }, orderBy: { expiresAt: "asc" } }),
  ]);

  const warnings: { label: string; days: number }[] = [];
  if (profile?.healthCardExpiry) {
    const d = daysUntil(profile.healthCardExpiry);
    if (d !== null && d <= 30) warnings.push({ label: "Libreta sanitaria", days: d });
  }
  if (profile?.category === "DRIVER" && profile?.professionalLicenseExpiry) {
    const d = daysUntil(profile.professionalLicenseExpiry);
    if (d !== null && d <= 30) warnings.push({ label: "Carnet profesional", days: d });
  }
  for (const doc of upcomingDocs) {
    if (!doc.expiresAt) continue;
    const d = daysUntil(doc.expiresAt);
    if (d !== null && d <= 30) warnings.push({ label: doc.type === "DRIVER_LICENSE" ? "Carnet de conducir" : doc.type === "HEALTH_CARD" ? "Libreta sanitaria (upload)" : "Documento", days: d });
  }

  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";

  return (
    <>
      <PageHeader eyebrow="inicio" title={`Hola${name ? `, ${name.split(" ")[0]}` : ""}`} description="Revisá tu estado y lo próximo a vencer." />

      {warnings.length > 0 && (
        <div className="mb-6 panel border-l-4 border-primary p-5">
          <div className="eyebrow mb-2 text-primary">Alertas de vencimiento</div>
          <ul className="space-y-1 text-sm">
            {warnings.map((w, i) => (
              <li key={i}>
                <strong>{w.label}</strong> — {w.days <= 0 ? "vencido" : `vence en ${w.days} días`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/checkin" className="panel p-5 hover:border-primary/30 transition">
          <MapPin className="h-5 w-5 text-primary" />
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-6">Última jornada</div>
          {lastAttendance ? (
            <>
              <div className="mt-1 text-lg font-semibold">{formatDate(lastAttendance.checkInAt)}</div>
              <div className="text-xs text-muted-foreground">
                {lastAttendance.checkOutAt ? "Jornada cerrada" : "Jornada abierta"}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">Aún no hiciste check-in</div>
          )}
        </Link>
        <Link href="/calendar" className="panel p-5 hover:border-primary/30 transition">
          <Calendar className="h-5 w-5 text-primary" />
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-6">Solicitudes abiertas</div>
          <div className="mt-1 text-4xl font-semibold">{pendingLeaves}</div>
        </Link>
        <Link href="/inbox" className="panel p-5 hover:border-primary/30 transition">
          <Inbox className="h-5 w-5 text-primary" />
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-6">Documentos sin abrir</div>
          <div className="mt-1 text-4xl font-semibold">{inboxCount}</div>
        </Link>
        <Link href="/documents" className="panel p-5 hover:border-primary/30 transition">
          <FileText className="h-5 w-5 text-primary" />
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-6">Próximo vencimiento</div>
          <div className="mt-1 text-sm">
            {profile?.healthCardExpiry ? `Libreta sanitaria · ${formatDate(profile.healthCardExpiry)}` : "—"}
          </div>
          {profile?.professionalLicenseExpiry && (
            <div className="mt-1 text-xs text-muted-foreground">Carnet · {formatDate(profile.professionalLicenseExpiry)}</div>
          )}
        </Link>
      </div>

      {lastAttendance && (
        <div className="mt-6 panel p-5">
          <div className="eyebrow">Último check-in</div>
          <div className="mt-2 text-sm">{formatDateTime(lastAttendance.checkInAt)}</div>
          <div className="text-xs text-muted-foreground">
            Lat {lastAttendance.checkInLat.toFixed(5)} · Lng {lastAttendance.checkInLng.toFixed(5)}
          </div>
        </div>
      )}
    </>
  );
}
