import test from "node:test";
import assert from "node:assert/strict";
import { validateVacationRange, validateDayOffRange, MAX_DAY_OFF_DAYS, isMonday, addDays, checkVacationApprovable } from "../src/lib/leaves";

// Doble en memoria de las dos únicas queries que usa checkVacationApprovable, para poder
// probar la regla de negocio (saldo anual + cupo semanal por categoría) sin una DB real.
type FakeLeave = {
  id: string;
  userId: string;
  category: "DRIVER" | "HELPER";
  status: "PENDING" | "APPROVED";
  startDate: Date;
  endDate: Date;
  days: number;
};

function fakeDb(leaves: FakeLeave[]) {
  return {
    leaveRequest: {
      async findMany(args: any) {
        const w = args.where;
        return leaves
          .filter(
            (l) =>
              l.userId === w.userId &&
              w.status.in.includes(l.status) &&
              l.startDate.getTime() >= w.startDate.gte.getTime() &&
              l.startDate.getTime() <= w.startDate.lte.getTime() &&
              (!w.id || l.id !== w.id.not)
          )
          .map((l) => ({ days: l.days }));
      },
      async findFirst(args: any) {
        const w = args.where;
        return (
          leaves.find(
            (l) =>
              l.status === "APPROVED" &&
              l.userId !== w.userId.not &&
              l.startDate.getTime() <= w.startDate.lte.getTime() &&
              l.endDate.getTime() >= w.endDate.gte.getTime() &&
              l.category === w.user.profile.category &&
              (!w.id || l.id !== w.id.not)
          ) ?? null
        );
      },
    },
  };
}

test("isMonday reconoce lunes", () => {
  assert.equal(isMonday(new Date(2026, 3, 20)), true); // 20 abr 2026 es lunes
  assert.equal(isMonday(new Date(2026, 3, 21)), false);
});

// Lunes futuro fijo (respecto a cualquier "hoy" real de test run): valida el caso feliz sin
// pisar la nueva regla de "no puede ser en el pasado".
test("validateVacationRange: lunes + 7 días", () => {
  const r = validateVacationRange("2026-08-03", 7);
  assert.equal(r.ok, true);
  if (r.ok) {
    // leaves.ts maneja fechas-calendario en UTC (getUTCDay), así que el test debe leerlas en UTC.
    assert.equal(r.start.getUTCDay(), 1);
    assert.equal(r.end.getUTCDate(), 9);
  }
});

test("validateVacationRange: martes rechazado", () => {
  const r = validateVacationRange("2026-08-04", 7);
  assert.equal(r.ok, false);
});

test("validateVacationRange: duración inválida rechazada", () => {
  const r = validateVacationRange("2026-08-03", 10 as 7);
  assert.equal(r.ok, false);
});

test("validateVacationRange: fecha de inicio en el pasado rechazada", () => {
  const r = validateVacationRange("2020-01-06", 7); // 2020-01-06 es lunes, pero muy en el pasado
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /no puede ser en el pasado/);
});

test("validateDayOffRange: un día (caso base)", () => {
  const r = validateDayOffRange("2026-08-03", 1);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.days, 1);
    assert.equal(r.start.getTime(), r.end.getTime());
  }
});

test("validateDayOffRange: varios días corridos (fin = inicio + días - 1)", () => {
  const r = validateDayOffRange("2026-08-03", 3);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.days, 3);
    assert.equal(r.start.getUTCDate(), 3);
    assert.equal(r.end.getUTCDate(), 5); // 3,4,5 = 3 días
  }
});

test("validateDayOffRange: 0 días rechazado", () => {
  const r = validateDayOffRange("2026-08-03", 0);
  assert.equal(r.ok, false);
});

test("validateDayOffRange: más del máximo rechazado", () => {
  const r = validateDayOffRange("2026-08-03", MAX_DAY_OFF_DAYS + 1);
  assert.equal(r.ok, false);
});

test("validateDayOffRange: fecha de inicio en el pasado rechazada", () => {
  const r = validateDayOffRange("2020-01-06", 2);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /no puede ser en el pasado/);
});

test("addDays 14", () => {
  const d = addDays(new Date(2026, 3, 20), 13);
  assert.equal(d.getDate(), 3);
  assert.equal(d.getMonth(), 4); // mayo
});

test("checkVacationApprovable: rechaza por cupo semanal (misma categoría, APPROVED solapada)", async () => {
  // QA-004: al aprobar, otro chofer ya tiene vacaciones APPROVED que solapan la misma semana.
  const db = fakeDb([
    {
      id: "other",
      userId: "user-B",
      category: "DRIVER",
      status: "APPROVED",
      startDate: new Date(Date.UTC(2026, 3, 20)),
      endDate: new Date(Date.UTC(2026, 3, 26)),
      days: 7,
    },
  ]);

  const result = await checkVacationApprovable(db as any, {
    userId: "user-A",
    category: "DRIVER",
    startDate: new Date(Date.UTC(2026, 3, 20)),
    endDate: new Date(Date.UTC(2026, 3, 26)),
    days: 7,
    vacationWeeksPerYear: 2,
    balanceStatuses: ["APPROVED"],
    excludeLeaveId: "req-A",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /máximo uno por semana/);
});

test("checkVacationApprovable: permite cuando la solapada es de otra categoría", async () => {
  const db = fakeDb([
    {
      id: "other",
      userId: "user-B",
      category: "HELPER",
      status: "APPROVED",
      startDate: new Date(Date.UTC(2026, 3, 20)),
      endDate: new Date(Date.UTC(2026, 3, 26)),
      days: 7,
    },
  ]);

  const result = await checkVacationApprovable(db as any, {
    userId: "user-A",
    category: "DRIVER",
    startDate: new Date(Date.UTC(2026, 3, 20)),
    endDate: new Date(Date.UTC(2026, 3, 26)),
    days: 7,
    vacationWeeksPerYear: 2,
    balanceStatuses: ["APPROVED"],
    excludeLeaveId: "req-A",
  });

  assert.equal(result.ok, true);
});

test("checkVacationApprovable: rechaza por saldo anual insuficiente", async () => {
  // vacationWeeksPerYear=2 → 14 días de saldo; ya usó 10 aprobados este año, pide 7 más.
  const db = fakeDb([
    {
      id: "used",
      userId: "user-A",
      category: "DRIVER",
      status: "APPROVED",
      startDate: new Date(Date.UTC(2026, 0, 6)),
      endDate: new Date(Date.UTC(2026, 0, 15)),
      days: 10,
    },
  ]);

  const result = await checkVacationApprovable(db as any, {
    userId: "user-A",
    category: "DRIVER",
    startDate: new Date(Date.UTC(2026, 3, 20)),
    endDate: new Date(Date.UTC(2026, 3, 26)),
    days: 7,
    vacationWeeksPerYear: 2,
    balanceStatuses: ["APPROVED"],
    excludeLeaveId: "req-A",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /saldo anual/);
});

test("checkVacationApprovable: aprueba cuando no hay conflicto de cupo ni de saldo", async () => {
  const db = fakeDb([]);

  const result = await checkVacationApprovable(db as any, {
    userId: "user-A",
    category: "DRIVER",
    startDate: new Date(Date.UTC(2026, 3, 20)),
    endDate: new Date(Date.UTC(2026, 3, 26)),
    days: 7,
    vacationWeeksPerYear: 2,
    balanceStatuses: ["APPROVED"],
    excludeLeaveId: "req-A",
  });

  assert.equal(result.ok, true);
});
