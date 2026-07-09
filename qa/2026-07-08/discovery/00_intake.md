# QA Intake — Emmalva Checkin System (2026-07-08)

## Config resuelta
- APP_NAME: Emmalva (Checkin System) — webapp RRHH
- REPO_PATH: /Users/qfedesq/Checkin System · branch QA: `qa/full-audit-2026-07-08`
- RUN_COMMAND: `pnpm dev` (⚠ requiere DATABASE_URL + AUTH_SECRET; no corre limpio local). Prod: https://checkin-system-beta.vercel.app (auth-gated)
- BUILD: `pnpm build` (OK)
- TEST_COMMAND: `pnpm test` (node --test tests/*.test.ts) → **1 test FALLA**
- LINT_COMMAND: `next lint` → **no configurado** (interactivo/deprecado, sin eslint config)
- AUTO_FIX: false → detenerse tras Fase 4 y esperar GO
- MAX_PARALLEL_AGENTS: 4 · subagentes en claude-sonnet-5

## Capacidades detectadas
- Build: ✅
- Test runner: ✅ node:test (1 suite: tests/leaves.test.ts) — **rojo**
- Lint: ❌ ESLint no configurado
- Playwright / browser MCP dedicado: ❌ (hay preview MCP pero necesita dev server con DB)
- CI: ❌ (sin .github/workflows)
- Método de auditoría dominante: **análisis estático** + build + test + trazado de flujos por código. Hallazgos dinámicos → confidence media/baja.

## Hallazgos de intake (finding zero)
- **INTAKE-1 (MAJOR, code-quality)**: suite de tests en rojo. `tests/leaves.test.ts:14` verifica `start.getDay() === 1` (día local) pero desde v0.19 `validateVacationRange` usa `getUTCDay()` (fechas en UTC). El test quedó desactualizado → `expected 1, actual 0` en TZ negativa. Fix: usar `getUTCDay()` en el test.
- **INTAKE-2 (MINOR, code-quality)**: `next lint` no está configurado (sin ESLint). No hay linting automatizado.
- **INTAKE-3 (MINOR, code-quality)**: dos lockfiles (`/Users/qfedesq/package-lock.json` + repo `pnpm-lock.yaml`) → Next infiere mal el workspace root. Setear `outputFileTracingRoot` o remover el lockfile ajeno.

## Contexto de dominio (para scoping)
- Usuarios: **admin** (RRHH, desktop) + **empleados** (mobile, PWA).
- Flujos críticos: login+biometría (WebAuthn, device binding+aprobación), check-in/out con geoloc, perfil con aprobación de cambios, calendario vacaciones/francos (reglas de saldo/cupo/mensual), documentación (libreta/carnet frente+dorso), recibos/notificaciones con firma automática (pdf-lib), alta de usuarios (clave Emmalva01), crons (vencimientos+bloqueo, recordatorio check-out).
- Nota deploy: emails en modo stub (falta GMAIL_APP_PASSWORD en Vercel); solo push activo.
