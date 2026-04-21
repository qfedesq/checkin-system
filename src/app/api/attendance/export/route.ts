import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const userId = req.nextUrl.searchParams.get("userId");
  const fromDate = from ? new Date(from) : new Date(0);
  const toDate = to ? new Date(to + "T23:59:59") : new Date();

  const rows = await prisma.attendance.findMany({
    where: {
      checkInAt: { gte: fromDate, lte: toDate },
      ...(userId ? { userId } : {}),
    },
    orderBy: { checkInAt: "asc" },
    include: { user: { include: { profile: true } } },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Emmalva";
  const ws = wb.addWorksheet("Jornadas");

  ws.columns = [
    { header: "Legajo", key: "legajo", width: 14 },
    { header: "Apellido", key: "lastName", width: 22 },
    { header: "Nombre", key: "firstName", width: 22 },
    { header: "Email", key: "email", width: 28 },
    { header: "Fecha", key: "date", width: 12 },
    { header: "Check-in", key: "checkIn", width: 20 },
    { header: "Check-out", key: "checkOut", width: 20 },
    { header: "Duración (min)", key: "durationMin", width: 14 },
    { header: "Duración (hh:mm)", key: "duration", width: 14 },
    { header: "Coord in", key: "inCoord", width: 22 },
    { header: "Coord out", key: "outCoord", width: 22 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF29ABE2" } };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const r of rows) {
    const duration = r.durationMin ?? null;
    ws.addRow({
      legajo: r.user.profile?.legajo ?? "",
      lastName: r.user.profile?.lastName ?? "",
      firstName: r.user.profile?.firstName ?? "",
      email: r.user.email,
      date: r.checkInAt.toLocaleDateString("es-AR"),
      checkIn: r.checkInAt.toLocaleString("es-AR"),
      checkOut: r.checkOutAt ? r.checkOutAt.toLocaleString("es-AR") : "",
      durationMin: duration ?? "",
      duration: duration !== null ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}` : "",
      inCoord: `${r.checkInLat.toFixed(5)}, ${r.checkInLng.toFixed(5)}`,
      outCoord: r.checkOutLat !== null && r.checkOutLng !== null ? `${r.checkOutLat.toFixed(5)}, ${r.checkOutLng.toFixed(5)}` : "",
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as unknown as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="jornadas-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
