import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentsClient } from "./DocumentsClient";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const docs = await prisma.documentUpload.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } });
  const serializable = docs.map((d) => ({
    id: d.id,
    type: d.type,
    blobUrl: d.blobUrl,
    mimeType: d.mimeType,
    expiresAt: d.expiresAt?.toISOString() ?? null,
    status: d.status,
    note: d.note ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader eyebrow="documentación" title="Mis documentos" description="Cargá tu carnet de conducir y libreta sanitaria (PDF o foto). El admin los valida y te avisamos 30 días antes del vencimiento." />
      <DocumentsClient documents={serializable} />
    </>
  );
}
