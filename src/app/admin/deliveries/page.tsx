import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeliveriesClient } from "./DeliveriesClient";

export const dynamic = "force-dynamic";

export default async function AdminDeliveriesPage() {
  const [employees, recent] = await Promise.all([
    prisma.user.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, include: { profile: true }, orderBy: { email: "asc" } }),
    prisma.deliveredDocument.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { recipient: { include: { profile: true } } } }),
  ]);

  const employeeOpts = employees.map((e) => ({ id: e.id, label: e.profile ? `${e.profile.firstName} ${e.profile.lastName}` : e.email }));

  const rows = recent.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    recipient: d.recipient.profile ? `${d.recipient.profile.firstName} ${d.recipient.profile.lastName}` : d.recipient.email,
    openedAt: d.openedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader eyebrow="admin · entregas" title="Enviar documentos" description="Subí recibos de sueldo, comunicados o documentos internos (PDF). Cuando el empleado los abra, se van a firmar automáticamente con su firma digital." />
      <DeliveriesClient employees={employeeOpts} rows={rows} />
    </>
  );
}
