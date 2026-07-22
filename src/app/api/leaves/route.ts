import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveUser } from "@/lib/session-guard";
import { prisma } from "@/lib/prisma";
import { validateVacationRange, validateDayOffRange, checkVacationApprovable } from "@/lib/leaves";
import { recordAudit } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notify";
import { formatCalendarDate } from "@/lib/utils";
import { route } from "@/lib/route";

const body = z.object({
  type: z.enum(["VACATION", "DAY_OFF"]),
  startDate: z.string(),
  days: z.number().int().optional(),
});

export const POST = route("leaves.create", async (req: NextRequest) => {
  const { session, error: guardError } = await requireActiveUser();
  if (guardError) return guardError;

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

    const profile = await prisma.employeeProfile.findUnique({ where: { userId: session.user.id } });
    if (!profile) return NextResponse.json({ error: "Completá tu perfil antes de pedir vacaciones" }, { status: 400 });

    // Saldo anual + cupo semanal por categoría (misma lógica que en la aprobación)
    const check = await checkVacationApprovable(prisma, {
      userId: session.user.id,
      category: profile.category,
      startDate,
      endDate,
      days: daysInt,
      vacationWeeksPerYear: profile.vacationWeeksPerYear,
      balanceStatuses: ["PENDING", "APPROVED"],
    });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 409 });
  } else {
    // Franco: rango de 1..N días corridos (sin tope mensual). El empleado puede pedir uno o
    // varios días seguidos (p. ej. cursos para renovar carnet/libreta); el admin aprueba.
    const v = validateDayOffRange(parsed.data.startDate, parsed.data.days ?? 1);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    startDate = v.start;
    endDate = v.end;
    daysInt = v.days;

    // Un solo empleado ausente por día: un franco YA APROBADO de OTRO empleado que se solape
    // con el rango bloquea (los pendientes no bloquean; el admin arbitra al aprobar).
    const taken = await prisma.leaveRequest.findFirst({
      where: {
        type: "DAY_OFF",
        status: "APPROVED",
        userId: { not: session.user.id },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (taken) return NextResponse.json({ error: "Ya hay un franco aprobado de otro empleado en esas fechas" }, { status: 409 });

    // No pedir franco dentro de vacaciones propias (PENDING o APPROVED).
    const ownVacationOverlap = await prisma.leaveRequest.findFirst({
      where: {
        userId: session.user.id,
        type: "VACATION",
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (ownVacationOverlap) return NextResponse.json({ error: "Esas fechas ya están dentro de tu período de vacaciones" }, { status: 409 });

    // No solapar con otro franco propio vigente (evita duplicados o rangos encimados).
    const mine = await prisma.leaveRequest.findFirst({
      where: {
        userId: session.user.id,
        type: "DAY_OFF",
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (mine) return NextResponse.json({ error: "Ya tenés un franco pedido que se superpone con esas fechas" }, { status: 409 });
  }

  const leave = await prisma.leaveRequest.create({
    data: { userId: session.user.id, type: parsed.data.type, startDate, endDate, days: daysInt },
  });

  await recordAudit({ actorId: session.user.id, action: "leave.request", subjectId: leave.id, metadata: { type: parsed.data.type, days: daysInt } });

  const label =
    parsed.data.type === "VACATION"
      ? `Vacaciones ${daysInt} días desde ${formatCalendarDate(startDate)}`
      : daysInt > 1
        ? `Franco ${daysInt} días desde ${formatCalendarDate(startDate)}`
        : `Franco el ${formatCalendarDate(startDate)}`;
  notifyAdmins("leave.created", {
    actorEmail: session.user.email,
    actorName: session.user.name,
    detail: label,
  }).catch((e) => console.error("[notify] leave", e));

  return NextResponse.json({ ok: true, id: leave.id });
});
