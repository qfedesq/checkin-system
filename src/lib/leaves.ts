import type { Category, Prisma, PrismaClient } from "@prisma/client";
import { artTodayCalendarDate } from "./utils";

// Todas las fechas-calendario (vacaciones, francos) se manejan como medianoche UTC del
// día elegido, independientes de la zona horaria del servidor o del cliente.

export function isMonday(date: Date): boolean {
  return date.getUTCDay() === 1;
}

export function addDays(date: Date, days: number): Date {
  // Sumar días en ms mantiene la medianoche UTC (no hay DST en UTC).
  return new Date(date.getTime() + days * 86400000);
}

export function atMidnightUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseLocalDate(input: string): Date | null {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const [, y, mo, d] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
}

/** Fecha-calendario (medianoche UTC) < hoy ART: usado para rechazar inicios en el pasado
 *  tanto en vacaciones como en franco. */
export function isPastCalendarDate(date: Date): boolean {
  return date.getTime() < artTodayCalendarDate().getTime();
}

/** Tope superior de días para un franco. El admin igual aprueba cada solicitud; es solo
 *  una barrera contra input patológico (no un límite de política de negocio). */
export const MAX_DAY_OFF_DAYS = 30;

/** Valida un franco de 1..MAX_DAY_OFF_DAYS días corridos a partir de una fecha.
 *  A diferencia de las vacaciones, no exige empezar un lunes ni una duración fija:
 *  el empleado puede pedir 1, 2, 3… días seguidos (p. ej. cursos de renovación). */
export function validateDayOffRange(startISO: string, days: number): { ok: true; start: Date; end: Date; days: number } | { ok: false; error: string } {
  const start = parseLocalDate(startISO);
  if (!start) return { ok: false, error: "Fecha inválida" };
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAY_OFF_DAYS) {
    return { ok: false, error: `El franco debe ser de 1 a ${MAX_DAY_OFF_DAYS} días corridos` };
  }
  if (isPastCalendarDate(start)) return { ok: false, error: "La fecha de inicio no puede ser en el pasado" };
  const end = addDays(start, days - 1);
  return { ok: true, start, end, days };
}

export function validateVacationRange(startISO: string, days: 7 | 14): { ok: true; start: Date; end: Date } | { ok: false; error: string } {
  const start = parseLocalDate(startISO);
  if (!start) return { ok: false, error: "Fecha inicial inválida" };
  if (start.getUTCDay() !== 1) return { ok: false, error: "Las vacaciones deben comenzar un lunes" };
  if (days !== 7 && days !== 14) return { ok: false, error: "Las vacaciones son de 7 o 14 días" };
  if (isPastCalendarDate(start)) return { ok: false, error: "La fecha de inicio no puede ser en el pasado" };
  const end = addDays(start, days - 1);
  return { ok: true, start, end };
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export function yearBounds(date: Date): { start: Date; end: Date } {
  const y = date.getUTCFullYear();
  return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y, 11, 31, 23, 59, 59)) };
}

export function monthBounds(date: Date): { start: Date; end: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59)) };
}

/** Saldo anual de vacaciones: semanas asignadas × 7 − días ya pedidos (pendientes + aprobados) en el año. */
export function vacationBalance(weeksPerYear: number, usedDays: number): { totalDays: number; usedDays: number; leftDays: number } {
  const totalDays = weeksPerYear * 7;
  return { totalDays, usedDays, leftDays: Math.max(0, totalDays - usedDays) };
}

type LeaveDb = PrismaClient | Prisma.TransactionClient;

export type VacationApprovableParams = {
  userId: string;
  category: Category;
  startDate: Date;
  endDate: Date;
  days: number;
  vacationWeeksPerYear: number;
  /** Estados que cuentan contra el saldo anual: creación usa PENDING+APPROVED, aprobación usa solo APPROVED. */
  balanceStatuses: ("PENDING" | "APPROVED")[];
  /** Excluir esta solicitud propia del cómputo de saldo (p. ej. la que se está aprobando). */
  excludeLeaveId?: string;
};

/**
 * Revalida las dos reglas de negocio de vacaciones (usadas tanto al crear como al aprobar
 * una solicitud, para que ambos caminos apliquen exactamente la misma lógica):
 *  1. Saldo anual: vacationWeeksPerYear*7 − días ya contabilizados del año ≥ days pedidos.
 *  2. Cupo semanal: máximo un chofer y un ayudante de vacaciones APPROVED por semana/categoría.
 */
export async function checkVacationApprovable(
  db: LeaveDb,
  params: VacationApprovableParams
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, category, startDate, endDate, days, vacationWeeksPerYear, balanceStatuses, excludeLeaveId } = params;

  const { start: yStart, end: yEnd } = yearBounds(startDate);
  const yearLeaves = await db.leaveRequest.findMany({
    where: {
      userId,
      type: "VACATION",
      status: { in: balanceStatuses },
      startDate: { gte: yStart, lte: yEnd },
      ...(excludeLeaveId ? { id: { not: excludeLeaveId } } : {}),
    },
    select: { days: true },
  });
  const used = yearLeaves.reduce((a, l) => a + l.days, 0);
  const balance = vacationBalance(vacationWeeksPerYear, used);
  if (days > balance.leftDays) {
    return { ok: false, error: `No te alcanza el saldo anual de vacaciones: te quedan ${balance.leftDays} día(s) de ${balance.totalDays}` };
  }

  const categoryOverlap = await db.leaveRequest.findFirst({
    where: {
      type: "VACATION",
      status: "APPROVED",
      userId: { not: userId },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      user: { profile: { category } },
      ...(excludeLeaveId ? { id: { not: excludeLeaveId } } : {}),
    },
  });
  if (categoryOverlap) {
    const label = category === "DRIVER" ? "chofer" : "ayudante";
    return { ok: false, error: `Ya hay un ${label} de vacaciones en ese período (máximo uno por semana)` };
  }

  return { ok: true };
}
