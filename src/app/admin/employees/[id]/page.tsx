import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmployeeDetailClient } from "./EmployeeDetailClient";
import { fileUrl } from "@/lib/file-token";

export const dynamic = "force-dynamic";

export default async function AdminEmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      deliveriesReceived: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!user || user.role !== "EMPLOYEE") notFound();

  const p = user.profile;
  const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

  const initial = {
    id: user.id,
    email: user.email,
    status: user.status,
    hasDevice: Boolean(user.deviceId),
    profile: {
      legajo: p?.legajo ?? "",
      lastName: p?.lastName ?? "",
      firstName: p?.firstName ?? "",
      dob: iso(p?.dob),
      dni: p?.dni ?? "",
      cuil: p?.cuil?.startsWith("PENDING-") ? "" : p?.cuil ?? "",
      hireDate: iso(p?.hireDate),
      category: p?.category ?? "HELPER",
      phone: p?.phone ?? "",
      professionalLicenseExpiry: iso(p?.professionalLicenseExpiry),
      healthCardExpiry: p?.healthCardExpiry && p.healthCardExpiry.getFullYear() > 2098 ? "" : iso(p?.healthCardExpiry),
      shirtSize: p?.shirtSize ?? "",
      hoodieSize: p?.hoodieSize ?? "",
      jacketSize: p?.jacketSize ?? "",
      pantsSize: p?.pantsSize ?? "",
      shoeSize: p?.shoeSize ?? "",
      address: p?.address ?? "",
      addressNumber: p?.addressNumber ?? "",
      neighborhood: p?.neighborhood ?? "",
      city: p?.city ?? "",
      postalCode: p?.postalCode ?? "",
      emergencyContact: p?.emergencyContact ?? "",
      emergencyPhone: p?.emergencyPhone ?? "",
      vacationWeeksPerYear: p?.vacationWeeksPerYear ?? 2,
      checkinLat: p?.checkinLat ?? null,
      checkinLng: p?.checkinLng ?? null,
      checkinRadiusM: p?.checkinRadiusM ?? 100,
      checkoutLat: p?.checkoutLat ?? null,
      checkoutLng: p?.checkoutLng ?? null,
      checkoutRadiusM: p?.checkoutRadiusM ?? 100,
      dniFrontBlobUrl: fileUrl(p?.dniFrontBlobUrl) || null,
      dniBackBlobUrl: fileUrl(p?.dniBackBlobUrl) || null,
      licenseFrontBlobUrl: fileUrl(p?.licenseFrontBlobUrl) || null,
      licenseBackBlobUrl: fileUrl(p?.licenseBackBlobUrl) || null,
      healthCardFrontBlobUrl: fileUrl(p?.healthCardFrontBlobUrl) || null,
      healthCardBackBlobUrl: fileUrl(p?.healthCardBackBlobUrl) || null,
      faceImageBlobUrl: fileUrl(p?.faceImageBlobUrl) || null,
      signatureBlobUrl: fileUrl(p?.signatureBlobUrl) || null,
    },
    deliveries: user.deliveriesReceived.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      createdAt: d.createdAt.toISOString(),
      openedAt: d.openedAt?.toISOString() ?? null,
      signedBlobUrl: d.signedBlobUrl ? fileUrl(d.signedBlobUrl) : null,
    })),
  };

  const displayName = p ? `${p.lastName}, ${p.firstName}` : user.email;

  return (
    <>
      <PageHeader
        eyebrow="admin · empleados · ficha"
        title={displayName}
        description="El administrador puede ver y editar todos los campos del legajo."
      />
      <EmployeeDetailClient initial={initial} />
    </>
  );
}
