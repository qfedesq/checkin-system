import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentsClient } from "./DocumentsClient";
import { DocsVencimientos } from "./DocsVencimientos";
import { fileUrl } from "@/lib/file-token";

export const dynamic = "force-dynamic";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const [docs, profile] = await Promise.all([
    prisma.documentUpload.findMany({ where: { userId: session.user.id, type: "OTHER" }, orderBy: { createdAt: "desc" } }),
    prisma.employeeProfile.findUnique({ where: { userId: session.user.id } }),
  ]);
  const serializable = docs.map((d) => ({
    id: d.id,
    type: d.type,
    blobUrl: fileUrl(d.blobUrl),
    mimeType: d.mimeType,
    expiresAt: d.expiresAt?.toISOString() ?? null,
    status: d.status,
    note: d.note ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  const health = {
    date: profile?.healthCardExpiry && profile.healthCardExpiry.getFullYear() < 2099 ? iso(profile.healthCardExpiry) : "",
    front: fileUrl(profile?.healthCardFrontBlobUrl),
    back: fileUrl(profile?.healthCardBackBlobUrl),
  };
  const license = {
    date: iso(profile?.professionalLicenseExpiry),
    front: fileUrl(profile?.licenseFrontBlobUrl),
    back: fileUrl(profile?.licenseBackBlobUrl),
  };

  return (
    <>
      <PageHeader eyebrow="documentación" title="Mis documentos" description="Tus vencimientos y documentos. Te avisamos 30 días antes de cada vencimiento." />
      {profile && <DocsVencimientos category={profile.category} health={health} license={license} />}
      <DocumentsClient documents={serializable} />
    </>
  );
}
