import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { route } from "@/lib/route";

export const POST = route("admin.profile-changes.reject", async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const request = await prisma.profileChangeRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (request.status !== "PENDING") return NextResponse.json({ error: "La solicitud ya fue revisada" }, { status: 409 });

  const { note } = await req.json().catch(() => ({ note: "" }));

  await prisma.profileChangeRequest.update({
    where: { id },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: session.user.id, note: typeof note === "string" && note ? note : null },
  });

  await recordAudit({ actorId: session.user.id, action: "profile.change.reject", subjectId: id, metadata: { userId: request.userId } });
  notifyUser(request.userId, "profile.change.rejected", {
    body: `El administrador rechazó los cambios propuestos en tu perfil.${typeof note === "string" && note ? ` Motivo: ${note}` : ""} Podés volver a intentarlo.`,
  }).catch((e) => console.error("[notify] profile.change.reject", e));

  return NextResponse.json({ ok: true });
});
