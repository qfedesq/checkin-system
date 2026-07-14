import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { yearBounds, vacationBalance } from "@/lib/leaves";
import { route } from "@/lib/route";

export const GET = route("calendar.availability", async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from y to requeridos" }, { status: 400 });

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const { start: yStart, end: yEnd } = yearBounds(new Date());

  const [profile, myLeaves, francosAprobados, myYearVacations] = await Promise.all([
    prisma.employeeProfile.findUnique({ where: { userId: session.user.id }, select: { category: true, vacationWeeksPerYear: true } }),
    // Todas las solicitudes vigentes del usuario desde el inicio de la ventana en
    // adelante — SIN tope superior. Antes se acotaba a `startDate <= toDate` (la
    // ventana del calendario, ~4 meses) y una solicitud más lejana no figuraba en
    // "Mis solicitudes" aunque sí se descontara del saldo anual (confusión "0 de 14"
    // con una sola solicitud visible). El calendario ignora las fechas fuera de vista.
    prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        // Incluye REJECTED para que el empleado vea el historial completo en "Mis
        // solicitudes". El coloreado del calendario (modifiers en CalendarClient)
        // y myDayOffMonths filtran explícitamente por status más abajo, así que
        // esto no habilita coloreado ni bloquea meses por una solicitud rechazada.
        status: { in: ["PENDING", "APPROVED", "REJECTED"] },
        endDate: { gte: fromDate },
      },
      orderBy: { startDate: "asc" },
      select: { id: true, type: true, startDate: true, endDate: true, status: true, days: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        type: "DAY_OFF",
        status: "APPROVED",
        startDate: { gte: fromDate, lte: toDate },
      },
      select: { startDate: true, userId: true },
    }),
    prisma.leaveRequest.findMany({
      where: { userId: session.user.id, type: "VACATION", status: { in: ["PENDING", "APPROVED"] }, startDate: { gte: yStart, lte: yEnd } },
      select: { days: true },
    }),
  ]);

  // Semanas ocupadas por vacaciones aprobadas de otros de mi misma categoría (cupo 1 por categoría)
  const categoryTaken = profile
    ? await prisma.leaveRequest.findMany({
        where: {
          type: "VACATION",
          status: "APPROVED",
          userId: { not: session.user.id },
          endDate: { gte: fromDate },
          startDate: { lte: toDate },
          user: { profile: { category: profile.category } },
        },
        select: { startDate: true, endDate: true },
      })
    : [];

  const usedDays = myYearVacations.reduce((a, l) => a + l.days, 0);
  const balance = vacationBalance(profile?.vacationWeeksPerYear ?? 0, usedDays);

  return NextResponse.json({
    myLeaves: myLeaves.map((l) => ({ ...l, startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString() })),
    takenDayOffs: francosAprobados.map((l) => ({ date: l.startDate.toISOString(), byMe: l.userId === session.user.id })),
    categoryTakenRanges: categoryTaken.map((r) => ({ from: r.startDate.toISOString(), to: r.endDate.toISOString() })),
    vacation: {
      weeksPerYear: profile?.vacationWeeksPerYear ?? 0,
      totalDays: balance.totalDays,
      usedDays: balance.usedDays,
      leftDays: balance.leftDays,
    },
    // Meses (YYYY-MM) donde ya tengo franco pedido/aprobado (excluye rechazados:
    // una solicitud rechazada no debe bloquear pedir franco de nuevo ese mes).
    myDayOffMonths: Array.from(
      new Set(
        myLeaves
          .filter((l) => l.type === "DAY_OFF" && l.status !== "REJECTED")
          .map((l) => l.startDate.toISOString().slice(0, 7)),
      ),
    ),
  });
});
