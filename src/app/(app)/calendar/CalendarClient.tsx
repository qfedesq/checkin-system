"use client";

import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

type Availability = {
  myLeaves: { id: string; type: "VACATION" | "DAY_OFF"; startDate: string; endDate: string; status: "PENDING" | "APPROVED" | "REJECTED"; days: number }[];
  takenDayOffs: { date: string; byMe: boolean }[];
};

export function CalendarClient() {
  const router = useRouter();
  const [tab, setTab] = useState<"VACATION" | "DAY_OFF">("VACATION");
  const [selected, setSelected] = useState<Date | undefined>();
  const [duration, setDuration] = useState<7 | 14>(7);
  const [data, setData] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    fetch(`/api/calendar/availability?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((r) => r.json())
      .then(setData);
  }, [msg]);

  const disabledDays = useMemo(() => {
    if (!data) return [];
    if (tab === "VACATION") {
      return [{ before: new Date() }, (d: Date) => d.getDay() !== 1];
    }
    // Franco: deshabilitar fechas con franco aprobado por otros
    const takenByOthers = data.takenDayOffs.filter((t) => !t.byMe).map((t) => new Date(t.date));
    return [{ before: new Date() }, ...takenByOthers];
  }, [tab, data]);

  const mineByRange = useMemo(() => {
    if (!data) return [];
    return data.myLeaves.map((l) => ({ from: new Date(l.startDate), to: new Date(l.endDate), status: l.status }));
  }, [data]);

  async function submit() {
    if (!selected) return setMsg({ kind: "err", text: "Elegí una fecha" });
    setBusy(true);
    setMsg(null);
    const iso = selected.toISOString();
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
          <button className={tab === "VACATION" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("VACATION")}>Vacaciones</button>
          <button className={tab === "DAY_OFF" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("DAY_OFF")}>Franco</button>
        </div>

        <DayPicker
          mode="single"
          weekStartsOn={1}
          selected={selected}
          onSelect={setSelected}
          disabled={disabledDays as never}
          modifiers={{
            mineApproved: mineByRange.filter((m) => m.status === "APPROVED").map((m) => ({ from: m.from, to: m.to })),
            minePending: mineByRange.filter((m) => m.status === "PENDING").map((m) => ({ from: m.from, to: m.to })),
            takenByOthers: data?.takenDayOffs.filter((t) => !t.byMe).map((t) => new Date(t.date)) ?? [],
          }}
          modifiersStyles={{
            mineApproved: { background: "hsl(142 72% 45% / 0.25)", color: "hsl(142 72% 65%)", borderRadius: 10 },
            minePending: { background: "hsl(19 95% 53% / 0.2)", color: "hsl(19 95% 60%)", borderRadius: 10 },
            takenByOthers: { background: "hsl(1 79% 64% / 0.2)", color: "hsl(1 79% 75%)", borderRadius: 10 },
            selected: { background: "hsl(19 95% 53%)", color: "#fff", borderRadius: 10 },
          }}
          styles={{
            caption: { color: "hsl(var(--foreground))" },
            head_cell: { color: "hsl(var(--muted-foreground))", fontSize: 11, textTransform: "uppercase" },
            day: { color: "hsl(var(--foreground))" },
          }}
        />

        {tab === "VACATION" && (
          <div className="mt-4 flex items-center gap-2">
            <span className="eyebrow">Duración</span>
            <button className={duration === 7 ? "btn-primary" : "btn-ghost"} onClick={() => setDuration(7)}>7 días</button>
            <button className={duration === 14 ? "btn-primary" : "btn-ghost"} onClick={() => setDuration(14)}>14 días</button>
          </div>
        )}

        {msg && (
          <div className={`mt-4 rounded-xl border px-4 py-2 text-sm ${msg.kind === "ok" ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{msg.text}</div>
        )}

        <div className="mt-5 flex justify-end">
          <button className="btn-primary" onClick={submit} disabled={busy || !selected}>
            {busy ? "Enviando…" : tab === "VACATION" ? "Solicitar vacaciones" : "Solicitar franco"}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <Legend color="hsl(142 72% 45% / 0.35)" label="Mis días aprobados" />
          <Legend color="hsl(19 95% 53% / 0.3)" label="Mis solicitudes pendientes" />
          <Legend color="hsl(1 79% 64% / 0.25)" label="Francos de otros empleados (no disponibles)" />
          <Legend color="hsl(19 95% 53%)" label="Selección actual" />
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Mis solicitudes</h2>
        <ul className="mt-4 space-y-3">
          {data?.myLeaves.length === 0 && <li className="text-sm text-muted-foreground">Sin solicitudes.</li>}
          {data?.myLeaves.map((l) => (
            <li key={l.id} className="surface-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{l.type === "VACATION" ? `Vacaciones · ${l.days}d` : "Franco"}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(l.startDate)}{l.days > 1 ? ` → ${formatDate(l.endDate)}` : ""}
                  </div>
                </div>
                {l.status === "PENDING" && <span className="badge-accent">pendiente</span>}
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
