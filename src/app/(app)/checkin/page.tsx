import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { CheckinClient } from "./CheckinClient";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const session = await auth();
  if (!session?.user) return null;
  const [open, user] = await Promise.all([
    prisma.attendance.findFirst({ where: { userId: session.user.id, checkOutAt: null }, orderBy: { checkInAt: "desc" } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { deviceId: true, deviceApprovedAt: true } }),
  ]);
  const devicePending = Boolean(user?.deviceId) && !user?.deviceApprovedAt;
  return (
    <>
      <PageHeader eyebrow="jornada" title="Check-in / Check-out" description="Registrá tu ingreso y egreso con geolocalización y tu biometría." />
      {devicePending && (
        <div className="mb-6 rounded-xl border border-[hsl(19_95%_53%)]/30 bg-[hsl(19_95%_53%)]/10 px-4 py-3 text-sm">
          Tu dispositivo está <strong>pendiente de aprobación del administrador</strong>. Hasta que lo apruebe no vas a poder hacer check-in. Te llega una notificación cuando esté listo.
        </div>
      )}
      <CheckinClient open={open ? { id: open.id, checkInAt: open.checkInAt.toISOString(), lat: open.checkInLat, lng: open.checkInLng } : null} />
    </>
  );
}
