"use client";

import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";
import "react-day-picker/style.css";
import { isoToCalendarDate } from "@/lib/utils";

type Range = { from: string; to: string; label: string };

// ¿El rango [from,to] toca el mes mostrado (año/mes de `month`)?
function overlapsMonth(from: string, to: string, month: Date) {
  const mStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const mEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return isoToCalendarDate(from) <= mEnd && isoToCalendarDate(to) >= mStart;
}

export function AdminMiniCalendar({ vacations, dayOffs }: { vacations: Range[]; dayOffs: Range[] }) {
  const [month, setMonth] = useState<Date>(() => new Date());

  // La lista de abajo refleja el mes que se está viendo (antes mostraba todo lo cargado,
  // así que al navegar a otro mes seguían apareciendo licencias de meses distintos).
  const monthVacations = useMemo(() => vacations.filter((v) => overlapsMonth(v.from, v.to, month)), [vacations, month]);
  const monthDayOffs = useMemo(() => dayOffs.filter((d) => overlapsMonth(d.from, d.to, month)), [dayOffs, month]);

  return (
    <>
      <DayPicker
        mode="single"
        locale={es}
        weekStartsOn={0}
        month={month}
        onMonthChange={setMonth}
        onSelect={() => {}}
        modifiers={{
          vacations: vacations.map((v) => ({ from: isoToCalendarDate(v.from), to: isoToCalendarDate(v.to) })),
          dayOffs: dayOffs.map((d) => isoToCalendarDate(d.from)),
        }}
        modifiersClassNames={{
          vacations: "cal-day-approved",
          dayOffs: "cal-day-dayoff",
        }}
        styles={{
          caption: { color: "hsl(var(--foreground))" },
          head_cell: { color: "hsl(var(--muted-foreground))", fontSize: 11, textTransform: "uppercase" },
          day: { color: "hsl(var(--foreground))" },
        }}
      />
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded" style={{ background: "hsl(142 72% 45% / 0.4)" }} /> Vacaciones</span>
        <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded" style={{ background: "hsl(199 76% 52% / 0.4)" }} /> Francos</span>
      </div>
      {monthVacations.length > 0 || monthDayOffs.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {monthVacations.map((v, i) => <li key={`v${i}`}>🌴 {v.label}</li>)}
          {monthDayOffs.map((d, i) => <li key={`d${i}`}>• {d.label}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Sin vacaciones ni francos aprobados este mes.</p>
      )}
    </>
  );
}
