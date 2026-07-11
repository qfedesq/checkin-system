import test from "node:test";
import assert from "node:assert/strict";
import { distanceMeters } from "../src/lib/geo";

test("distanceMeters devuelve 0 para el mismo punto", () => {
  assert.equal(distanceMeters(-34.6037, -58.3816, -34.6037, -58.3816), 0);
});

test("distanceMeters aproxima ~111km por grado de latitud en el ecuador", () => {
  const d = distanceMeters(0, 0, 1, 0);
  assert.ok(Math.abs(d - 111195) < 200, `esperado ~111195m, obtuvo ${d}`);
});

test("distanceMeters es simétrica", () => {
  const a = distanceMeters(-34.6037, -58.3816, -34.6, -58.38);
  const b = distanceMeters(-34.6, -58.38, -34.6037, -58.3816);
  assert.equal(a, b);
});

test("distanceMeters detecta una distancia corta dentro de un radio típico (~100m)", () => {
  // ~0.0009 grados de latitud equivalen a ~100m
  const d = distanceMeters(-34.6037, -58.3816, -34.6037 + 0.0009, -58.3816);
  assert.ok(d > 90 && d < 110, `esperado ~100m, obtuvo ${d}`);
});
