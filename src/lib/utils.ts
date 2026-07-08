import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = "America/Argentina/Buenos_Aires";

/** Para TIMESTAMPS (check-in, createdAt, etc.): siempre en hora de Argentina,
 *  consistente entre render de servidor (UTC) y de cliente. */
export function formatDate(d: Date | string | null | undefined, fmt: "short" | "long" = "short") {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  if (fmt === "long") {
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", timeZone: TZ });
  }
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
}

/** Para FECHAS-CALENDARIO (vacaciones, francos, vencimientos, nacimiento): se guardan
 *  como medianoche UTC del día elegido, así que se muestran en UTC para no correrse
 *  un día en zonas horarias con offset negativo (Argentina UTC-3). */
export function formatCalendarDate(d: Date | string | null | undefined, fmt: "short" | "long" = "short") {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  if (fmt === "long") {
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  }
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** Convierte una fecha-calendario (medianoche UTC) al Date local equivalente para
 *  que react-day-picker (que renderiza por componentes locales) muestre el día correcto. */
export function isoToCalendarDate(d: Date | string): Date {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Fecha-calendario (Date local que el usuario ve) → string YYYY-MM-DD para enviar/guardar. */
export function toCalendarISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function minutesToHhmm(min: number | null | undefined) {
  if (!min || min < 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
