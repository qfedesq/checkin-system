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

export function validateVacationRange(startISO: string, days: 7 | 14): { ok: true; start: Date; end: Date } | { ok: false; error: string } {
  const start = parseLocalDate(startISO);
  if (!start) return { ok: false, error: "Fecha inicial inválida" };
  if (start.getUTCDay() !== 1) return { ok: false, error: "Las vacaciones deben comenzar un lunes" };
  if (days !== 7 && days !== 14) return { ok: false, error: "Las vacaciones son de 7 o 14 días" };
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
