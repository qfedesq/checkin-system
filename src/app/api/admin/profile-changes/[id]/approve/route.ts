import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

const DATE_FIELDS = ["dob", "professionalLicenseExpiry", "healthCardExpiry"];

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await ctx.params;

  const request = await prisma.profileChangeRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (request.status !== "PENDING") return NextResponse.json({ error: "La solicitud ya fue revisada" }, { status: 409 });

  const changes = request.changes as Record<string, { from: string; to: string }>;
  const data: Record<string, unknown> = {};
  for (const [field, { to }] of Object.entries(changes)) {
    if (DATE_FIELDS.includes(field)) {
      data[field] = to ? new Date(to) : null;
    } else {
      data[field] = to;
    }
  }

  await prisma.$transaction([
    prisma.employeeProfile.update({ where: { userId: request.userId }, data }),
    prisma.profileChangeRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: session.user.id },
    }),
  ]);

  await recordAudit({ actorId: session.user.id, action: "profile.change.approve", subjectId: id, metadata: { userId: request.userId } });
  notifyUser(request.userId, "profile.change.approved", {
    body: `El administrador aprobó los cambios de tu perfil (${Object.keys(changes).length} campo/s). Ya están aplicados.`,
  }).catch((e) => console.error("[notify] profile.change.approve", e));

  return NextResponse.json({ ok: true });
}
