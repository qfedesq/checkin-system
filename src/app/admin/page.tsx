import Link from "next/link";
import { Users, Calendar, FileText, Clock, Send, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function AdminHome() {
  const [pendingUsers, pendingLeaves, pendingDocs, openAttendance] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.documentUpload.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.attendance.count({ where: { checkOutAt: null } }),
  ]);

  const kpis = [
    { href: "/admin/users", icon: Users, label: "Usuarios pendientes", value: pendingUsers },
    { href: "/admin/leaves", icon: Calendar, label: "Solicitudes pendientes", value: pendingLeaves },
    { href: "/admin/documents", icon: ShieldCheck, label: "Docs por validar", value: pendingDocs },
    { href: "/admin/attendance", icon: Clock, label: "Jornadas abiertas", value: openAttendance },
  ];

  return (
    <>
      <PageHeader eyebrow="panel admin" title="Resumen" description="Todo lo que espera tu revisión." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="panel p-6">
          <h2 className="text-lg font-semibold">Accesos rápidos</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/admin/deliveries" className="surface-card surface-card-hover p-4 text-sm">
              <Send className="mb-2 h-4 w-4 text-primary" /> Enviar documento
            </Link>
            <Link href="/admin/attendance" className="surface-card surface-card-hover p-4 text-sm">
              <FileText className="mb-2 h-4 w-4 text-primary" /> Exportar jornadas
            </Link>
          </div>
        </div>
        <div className="panel p-6">
          <h2 className="text-lg font-semibold">Cómo usar este panel</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Aprobá a los nuevos empleados desde <strong>Usuarios</strong>, revisá sus documentos en <strong>Documentación</strong>, y validá las solicitudes del calendario. Podés exportar las jornadas trabajadas a Excel filtrando por fecha y/o empleado.
          </p>
          <Link href="/help" className="mt-3 inline-flex text-sm text-primary underline underline-offset-4">
            Ver manual completo
          </Link>
        </div>
      </div>
    </>
  );
}
