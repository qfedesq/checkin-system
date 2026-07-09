# 05 — Final Report (QA full audit)

Branch `qa/full-audit-2026-07-08` (sin push, sin deploy). Regresión final: **13/13 tests · lint sin errores · build exit 0**.

## Resumen ejecutivo
- Auditoría: 4 discovery + 8 audit agents (Sonnet 5) → **58 findings consolidados** (1 BLOCKER, 4 CRITICAL, 22 MAJOR, ~26 MINOR, ~5 COSMETIC) + ~30 CORRECT.
- Remediación: **Ola 1 (BLOCKER+CRITICAL) y Ola 2 (MAJOR) COMPLETAS**. Ola 3 (MINOR/COSMETIC) pendiente. 15 commits `qa(...)`.

## Antes / Después (findings accionables)
| ID | Sev | Antes | Estado |
|---|---|---|---|
| QA-001 | BLOCKER | sesión JWT no reflejaba deshabilitar/rol | ✅ FIXED (requireActiveUser revalida DB) |
| QA-002 | CRITICAL | PII en blob público | ✅ FIXED (proxy token HMAC; URL nunca al cliente) |
| QA-003 | CRITICAL | mustChangePassword sin enforce API | ✅ FIXED |
| QA-004 | CRITICAL | cupo vacaciones no revalidado al aprobar | ✅ FIXED (tx) |
| QA-005 | CRITICAL | check-in roto en WhatsApp | ✅ FIXED (guard WebAuthn) |
| QA-006 | MAJOR | copy falso device-binding | ✅ FIXED (copy honesto) |
| QA-007 | MAJOR | approve/reject sin guard PENDING | ✅ FIXED |
| QA-008 | MAJOR | doble check-in | ✅ FIXED (tx Serializable + índice único parcial en migración) |
| QA-010 | MAJOR | "hoy" en TZ del proceso | ✅ FIXED (ART) |
| QA-011 | MAJOR | export recorta último día | ✅ FIXED (ART) |
| QA-012 | MAJOR | AdminDocuments sin res.ok | ✅ FIXED (WS-9/10 + wrapper) |
| QA-013 | MAJOR | 37/38 handlers sin try/catch | ✅ FIXED (route() wrapper) |
| QA-014 | MAJOR | suite de tests en rojo | ✅ FIXED |
| QA-015 | MAJOR | 34 vulns deps | ⚠️ PARCIAL (next 15.5.20 → 34→20; nodemailer/undici/uuid requieren majors, documentado) |
| QA-016 | MAJOR | sin migraciones versionadas | ✅ FIXED (baseline + runbook; aplicar en deploy) |
| QA-017 | MAJOR | cobertura casi nula | ✅ PARCIAL (file-token + leaves; cobertura sigue acotada) |
| QA-018 | MAJOR | cron secuencial sin maxDuration | ✅ FIXED (batching + maxDuration) |
| QA-019 | MAJOR | imágenes sin optimizar | ✅ PARCIAL (lazy/decoding; resize real requiere image service) |
| QA-020 | MAJOR | listas admin sin límite | ✅ PARCIAL (take:100; paginación real pendiente) |
| QA-021 | MAJOR | CRON_SECRET fail-open | ✅ FIXED (fail-closed + timing-safe) |
| QA-022 | MAJOR | sin rate-limit | ✅ PARCIAL (best-effort; robusto requiere Upstash) |
| QA-023..026, 052 | MAJOR | accesibilidad | ✅ FIXED (Modal, labels, contraste, aria, firma alternativa) |
| QA-027 | MAJOR | acciones sin confirmación/doble submit | ✅ FIXED |
| QA-028,029,030 | MINOR | feedback/copy/clave temporal | ✅ FIXED |
| QA-032 | MINOR | índices faltantes | ✅ FIXED (en migración) |

## Riesgos residuales / acciones de deploy (esta branch NO está deployada)
1. **QA-002**: los assets ya subidos como públicos siguen accesibles por su URL vieja; los nuevos van por proxy. Para cerrar del todo habría que rotar/re-subir los blobs existentes.
2. **QA-016/032/QA-008-index**: aplicar en prod el baseline (`prisma migrate resolve --applied 0_init`) + `prisma migrate deploy` ANTES de mergear; hoy prod usa `db push`. El índice único parcial del race de check-in vive sólo ahí.
3. **QA-001**: +1 query DB por request sensible (costo aceptado por la revalidación).
4. **QA-015**: nodemailer/undici(@vercel/blob)/uuid(exceljs) requieren bumps major → planificar aparte.
5. **QA-022**: rate-limit es best-effort en serverless; robusto = Upstash/Redis.
6. GMAIL_APP_PASSWORD sigue sin setear en Vercel (emails en stub).

## Ola 3 (MINOR/COSMETIC) — pendiente
QA-031 (loading/error boundaries), QA-033 (counts duplicados admin), QA-034 (magic bytes de archivos), QA-035 (sanitizar filename en blob key), QA-036 (enumeración webauthn — ya mitigada parcial por rate-limit), QA-037 (headers/CSP), QA-038 (audit log del export), QA-039 (lock optimista ProfileChangeRequest), QA-040 (colisión de unicidad → 409 en vez de 500), QA-041 (auto-deshabilitar/último admin), QA-042 (loop reset-password), QA-043 (idempotencia apertura de recibo), QA-046 (dedup ImageSlot/lógica de perfil), QA-048 (push standalone iOS), QA-049 (targets 44px), QA-050 (canvas resize), QA-051 (manifest 192/maskable), QA-054 (código muerto PENDING_APPROVAL), QA-055/056/057/058 (cosméticos/smells), + QA-015/017/019/020 (profundizar).

## Convenciones para CLAUDE.md (aprendidas en la remediación)
- Endpoints sensibles: usar `requireActiveUser()` / `requireAdmin()` (revalidan estado contra DB; el JWT no se revoca solo).
- Todo handler `/api/**` se envuelve con `route("scope", fn)` (try/catch + logging + 500 uniforme).
- Cualquier blob mostrado al cliente pasa por `fileUrl()` → `/api/files` (nunca exponer la URL cruda del blob).
- Fechas: `formatCalendarDate` (UTC) para fechas-calendario; `formatDate`/`formatDateTime` (TZ Argentina) para timestamps.
- Reglas de vacaciones: única fuente `checkVacationApprovable()` (creación y aprobación).
- Esquema: de acá en más migraciones versionadas (`migrate deploy`), no `db push`.
