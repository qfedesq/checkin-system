import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminDocuments } from "./AdminDocuments";
import { fileUrl } from "@/lib/file-token";

export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage() {
  // Cota defensiva: prioriza pendientes (status asc) y más recientes. TODO: paginación real si el volumen crece.
  const docs = await prisma.documentUpload.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: { include: { profile: true } } },
    take: 100,
  });
  const rows = docs.map((d) => ({
    id: d.id,
    type: d.type,
    blobUrl: fileUrl(d.blobUrl),
    expiresAt: d.expiresAt?.toISOString() ?? null,
    status: d.status,
    note: d.note ?? "",
    createdAt: d.createdAt.toISOString(),
    employee: d.user.profile ? `${d.user.profile.lastName}, ${d.user.profile.firstName}` : d.user.email,
    lastName: d.user.profile?.lastName ?? d.user.email,
    email: d.user.email,
  }));
  return (
    <>
      <PageHeader eyebrow="admin · documentación" title="Documentación" description="Aprobá o rechazá los documentos cargados por los empleados." />
      <AdminDocuments docs={rows} />
    </>
  );
}
