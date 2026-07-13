import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/session-guard";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/route";

// Marca como "vistas" las entregas del empleado (limpia el contador de no leídos de la nav).
// Lo llama el cliente al entrar a /inbox y luego hace router.refresh() para que el layout
// (que calcula el badge) se vuelva a renderizar — en navegación soft el layout no se re-renderiza solo.
export const POST = route("inbox.seen", async () => {
  const { session, error } = await requireActiveUser();
  if (error) return error;
  const res = await prisma.deliveredDocument.updateMany({
    where: { recipientId: session.user.id, seenAt: null },
    data: { seenAt: new Date() },
  });
  return NextResponse.json({ marked: res.count });
});
