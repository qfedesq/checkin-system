"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { DonutChart } from "@/components/ui/DonutChart";
import { Modal } from "@/components/ui/Modal";

type Segment = { value: number; color: string; label: string };
type Person = { name: string; detail?: string; attendanceId?: string };
export type TodayCard = {
  title: string;
  centerLabel: string;
  segments: Segment[];
  listTitle: string;
  people: Person[];
  emptyText: string;
};

function nowLocalInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Las tres tarjetas del panel (check-in / check-out / ausentes) son clickeables: al tocarlas
// abren un modal con el listado de empleados de esa categoría. En "Jornada en curso" cada
// empleado trae el id de su jornada abierta, así el admin puede hacerle el check-out ahí mismo
// (por si se olvidó de fichar la salida), eligiendo la hora real.
export function TodayCards({ cards }: { cards: TodayCard[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [coId, setCoId] = useState<string | null>(null); // jornada en modo "elegir hora de salida"
  const [coVal, setCoVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const active = open !== null ? cards[open] : null;

  function startCheckout(id: string) {
    setErr(null);
    setCoVal(nowLocalInput());
    setCoId(id);
  }

  async function confirmCheckout(id: string) {
    setBusy(true);
    setErr(null);
    try {
      // coVal es hora local del navegador (ART); toISOString la pasa a UTC para el server.
      const res = await fetch(`/api/admin/attendance/${id}/close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(coVal ? { checkOutAt: new Date(coVal).toISOString() } : {}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo registrar la salida");
      }
      setCoId(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo registrar la salida");
    } finally {
      setBusy(false);
    }
  }

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
        <Modal onClose={() => { setOpen(null); setCoId(null); setErr(null); }} labelledBy="today-list-title">
          <h3 id="today-list-title" className="text-lg font-semibold">{active.listTitle}</h3>
          {active.people.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{active.emptyText}</p>
          ) : (
            <ul className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
              {active.people.map((p, i) => (
                <li key={i} className="surface-card flex flex-col gap-2 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{p.name}</span>
                    {p.detail && <span className="text-xs text-muted-foreground">{p.detail}</span>}
                  </div>
                  {p.attendanceId && (
                    coId === p.attendanceId ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="datetime-local"
                          className="surface-control text-xs"
                          style={{ width: "auto", height: 36 }}
                          value={coVal}
                          max={nowLocalInput()}
                          onChange={(e) => setCoVal(e.target.value)}
                        />
                        <button className="btn-primary text-xs" disabled={busy} onClick={() => confirmCheckout(p.attendanceId!)}>
                          {busy ? "Guardando…" : "Confirmar salida"}
                        </button>
                        <button className="btn-ghost text-xs" disabled={busy} onClick={() => setCoId(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <button className="btn-ghost text-xs self-start" onClick={() => startCheckout(p.attendanceId!)}>Marcar salida</button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
          <div className="mt-5 flex justify-end">
            <button type="button" className="btn-ghost" onClick={() => { setOpen(null); setCoId(null); setErr(null); }}>Cerrar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
