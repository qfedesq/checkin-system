import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmployeeDetailClient } from "./EmployeeDetailClient";

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
      dniFrontBlobUrl: p?.dniFrontBlobUrl ?? null,
      dniBackBlobUrl: p?.dniBackBlobUrl ?? null,
      licenseFrontBlobUrl: p?.licenseFrontBlobUrl ?? null,
      licenseBackBlobUrl: p?.licenseBackBlobUrl ?? null,
      healthCardFrontBlobUrl: p?.healthCardFrontBlobUrl ?? null,
      healthCardBackBlobUrl: p?.healthCardBackBlobUrl ?? null,
      faceImageBlobUrl: p?.faceImageBlobUrl ?? null,
      signatureBlobUrl: p?.signatureBlobUrl ?? null,
    },
    deliveries: user.deliveriesReceived.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      createdAt: d.createdAt.toISOString(),
      openedAt: d.openedAt?.toISOString() ?? null,
      signedBlobUrl: d.signedBlobUrl,
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
