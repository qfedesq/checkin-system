import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from y to requeridos" }, { status: 400 });

  const fromDate = new Date(from);
  const toDate = new Date(to);

  const [myLeaves, francosAprobados] = await Promise.all([
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
  ]);

  return NextResponse.json({
    myLeaves: myLeaves.map((l) => ({ ...l, startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString() })),
    takenDayOffs: francosAprobados.map((l) => ({ date: l.startDate.toISOString(), byMe: l.userId === session.user.id })),
  });
}
