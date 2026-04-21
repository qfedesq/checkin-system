import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminDocuments } from "./AdminDocuments";

export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage() {
  const docs = await prisma.documentUpload.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: { include: { profile: true } } },
  });
  const rows = docs.map((d) => ({
    id: d.id,
    type: d.type,
    blobUrl: d.blobUrl,
    expiresAt: d.expiresAt?.toISOString() ?? null,
    status: d.status,
    note: d.note ?? "",
    createdAt: d.createdAt.toISOString(),
    employee: d.user.profile ? `${d.user.profile.firstName} ${d.user.profile.lastName}` : d.user.email,
    email: d.user.email,
  }));
  return (
    <>
      <PageHeader eyebrow="admin · documentación" title="Documentación" description="Aprobá o rechazá los documentos cargados por los empleados." />
      <AdminDocuments docs={rows} />
    </>
  );
}
