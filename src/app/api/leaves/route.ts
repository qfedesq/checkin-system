import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLocalDate, validateVacationRange } from "@/lib/leaves";
import { recordAudit } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notify";
import { formatDate } from "@/lib/utils";

const body = z.object({
  type: z.enum(["VACATION", "DAY_OFF"]),
  startDate: z.string(),
  days: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  let startDate: Date, endDate: Date, daysInt: number;

  if (parsed.data.type === "VACATION") {
    const days = (parsed.data.days ?? 0) as 7 | 14;
    const v = validateVacationRange(parsed.data.startDate, days);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    startDate = v.start;
    endDate = v.end;
    daysInt = days;

    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ["PENDING", "APPROVED"] },
        OR: [
          { startDate: { lte: endDate }, endDate: { gte: startDate } },
        ],
      },
    });
    if (overlap) return NextResponse.json({ error: "Ya tenés una solicitud para ese período" }, { status: 409 });
  } else {
    const local = parseLocalDate(parsed.data.startDate);
    if (!local) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    startDate = local;
    endDate = local;
    daysInt = 1;

    // Franco: un único empleado por día (aprobados bloquean; pendientes no bloquean)
    const taken = await prisma.leaveRequest.findFirst({
      where: { type: "DAY_OFF", status: "APPROVED", startDate: local },
    });
    if (taken) return NextResponse.json({ error: "Ya hay un franco aprobado para ese día" }, { status: 409 });

    const mine = await prisma.leaveRequest.findFirst({
      where: { userId: session.user.id, type: "DAY_OFF", startDate: local, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (mine) return NextResponse.json({ error: "Ya pediste franco ese día" }, { status: 409 });
  }

  const leave = await prisma.leaveRequest.create({
    data: { userId: session.user.id, type: parsed.data.type, startDate, endDate, days: daysInt },
  });

  await recordAudit({ actorId: session.user.id, action: "leave.request", subjectId: leave.id, metadata: { type: parsed.data.type, days: daysInt } });

  const label = parsed.data.type === "VACATION" ? `Vacaciones ${daysInt} días desde ${formatDate(startDate)}` : `Franco el ${formatDate(startDate)}`;
  notifyAdmins("leave.created", {
    actorEmail: session.user.email,
    actorName: session.user.name,
    detail: label,
  }).catch((e) => console.error("[notify] leave", e));

  return NextResponse.json({ ok: true, id: leave.id });
}
