import test from "node:test";
import assert from "node:assert/strict";
import { validateVacationRange, isMonday, addDays } from "../src/lib/leaves";

test("isMonday reconoce lunes", () => {
  assert.equal(isMonday(new Date(2026, 3, 20)), true); // 20 abr 2026 es lunes
  assert.equal(isMonday(new Date(2026, 3, 21)), false);
});

test("validateVacationRange: lunes + 7 días", () => {
  const r = validateVacationRange("2026-04-20", 7);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.start.getDay(), 1);
    assert.equal(r.end.getDate(), 26);
  }
});

test("validateVacationRange: martes rechazado", () => {
  const r = validateVacationRange("2026-04-21", 7);
  assert.equal(r.ok, false);
});

test("validateVacationRange: duración inválida rechazada", () => {
  const r = validateVacationRange("2026-04-20", 10 as 7);
  assert.equal(r.ok, false);
});

test("addDays 14", () => {
  const d = addDays(new Date(2026, 3, 20), 13);
  assert.equal(d.getDate(), 3);
  assert.equal(d.getMonth(), 4); // mayo
});
