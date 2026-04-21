export function isMonday(date: Date): boolean {
  return date.getDay() === 1;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function atMidnightUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseLocalDate(input: string): Date | null {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

export function validateVacationRange(startISO: string, days: 7 | 14): { ok: true; start: Date; end: Date } | { ok: false; error: string } {
  const local = parseLocalDate(startISO);
  if (!local) return { ok: false, error: "Fecha inicial inválida" };
  if (local.getDay() !== 1) return { ok: false, error: "Las vacaciones deben comenzar un lunes" };
  if (days !== 7 && days !== 14) return { ok: false, error: "Las vacaciones son de 7 o 14 días" };
  const end = addDays(local, days - 1);
  return { ok: true, start: local, end };
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
