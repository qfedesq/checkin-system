# 04 — Remediation Log

Branch `qa/full-audit-2026-07-08` (sin push). Fixers en Sonnet 5, review + commit por workstream a cargo del orquestador.

## Ola 1 (BLOCKER + CRITICAL) — COMPLETA (con 1 decisión pendiente)

| WS | Findings | Estado | Commit | Verificación |
|---|---|---|---|---|
| WS-1a | QA-001 (BLOCKER), QA-003 (CRITICAL) | ✅ FIXED | `ada5532` | build OK; tests 5/5 |
| — | QA-014 (test roto, hygiene) | ✅ FIXED | `5466453` | tests 5/5 verde |
| WS-4a | QA-005 (CRITICAL) | ✅ FIXED | `af93471` | build OK |
| WS-3a | QA-004 (CRITICAL) | ✅ FIXED | `2c34b53` | tests 9/9; build OK |
| WS-2 | QA-002 (CRITICAL) | 🟡 PARCIAL | `34855e6` | build OK |

### Detalle
- **QA-001/QA-003** — `requireActiveUser()` revalida status/role/mustChangePassword contra DB en cada request sensible; `requireAdmin()` lo compone (17 endpoints admin cubiertos); layouts (app)/admin revalidan y redirigen; checkin/checkout gateados. La cuenta deshabilitada (manual o por cron de vencimiento) y las bajas de rol ahora surten efecto en la próxima request.
- **QA-005** — `browserSupportsWebAuthn()` en CheckinClient; sin soporte (in-app WhatsApp) se deshabilita fichar con aviso claro.
- **QA-004** — `checkVacationApprovable()` compartido; approve revalida cupo+saldo en `$transaction`; +4 tests.
- **QA-002 (PARCIAL)** — Limitación de plataforma: `@vercel/blob` 1.1.1 sólo soporta `access:"public"` (no existe blob privado). Se aplicó `addRandomSuffix:true` (URL ya no adivinable). **El fix completo requiere decisión de arquitectura** (ver más abajo). Residual: la URL sigue siendo pública-por-token y se expone al cliente en `<img src>`.

### QA-002 — opciones para el fix completo (pendiente de decisión)
- **A (recomendada, mitigación pragmática)**: proxy autenticado `/api/files/[ref]` que verifica sesión/ownership y **streamea los bytes**; el cliente nunca recibe la URL del blob. Residual: el blob sigue público-por-token si la URL se filtra server-side. Esfuerzo L (uploads + todos los `<img>`/links + pdf-sign).
- **B (privacidad real)**: migrar a S3/R2 con URLs firmadas privadas + migrar los assets ya subidos. Esfuerzo XL.
- **C**: aceptar la mitigación actual (addRandomSuffix) y revisitar. Sin esfuerzo extra.

### Regresión Ola 1
`pnpm test` 9/9 · `pnpm build` exit 0. Sin regresiones. Cambios quirúrgicos, no se tocaron flujos fuera de alcance.

## Ola 2 (MAJOR) — PENDIENTE de GO
WS-1b, WS-3b, WS-5, WS-6, WS-7, WS-8, WS-9, WS-10, WS-11a.

## Ola 3 (MINOR + COSMETIC) — PENDIENTE
