"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

type Range = { from: string; to: string; label: string };

export function AdminMiniCalendar({ vacations, dayOffs }: { vacations: Range[]; dayOffs: Range[] }) {
  return (
    <>
      <DayPicker
        mode="single"
        weekStartsOn={0}
        onSelect={() => {}}
        modifiers={{
          vacations: vacations.map((v) => ({ from: new Date(v.from), to: new Date(v.to) })),
          dayOffs: dayOffs.map((d) => new Date(d.from)),
        }}
        modifiersStyles={{
          vacations: { background: "hsl(142 72% 45% / 0.25)", color: "hsl(142 72% 55%)", borderRadius: 10 },
          dayOffs: { background: "hsl(199 76% 52% / 0.25)", color: "hsl(199 76% 60%)", borderRadius: 10 },
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
      {(vacations.length > 0 || dayOffs.length > 0) && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {vacations.map((v, i) => <li key={`v${i}`}>🌴 {v.label}</li>)}
          {dayOffs.map((d, i) => <li key={`d${i}`}>• {d.label}</li>)}
        </ul>
      )}
    </>
  );
}
