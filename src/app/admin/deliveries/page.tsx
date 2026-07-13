import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeliveriesClient } from "./DeliveriesClient";

export const dynamic = "force-dynamic";

export default async function AdminDeliveriesPage({ searchParams }: { searchParams: Promise<{ recipientId?: string }> }) {
  const { recipientId } = await searchParams;
  const [employees, recent] = await Promise.all([
    prisma.user.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, include: { profile: true }, orderBy: { email: "asc" } }),
    prisma.deliveredDocument.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { recipient: { include: { profile: true } } } }),
  ]);

  // Etiqueta desambiguada: hay empleados con nombres casi idénticos (p. ej. dos
  // "Maximiliano Klein"). Mostramos nombre · legajo · email para que el admin no le
  // mande el documento al destinatario equivocado (era la causa de "mandé un recibo
  // y el usuario no lo recibió": iba a otra cuenta con el mismo nombre).
  const employeeOpts = employees.map((e) => {
    const name = e.profile ? `${e.profile.firstName} ${e.profile.lastName}`.trim() : "";
    const parts = [name || e.email];
    if (e.profile?.legajo) parts.push(`legajo ${e.profile.legajo}`);
    if (name) parts.push(e.email);
    return { id: e.id, label: parts.join(" · ") };
  });

  const rows = recent.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    recipient: (() => {
      const name = d.recipient.profile ? `${d.recipient.profile.firstName} ${d.recipient.profile.lastName}`.trim() : "";
      const parts = [name || d.recipient.email];
      if (d.recipient.profile?.legajo) parts.push(`legajo ${d.recipient.profile.legajo}`);
      if (name) parts.push(d.recipient.email);
      return parts.join(" · ");
    })(),
    openedAt: d.openedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader eyebrow="admin · entregas" title="Enviar documentos" description="Subí recibos de sueldo, comunicados o documentos internos (PDF). Cuando el empleado los abra, se van a firmar automáticamente con su firma digital." />
      <DeliveriesClient employees={employeeOpts} rows={rows} initialRecipientId={recipientId} />
    </>
  );
}
