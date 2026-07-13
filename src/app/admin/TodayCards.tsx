"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { DonutChart } from "@/components/ui/DonutChart";
import { Modal } from "@/components/ui/Modal";

type Segment = { value: number; color: string; label: string };
type Person = { name: string; detail?: string };
export type TodayCard = {
  title: string;
  centerLabel: string;
  segments: Segment[];
  listTitle: string;
  people: Person[];
  emptyText: string;
};

// Las tres tarjetas del panel (check-in / check-out / ausentes) son clickeables: al tocarlas
// abren un modal con el listado de empleados de esa categoría.
export function TodayCards({ cards }: { cards: TodayCard[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const active = open !== null ? cards[open] : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {cards.map((c, i) => (
        <button
          key={c.title}
          type="button"
          onClick={() => setOpen(i)}
          className="panel p-5 text-left transition hover:border-primary/30"
          aria-label={`${c.title}: ver empleados`}
        >
          <div className="flex items-center justify-between">
            <h2 className="eyebrow">{c.title}</h2>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-3">
            <DonutChart centerLabel={c.centerLabel} segments={c.segments} />
          </div>
          <span className="mt-3 inline-block text-xs font-semibold text-[hsl(var(--primary-text))]">Ver empleados →</span>
        </button>
      ))}

      {active && (
        <Modal onClose={() => setOpen(null)} labelledBy="today-list-title">
          <h3 id="today-list-title" className="text-lg font-semibold">{active.listTitle}</h3>
          {active.people.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{active.emptyText}</p>
          ) : (
            <ul className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
              {active.people.map((p, i) => (
                <li key={i} className="surface-card flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="font-medium">{p.name}</span>
                  {p.detail && <span className="text-xs text-muted-foreground">{p.detail}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex justify-end">
            <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
