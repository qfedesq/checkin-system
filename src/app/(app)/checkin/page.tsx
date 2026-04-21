import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { CheckinClient } from "./CheckinClient";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const session = await auth();
  if (!session?.user) return null;
  const open = await prisma.attendance.findFirst({ where: { userId: session.user.id, checkOutAt: null }, orderBy: { checkInAt: "desc" } });
  return (
    <>
      <PageHeader eyebrow="jornada" title="Check-in / Check-out" description="Registrá tu ingreso y egreso con geolocalización y tu biometría." />
      <CheckinClient open={open ? { id: open.id, checkInAt: open.checkInAt.toISOString(), lat: open.checkInLat, lng: open.checkInLng } : null} />
    </>
  );
}
