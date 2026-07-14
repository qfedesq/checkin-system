"use client";

import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";
import "react-day-picker/style.css";
import { useRouter } from "next/navigation";
import { formatCalendarDate, isoToCalendarDate, toCalendarISODate } from "@/lib/utils";

type Availability = {
  myLeaves: { id: string; type: "VACATION" | "DAY_OFF"; startDate: string; endDate: string; status: "PENDING" | "APPROVED" | "REJECTED"; days: number }[];
  takenDayOffs: { date: string; byMe: boolean }[];
  categoryTakenRanges: { from: string; to: string }[];
  vacation: { weeksPerYear: number; totalDays: number; usedDays: number; leftDays: number };
  myDayOffMonths: string[];
};

export function CalendarClient() {
  const router = useRouter();
  const [tab, setTab] = useState<"VACATION" | "DAY_OFF">("VACATION");
  const [selected, setSelected] = useState<Date | undefined>();
  const [duration, setDuration] = useState<7 | 14>(7);
  const [data, setData] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [myLeavesFilter, setMyLeavesFilter] = useState<"ALL" | "VACATION" | "DAY_OFF">("ALL");

  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    fetch(`/api/calendar/availability?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((r) => r.json())
      .then(setData);
  }, [msg]);

  const leftDays = data?.vacation.leftDays ?? 0;
  const canRequestVacation = leftDays >= 7;

  // Fin del rango de vacaciones (inicio lunes + duración - 1 = domingo).
  const vacationEndISO = useMemo(() => {
    if (!selected) return "";
    const end = new Date(selected);
    end.setDate(end.getDate() + duration - 1);
    return toCalendarISODate(end);
  }, [selected, duration]);

  // Si no le queda saldo para 14 días, forzamos la duración a 7.
  useEffect(() => {
    if (leftDays < 14 && duration === 14) setDuration(7);
  }, [leftDays, duration]);

  const disabledDays = useMemo(() => {
    if (!data) return [];
    if (tab === "VACATION") {
      // Sólo lunes, futuro, y sin cupo tomado por otro de mi categoría en la semana solicitada
      const categoryRanges = data.categoryTakenRanges.map((r) => ({ from: isoToCalendarDate(r.from), to: isoToCalendarDate(r.to) }));
      return [
        { before: new Date() },
        (d: Date) => {
          if (d.getDay() !== 1) return true;
          const end = new Date(d);
          end.setDate(end.getDate() + duration - 1);
          return categoryRanges.some((r) => d <= r.to && r.from <= end);
        },
      ];
    }
    // Franco: deshabilitar fechas con franco aprobado por otros y meses donde ya tengo uno
    const takenByOthers = data.takenDayOffs.filter((t) => !t.byMe).map((t) => isoToCalendarDate(t.date));
    return [
      { before: new Date() },
      (d: Date) => data.myDayOffMonths.includes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`),
      ...takenByOthers,
    ];
  }, [tab, data, duration]);

  const mineByRange = useMemo(() => {
    if (!data) return [];
    return data.myLeaves.map((l) => ({ from: isoToCalendarDate(l.startDate), to: isoToCalendarDate(l.endDate), status: l.status }));
  }, [data]);

  const filteredMyLeaves = useMemo(() => {
    if (!data) return [];
    if (myLeavesFilter === "ALL") return data.myLeaves;
    return data.myLeaves.filter((l) => l.type === myLeavesFilter);
  }, [data, myLeavesFilter]);

  async function submit() {
    if (!selected) return setMsg({ kind: "err", text: "Elegí una fecha" });
    setBusy(true);
    setMsg(null);
    const iso = toCalendarISODate(selected);
    const body: { type: "VACATION" | "DAY_OFF"; startDate: string; days?: number } = { type: tab, startDate: iso };
    if (tab === "VACATION") body.days = duration;
    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: out.error ?? "Error" });
    setMsg({ kind: "ok", text: "Solicitud enviada" });
    setSelected(undefined);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <section className="panel p-6">
        <div className="mb-4 flex items-center gap-2">
          <button aria-pressed={tab === "VACATION"} className={tab === "VACATION" ? "btn-primary" : "btn-ghost"} onClick={() => { setTab("VACATION"); setSelected(undefined); setMsg(null); }}>Vacaciones</button>
          <button aria-pressed={tab === "DAY_OFF"} className={tab === "DAY_OFF" ? "btn-primary" : "btn-ghost"} onClick={() => { setTab("DAY_OFF"); setSelected(undefined); setMsg(null); }}>Franco</button>
        </div>

        {data && tab === "VACATION" && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${canRequestVacation ? "border-border/60 bg-secondary/40" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
            {canRequestVacation ? (
              <>
                Saldo anual: <strong>{data.vacation.leftDays}</strong> de {data.vacation.totalDays} días disponibles
                {data.vacation.usedDays > 0 ? ` (${data.vacation.usedDays} ya pedidos)` : ""}.
                <span className="text-muted-foreground"> Las semanas con otro compañero de tu categoría de vacaciones aparecen deshabilitadas.</span>
              </>
            ) : (
              <>No te queda saldo de vacaciones este año ({data.vacation.leftDays} de {data.vacation.totalDays} días). Consultá con el administrador.</>
            )}
          </div>
        )}
        {data && tab === "DAY_OFF" && (
          <div className="mb-4 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm">
            Podés pedir <strong>un franco por mes</strong>. Los meses donde ya tenés uno aparecen deshabilitados.
          </div>
        )}

        <DayPicker
          mode="single"
          locale={es}
          weekStartsOn={0}
          selected={selected}
          onSelect={setSelected}
          disabled={disabledDays as never}
          modifiers={{
            mineApproved: mineByRange.filter((m) => m.status === "APPROVED").map((m) => ({ from: m.from, to: m.to })),
            minePending: mineByRange.filter((m) => m.status === "PENDING").map((m) => ({ from: m.from, to: m.to })),
            takenByOthers: data?.takenDayOffs.filter((t) => !t.byMe).map((t) => isoToCalendarDate(t.date)) ?? [],
          }}
          modifiersClassNames={{
            mineApproved: "cal-day-approved",
            minePending: "cal-day-pending",
            takenByOthers: "cal-day-taken-others",
            selected: "cal-day-selected",
          }}
          styles={{
            caption: { color: "hsl(var(--foreground))" },
            head_cell: { color: "hsl(var(--muted-foreground))", fontSize: 11, textTransform: "uppercase" },
            day: { color: "hsl(var(--foreground))" },
          }}
        />

        {tab === "VACATION" && canRequestVacation && (
          <div className="mt-4 flex items-center gap-2">
            <span className="eyebrow">Duración</span>
            <button aria-pressed={duration === 7} className={duration === 7 ? "btn-primary" : "btn-ghost"} onClick={() => setDuration(7)}>7 días</button>
            {leftDays >= 14 && (
              <button aria-pressed={duration === 14} className={duration === 14 ? "btn-primary" : "btn-ghost"} onClick={() => setDuration(14)}>14 días</button>
            )}
          </div>
        )}

        {selected && (
          <p className="mt-4 text-sm text-muted-foreground">
            {tab === "VACATION" ? (
              <>Vas a pedir del <strong className="text-foreground">lunes {formatCalendarDate(toCalendarISODate(selected))}</strong> al <strong className="text-foreground">domingo {formatCalendarDate(vacationEndISO)}</strong> ({duration} días de corrido).</>
            ) : (
              <>Vas a pedir un franco el <strong className="text-foreground">{formatCalendarDate(toCalendarISODate(selected))}</strong>.</>
            )}
          </p>
        )}

        {msg && (
          <div className={`mt-4 rounded-xl border px-4 py-2 text-sm ${msg.kind === "ok" ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{msg.text}</div>
        )}

        <div className="mt-5 flex justify-end">
          <button className="btn-primary" onClick={submit} disabled={busy || !selected || (tab === "VACATION" && !canRequestVacation)}>
            {busy ? "Enviando…" : tab === "VACATION" ? "Solicitar vacaciones" : "Solicitar franco"}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <Legend color="hsl(142 60% 40% / 0.6)" label="Mis días aprobados" />
          <Legend color="hsl(43 96% 50% / 0.7)" label="Mis solicitudes pendientes" />
          <Legend color="hsl(0 75% 55% / 0.55)" label="Francos de otros empleados (no disponibles)" />
          <Legend color="hsl(var(--primary))" label="Selección actual" />
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Mis solicitudes</h2>
        <div className="mt-3 flex items-center gap-2">
          <button aria-pressed={myLeavesFilter === "ALL"} className={myLeavesFilter === "ALL" ? "btn-primary" : "btn-ghost"} onClick={() => setMyLeavesFilter("ALL")}>Todas</button>
          <button aria-pressed={myLeavesFilter === "VACATION"} className={myLeavesFilter === "VACATION" ? "btn-primary" : "btn-ghost"} onClick={() => setMyLeavesFilter("VACATION")}>Vacaciones</button>
          <button aria-pressed={myLeavesFilter === "DAY_OFF"} className={myLeavesFilter === "DAY_OFF" ? "btn-primary" : "btn-ghost"} onClick={() => setMyLeavesFilter("DAY_OFF")}>Francos</button>
        </div>
        <ul className="mt-4 space-y-3">
          {filteredMyLeaves.length === 0 && <li className="text-sm text-muted-foreground">Sin solicitudes.</li>}
          {filteredMyLeaves.map((l) => (
            <li key={l.id} className="surface-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{l.type === "VACATION" ? `Vacaciones · ${l.days}d` : "Franco"}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCalendarDate(l.startDate)}{l.days > 1 ? ` → ${formatCalendarDate(l.endDate)}` : ""}
                  </div>
                </div>
                {l.status === "PENDING" && <span className="badge-warning">pendiente</span>}
                {l.status === "APPROVED" && <span className="badge-success">aprobado</span>}
                {l.status === "REJECTED" && <span className="badge-danger">rechazado</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded" style={{ background: color }} />
      {label}
    </div>
  );
}
