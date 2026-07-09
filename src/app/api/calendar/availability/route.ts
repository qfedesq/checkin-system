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
    prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["PENDING", "APPROVED"] },
        endDate: { gte: fromDate },
        startDate: { lte: toDate },
      },
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
    // Meses (YYYY-MM) donde ya tengo franco pedido/aprobado
    myDayOffMonths: Array.from(
      new Set(
        myLeaves
          .filter((l) => l.type === "DAY_OFF")
          .map((l) => l.startDate.toISOString().slice(0, 7)),
      ),
    ),
  });
});
