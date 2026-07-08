import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentsClient } from "./DocumentsClient";
import { formatCalendarDate, daysUntil } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const [docs, profile] = await Promise.all([
    prisma.documentUpload.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } }),
    prisma.employeeProfile.findUnique({ where: { userId: session.user.id } }),
  ]);
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

  // Vencimientos que el empleado ya cargó en su perfil (libreta y, si es chofer, carnet).
  const profileExpiries: { label: string; date: Date; front: string | null; back: string | null }[] = [];
  if (profile?.healthCardExpiry && profile.healthCardExpiry.getFullYear() < 2099) {
    profileExpiries.push({ label: "Libreta sanitaria", date: profile.healthCardExpiry, front: profile.healthCardFrontBlobUrl, back: profile.healthCardBackBlobUrl });
  }
  if (profile?.category === "DRIVER" && profile.professionalLicenseExpiry) {
    profileExpiries.push({ label: "Carnet profesional", date: profile.professionalLicenseExpiry, front: profile.licenseFrontBlobUrl, back: profile.licenseBackBlobUrl });
  }

  return (
    <>
      <PageHeader eyebrow="documentación" title="Mis documentos" description="Tus vencimientos y documentos. Te avisamos 30 días antes de cada vencimiento." />

      {profileExpiries.length > 0 && (
        <section className="panel mb-6 p-5">
          <h2 className="text-lg font-semibold">Vencimientos de tu perfil</h2>
          <ul className="mt-3 space-y-2">
            {profileExpiries.map((e, i) => {
              const d = daysUntil(e.date) ?? 0;
              const urgent = d <= 30;
              return (
                <li key={i} className="surface-card flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <div className="text-sm font-medium">{e.label}</div>
                    <div className={`text-xs ${urgent ? "text-destructive" : "text-muted-foreground"}`}>
                      Vence el {formatCalendarDate(e.date)} {d >= 0 ? `· en ${d} día${d === 1 ? "" : "s"}` : "· vencido"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {e.front && <a href={e.front} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">Frente</a>}
                    {e.back && <a href={e.back} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">Dorso</a>}
                    {!e.front && !e.back && <span className="text-muted-foreground">sin imágenes</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Estas fechas e imágenes se cargan y editan desde <strong>Mi perfil</strong>.</p>
        </section>
      )}

      <DocumentsClient documents={serializable} />
    </>
  );
}
