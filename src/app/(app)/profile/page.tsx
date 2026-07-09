import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileForm } from "./ProfileForm";
import { fileUrl } from "@/lib/file-token";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) return null;
  const [profile, pendingRequest] = await Promise.all([
    prisma.employeeProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.profileChangeRequest.findFirst({ where: { userId: session.user.id, status: "PENDING" } }),
  ]);

  const initial = profile
    ? {
        legajo: profile.legajo ?? "",
        hireDate: profile.hireDate?.toISOString().slice(0, 10) ?? "",
        lastName: profile.lastName,
        firstName: profile.firstName,
        dob: profile.dob.toISOString().slice(0, 10),
        cuil: profile.cuil.startsWith("PENDING-") ? "" : profile.cuil,
        category: profile.category,
        phone: profile.phone,
        professionalLicenseExpiry: profile.professionalLicenseExpiry?.toISOString().slice(0, 10) ?? "",
        healthCardExpiry: profile.healthCardExpiry.getTime() > new Date("2099-01-01").getTime() ? "" : profile.healthCardExpiry.toISOString().slice(0, 10),
        shirtSize: profile.shirtSize,
        hoodieSize: profile.hoodieSize,
        jacketSize: profile.jacketSize,
        pantsSize: profile.pantsSize,
        shoeSize: profile.shoeSize,
        address: profile.address,
        addressNumber: profile.addressNumber,
        neighborhood: profile.neighborhood,
        city: profile.city,
        postalCode: profile.postalCode,
        emergencyContact: profile.emergencyContact,
        emergencyPhone: profile.emergencyPhone,
        signatureBlobUrl: fileUrl(profile.signatureBlobUrl),
        faceImageBlobUrl: fileUrl(profile.faceImageBlobUrl),
        healthCardFrontBlobUrl: fileUrl(profile.healthCardFrontBlobUrl),
        healthCardBackBlobUrl: fileUrl(profile.healthCardBackBlobUrl),
        licenseFrontBlobUrl: fileUrl(profile.licenseFrontBlobUrl),
        licenseBackBlobUrl: fileUrl(profile.licenseBackBlobUrl),
      }
    : null;

  return (
    <>
      <PageHeader eyebrow="mi perfil" title="Datos personales" description="Completá tus datos para operar en la plataforma. Los cambios los aprueba el administrador; los datos de identidad sólo los edita él." />
      <ProfileForm
        initial={initial}
        email={session.user.email}
        pendingFields={pendingRequest ? Object.keys(pendingRequest.changes as Record<string, unknown>) : []}
      />
    </>
  );
}
