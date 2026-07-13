import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { fileUrl } from "@/lib/file-token";
import { ProfileChangesClient } from "./ProfileChangesClient";

export const dynamic = "force-dynamic";

// Campos de imagen: en la vista admin se muestran como miniatura (antes → nuevo) en vez de texto.
const IMAGE_FIELDS = new Set([
  "faceImageBlobUrl",
  "signatureBlobUrl",
  "dniFrontBlobUrl",
  "dniBackBlobUrl",
  "licenseFrontBlobUrl",
  "licenseBackBlobUrl",
  "healthCardFrontBlobUrl",
  "healthCardBackBlobUrl",
]);

export default async function AdminProfileChangesPage() {
  const requests = await prisma.profileChangeRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { user: { include: { profile: true } } },
  });

  const rows = requests.map((r) => {
    const raw = r.changes as Record<string, { from: string; to: string }>;
    // fileUrl es server-only: pre-computamos acá las URLs proxeadas de las imágenes.
    const changes = Object.fromEntries(
      Object.entries(raw).map(([field, v]) =>
        IMAGE_FIELDS.has(field)
          ? [field, { type: "image" as const, from: fileUrl(v.from), to: fileUrl(v.to) }]
          : [field, { type: "text" as const, from: v.from, to: v.to }]
      )
    );
    return {
      id: r.id,
      employee: r.user.profile ? `${r.user.profile.lastName}, ${r.user.profile.firstName}` : r.user.email,
      userId: r.userId,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      changes,
      note: r.note,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="admin · cambios de perfil"
        title="Cambios de perfil"
        description="Los empleados proponen cambios en sus datos; acá los aprobás o rechazás. Al resolverse, el empleado recibe una notificación."
      />
      <ProfileChangesClient rows={rows} />
    </>
  );
}
