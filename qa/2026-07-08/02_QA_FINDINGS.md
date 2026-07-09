# 02 — QA Findings (consolidado)

Fuente: 8 auditorías (A1–A8) + discovery (D1–D4) + intake. ~140 hallazgos crudos → **58 consolidados** (dedup cross-área) + cobertura CORRECT. Severidad normalizada a BLOCKER/CRITICAL/MAJOR/MINOR/COSMETIC. IDs finales QA-0xx (mías). Los 4 top verificados a mano contra el código.

## Matriz severidad × área (hallazgos accionables)
| Área | BLOCKER | CRITICAL | MAJOR | MINOR | COSMETIC |
|---|---|---|---|---|---|
| functional | 1 | 2 | 6 | 4 | 1 |
| security | — | 2 | 4 | 6 | 1 |
| data-state | (1) | (1) | 4 | 3 | — |
| ux-ui | — | — | 3 | 6 | 2 |
| responsive | — | 1 | — | 4 | — |
| accessibility | — | — | 4 | 4 | 1 |
| performance | — | — | 3 | 4 | — |
| code-quality | — | 1 | 5 | 5 | 2 |

(Los ítems entre paréntesis son la misma raíz contada en su área principal.) **Distribución de veredictos**: MODIFY ~34 · IMPROVE ~24 · CORRECT ~30 (cobertura confirmada).

---

## BLOCKER

### QA-001 — La sesión JWT no refleja cambios de estado/rol; una cuenta deshabilitada sigue operando
- Áreas: functional, security, data-state · Verdict: MODIFY · Confianza: alta (verificado en auth.ts)
- Fusiona: FUN-1, FUN-2, SEC-2, DATA-1.
- Evidencia: `src/lib/auth.ts` (session callback lee el token, nunca revalida DB; `trigger:"update"` solo refresca mustChangePassword/hasWebauthn). `authorize` bloquea DISABLED **sólo en el login nuevo**. `middleware.ts` y `/api/attendance/checkin|checkout` no consultan `User.status`. JWT ~30 días.
- Impacto: deshabilitar manualmente, bajar de rol, rechazar dispositivo o el **bloqueo automático por vencimiento** no surten efecto hasta que expira el token → un empleado bloqueado sigue fichando y accediendo; un ex-admin conserva privilegios.
- Recomendación: revalidar `status` (y rol) contra DB en el middleware / en un helper de sesión para acciones sensibles (check-in/out, endpoints admin), o bajar el maxAge del JWT + forzar refresh. Efort: M.

---

## CRITICAL

### QA-002 — PII sensible en Vercel Blob con `access:"public"`
- Áreas: security, functional, data-state · MODIFY · alta. Fusiona FUN-4, SEC-3.
- Evidencia: `src/lib/blob.ts` sube DNI (frente/dorso), licencia, libreta, **firma** y recibos firmados con `access:"public"`; URL semi-predecible (timestamp + 6 chars). Sin auth en la URL.
- Impacto: filtración de documentación personal y firmas (reutilizables) de todos los empleados con sólo la URL.
- Recomendación: usar Blob privado + URLs firmadas de corta duración servidas tras verificar sesión/ownership; o proxy autenticado. Efort: M/L.

### QA-003 — Clave temporal fija `Emmalva01` sin enforcement de `mustChangePassword` a nivel API
- Áreas: security · MODIFY · alta. Fusiona SEC-1.
- Evidencia: `/api/admin/users` y `reset-password` setean `"Emmalva01"`; `mustChangePassword` sólo se fuerza por redirect del middleware en páginas, no en los endpoints `/api/**`.
- Impacto: entre que el admin crea/resetea la cuenta y el empleado entra, un tercero que conozca el email + "Emmalva01" obtiene sesión y puede llamar APIs (leer PII, etc.). La clave fija fue **decisión de producto** (aceptada); lo accionable es (a) enforcement server-side de mustChangePassword y (b) idealmente clave por-usuario o de un solo uso.
- Recomendación: bloquear endpoints sensibles si `mustChangePassword`; considerar clave aleatoria por usuario. Efort: S/M.

### QA-004 — Cupo semanal de vacaciones no se revalida al aprobar
- Áreas: data-state, functional · MODIFY · alta (verificado en approve route). Fusiona DATA-2.
- Evidencia: `/api/admin/leaves/[id]/approve` valida colisión de DAY_OFF pero **no** revalida el cupo VACATION (1 chofer + 1 ayudante/semana ni el saldo anual). El check sólo existe al crear.
- Impacto: el admin aprueba dos solicitudes PENDING solapadas de la misma categoría → se viola la regla de negocio de forma determinística.
- Recomendación: revalidar cupo/saldo dentro de una transacción al aprobar; rechazar con mensaje. Efort: S/M.

### QA-005 — Check-in con WebAuthn obligatorio sin feature-detection → flujo core roto en el navegador in-app de WhatsApp
- Áreas: responsive, functional · MODIFY · alta. Fusiona RES-1, RES-12.
- Evidencia: `CheckinClient.tsx` exige `navigator.credentials` sin `browserSupportsWebAuthn()` ni mensaje. Los empleados abren el link desde WhatsApp (WKWebView) donde WebAuthn suele no existir.
- Impacto: el empleado no puede fichar y no entiende por qué.
- Recomendación: detectar soporte y, si falta, mostrar "abrí en Safari/Chrome" (o botón para abrir externo). Efort: S.

> Nota: QA-001 y QA-002 tienen facetas BLOCKER en A1/A8; se listan una vez con su severidad máxima.

---

## MAJOR (resumen; detalle completo en los audits/*.md)
- **QA-006** Login de un solo factor: la biometría en `/login` es ceremonia client-side; la cookie se establece con la contraseña sola (auth.ts no incluye WebAuthn). Contradice el "solo ese dispositivo inicia sesión". [security, functional] (FUN-3)
- **QA-007** Aprobar/rechazar leaves y documentos no valida estado PENDING → doble transición / last-write-wins entre dos admins. [functional, data-state, security] (FUN-6, FUN-7, DATA-5, SEC-9)
- **QA-008** Reglas de licencias con check-then-insert sin transacción/constraint → doble submit o concurrencia viola cupos. [data-state, functional] (FUN-5, DATA-3)
- **QA-009** Doble check-in crea dos jornadas abiertas; checkout cierra solo la última y no hay UI admin para reparar la huérfana. [data-state] (DATA-4)
- **QA-010** Dashboard admin calcula "hoy" en hora local del proceso, no America/Argentina → torta de ausentes y conteos desalineados 21:00–00:00 ART. [functional, data-state] (FUN-10, DATA-6)
- **QA-011** Export a Excel: el filtro `to` recorta ~3 h del último día por parseo sin zona horaria. [functional] (FUN-11)
- **QA-012** `AdminDocuments.tsx` no chequea `res.ok` ni maneja errores de red al aprobar/rechazar → fallo silencioso. [ux-ui, functional, code-quality] (UX-1, FUN-7b, CQ-5)
- **QA-013** 37 de 38 route handlers sin `try/catch` → 500 crudos sin logging. [code-quality] (CQ-4)
- **QA-014** Suite de tests en rojo: `tests/leaves.test.ts` usa `getDay()` local vs `getUTCDay()` del código (post-UTC). [code-quality] (CQ-1, FUN-16)
- **QA-015** 34 vulns en deps prod (13 high: next/nodemailer/undici) + 29 desactualizadas, sin CI que las frene. [security, code-quality] (SEC-13, CQ-11)
- **QA-016** Esquema sólo por `prisma db push`, sin migraciones versionadas (sin historial/rollback; ya forzó sentinelas). [code-quality, data-state] (CQ-10, DATA-7)
- **QA-017** Cobertura de tests casi nula (1 archivo, solo leaves). [code-quality] (CQ-9)
- **QA-018** Cron `expiry-check` secuencial sin `maxDuration` ni batching; filtra en JS → riesgo de timeout con SMTP real y más headcount. [performance] (PERF-1)
- **QA-019** Imágenes sin resize/compresión ni `next/image` (thumb 40px carga el blob completo). [performance] (PERF-3)
- **QA-020** Listas admin (documentos/licencias/usuarios) sin paginar con include ancho; tablas insert-only crecen sin fin. [performance] (PERF-2)
- **QA-021** CRON_SECRET falla-abierto si no está seteado; comparación no timing-safe y aceptada por query string. [security] (SEC-4, FUN-14)
- **QA-022** Sin rate limiting/lockout en login, password/change ni webauthn/options. [security] (SEC-6, FUN-15)
- **QA-023** a11y: canvas de firma sin alternativa por teclado ni nombre accesible → bloquea firmar a quien no puede dibujar. [accessibility] (A11Y-1)
- **QA-024** a11y: contraste de `--primary/--accent/--success` como texto en modo claro < 4.5:1 (badges, nav activo, links). [accessibility] (A11Y-2)
- **QA-025** a11y: labels de formulario sin `htmlFor/id` en login, reset y modales admin. [accessibility] (A11Y-3)
- **QA-026** a11y + ux: modales a mano sin `role=dialog`, sin trampa de foco ni cierre con Escape (y reimplementados 4×). [accessibility, ux-ui, code-quality] (A11Y-4, UX-13)
- **QA-027** Acciones admin irreversibles sin confirmación + botones sin `disabled` (doble submit); cancelar el `window.prompt` de motivo igual ejecuta el rechazo. [ux-ui, functional] (UX-2, UX-3, UX-7)

## MINOR (batch; ver audits/*.json)
QA-028 éxito silencioso sin confirmación (UX-4) · QA-029 copy "Error" genérico + "pwd temp" filtrado (UX-5, UX-6) · QA-030 clave temporal en texto plano en toast (UX-12) · QA-031 sin loading/error/not-found ni estado de carga en CalendarClient (UX-8, UX-9) · QA-032 índices faltantes (attendance abierta, leave/doc status) (PERF-4/5/7) · QA-033 counts duplicados admin layout+page (PERF-6) · QA-034 validación de archivos solo por MIME declarado (SEC-5) · QA-035 filename sin sanitizar en key de blob (SEC-7) · QA-036 enumeración de usuarios en webauthn/options (SEC-8) · QA-037 sin headers de seguridad HTTP/CSP (SEC-12) · QA-038 export sin audit log de geolocalización (SEC-10) · QA-039 ProfileChangeRequest sin lock optimista (DATA-8) · QA-040 colisiones de unicidad → 500 sin manejo (DATA-9) · QA-041 admin puede autodeshabilitarse / dejar 0 admins (FUN-13) · QA-042 loop de /reset-password si falla session.update (FUN-9) · QA-043 apertura de recibo no idempotente en concurrencia (FUN-8) · QA-044 ESLint no configurado (CQ-2) · QA-045 dos lockfiles → workspace root mal inferido (CQ-3) · QA-046 ImageSlot ×3 + modal ×3 duplicados (CQ-6, CQ-7, UX-14) · QA-047 lógica de aprobación de perfil duplicada /api/profile vs /api/profile/expiry (CQ-8) · QA-048 push sin detección standalone iOS (RES-2) · QA-049 targets táctiles < 44px (.btn 40, día calendario 36) (RES-4, RES-5) · QA-050 SignaturePad no re-escala en orientationchange (RES-6) · QA-051 manifest sin 192/maskable dedicado (RES-3) · QA-052 a11y varios: aria-pressed/selected, donut sin nombre, reduced-motion, aria-current, aria-label EN (A11Y-5/6/8/9/10) · QA-053 logging no estructurado; auditoría silenciada (CQ-12) · QA-054 flujo PENDING_APPROVAL es código muerto (FUN-12).

## COSMETIC
QA-055 CalendarClient con paleta no tokenizada (UX-10) · QA-056 check-in "Registrando…" genérico para 3 pasos (UX-17) · QA-057 h1 duplicado en manual público (A11Y-7) · QA-058 smells menores: `as never`, scripts fuera de package.json, CLOTHING_SIZES duplicada, eslint-disable inertes, .env.example predecible (CQ-13/14/15/16, SEC-11).

---

## Cobertura CORRECT (lo que está bien — no tocar)
- AuthZ: `requireAdmin()` en todos los `/api/admin/**`; ownership correcto en apertura de recibo; autorregistro deshabilitado (410). (FUN-18/19, SEC-15/16/17)
- WebAuthn: challenge de un solo uso, origin/rpID validados, contador anti-replay, device binding + unicidad. (SEC-14, FUN-20)
- Passwords: bcrypt cost 12; forgot-password informativo sin token. (SEC-19/20)
- Reglas de calendario en `leaves.ts`: UTC-consistentes y completas (post-fix). (FUN-21)
- Perfil: alta directa vs edición con aprobación, sin duplicar solicitudes. (FUN-22)
- TS strict sin escapes; build limpio (37 rutas); Zod consistente. (CQ-17/18/19, FUN-17)
- UX: manejo de errores robusto en ProfileForm (post-fix v0.24), estados vacíos consistentes, theming sin FOUC, voseo genuino, fix de zoom iOS + safe areas. (UX-18..23, RES-8/9/10)
- Perf: exceljs/pdf-lib server-only, firma de PDF cacheada, push/email en paralelo, DonutChart sin librería, fuentes self-hosted. (PERF-8..13)
- Notificaciones: fallo aislado no bloqueante (Promise.allSettled). (SEC-21)
