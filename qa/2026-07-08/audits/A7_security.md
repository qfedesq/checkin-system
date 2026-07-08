# A7 — Auditoría de seguridad defensiva (OWASP Top 10)

**Proyecto:** Emmalva "Checkin System" · **Fecha:** 2026-07-08 · **Versión analizada:** v0.24
**Método:** report-only, sin exploits. Lectura de todos los route handlers en `src/app/api/**` (37), `src/lib/auth.ts`, `admin-guard.ts`, `webauthn.ts`, `blob.ts`, `pdf-sign.ts`, `email.ts`, `notify.ts`, `audit.ts`, `profile.ts`, `leaves.ts`, `src/middleware.ts`, `prisma/schema.prisma`, `next.config.mjs`, `.env.example`, `vercel.json`; ejecución de `pnpm audit --prod --json`. No se modificó código ni se mutaron datos de producción.

Este documento parte de las pistas de `01_APP_UNDERSTANDING.md` y `qa/2026-07-08/discovery/D1_architecture.md` (JWT sin invalidación, blobs públicos con PII, 13 vulns high) y las verifica/amplía leyendo el código endpoint por endpoint.

---

## Resumen ejecutivo

| Severidad | Cantidad |
|---|---|
| BLOCKER | 1 |
| CRITICAL | 2 |
| MAJOR | 4 |
| MINOR | 6 |
| COSMETIC (incl. 8 hallazgos CORRECT) | 8 |
| **Total** | **21** |

Los 3 hallazgos más graves confirman y profundizan las 2 hipótesis de riesgo #1 y #2 de `01_APP_UNDERSTANDING.md`, y agregan uno nuevo no anticipado (contraseña temporal hardcodeada compartida + no-enforcement server-side de `mustChangePassword`), que es el de mayor impacto real: combina credencial predecible + ausencia de rate-limiting + gating sólo a nivel de UI, dando una ruta de account-takeover completa sobre cualquier cuenta recién creada o recién reseteada por RRHH.

---

## Hallazgos (por severidad)

### BLOCKER

**SEC-1 — Contraseña temporal hardcodeada e idéntica para toda cuenta nueva/reseteada, sin enforcement server-side de `mustChangePassword`**
`TEMP_PASSWORD = "Emmalva01"` (`src/app/api/admin/users/route.ts:18`, `src/app/api/admin/users/[id]/reset-password/route.ts:8`) es la misma constante para **toda** alta y **todo** reset de contraseña — no hay componente aleatorio por usuario. El `middleware.ts:36` sólo redirige a `/reset-password` a nivel de páginas (`!pathname.startsWith("/api/")`); ningún route handler (`attendance/checkin`, `leaves`, `profile`, `documents/upload`, etc.) valida `mustChangePassword` antes de mutar. Resultado: quien conozca/adivine el email de un empleado recién dado de alta o recién reseteado (patrón `nombre.apellido@empresa` es plausible en una logística) puede loguearse con `"Emmalva01"` y operar la cuenta completa —leer/mutar PII, fichar, pedir vacaciones, abrir/firmar recibos— antes de que el empleado real entre, sin límite de intentos (ver SEC-6).
*Recomendación:* contraseñas temporales aleatorias por usuario con expiración corta; enforzar `mustChangePassword` también en la capa de API, no sólo en el middleware de páginas.

### CRITICAL

**SEC-2 — Sesión JWT stateless: deshabilitar cuenta / bajar rol / rechazar dispositivo no revoca el token activo**
`session:{strategy:"jwt"}` sin `maxAge` propio (default Auth.js ≈30 días) y sin sesiones DB-backed (`src/lib/auth.ts`). Todo el gating del `middleware.ts` lee `req.auth` (claims del JWT), nunca la DB. `admin/users/[id]/disable` y `.../reject-device` mutan sólo la DB — no existe mecanismo de invalidación de sesión. Un empleado desvinculado/bloqueado sigue con un token `status:"ACTIVE"` válido y puede seguir usando cualquier endpoint que sólo chequee `session?.user` (leaves, profile, documents/upload) hasta por 30 días o hasta que se fuerce un `trigger:"update"`. `attendance/checkin` sí revalida `deviceApprovedAt` contra DB pero no revalida `status`.
*Recomendación:* bajar `maxAge`, o migrar a sesiones DB-backed (el adapter `@auth/prisma-adapter` ya está en dependencias) para revocar de inmediato.

**SEC-3 — PII sensible en Vercel Blob con `access:"public"`, sin autenticación en la URL**
DNI frente/dorso, carnet de conducir, libreta sanitaria, foto de cara, firma manuscrita y recibos de sueldo se suben con `access:"public"` (`src/lib/blob.ts:6-10`) y se referencian en `EmployeeProfile.*BlobUrl` (`prisma/schema.prisma:161-167`). No hay proxy de descarga autenticado — quien obtenga la URL (que puede filtrarse por logs, `Referer`, historial de navegador, capturas) accede al archivo sin sesión. La key (`kind/${Date.now()}-${random6}-${filename}`) tiene entropía moderada, no criptográfica.
*Recomendación:* `access:"private"` + route handler autenticado con validación de ownership/rol antes de servir (patrón ya existente en `deliveries/[id]/open`).

### MAJOR

**SEC-4 — CRON_SECRET falla abierto si la env var no está seteada**
`if (process.env.CRON_SECRET && secret !== ...)` en `cron/checkout-reminder` y `cron/expiry-check`: si la variable no está definida, el chequeo se omite completo y el cron queda abierto a cualquier GET anónimo. También acepta el secreto por query string (`?key=`, riesgo de logging) y compara con `!==` (no timing-safe).

**SEC-5 — Validación de uploads basada sólo en MIME type declarado por el cliente**
Todos los endpoints de upload (`documents/upload`, `profile/uploads`, `admin/employees/[id]/uploads`, `uploads/signature`, `admin/deliveries/upload`) validan `file.type` (controlable por el atacante), sin verificar bytes reales (magic numbers). Ese mismo valor se reenvía como `contentType` al blob público (SEC-3).

**SEC-6 — Sin rate limiting / lockout en login, password/change ni WebAuthn options**
No hay ninguna lógica de throttle/lockout en el repo. Combinado con SEC-1, habilita fuerza bruta práctica contra el login con la contraseña temporal conocida.

**SEC-13 — 34 vulnerabilidades en dependencias de producción (0 critical / 13 high / 16 moderate / 5 low)**
Confirmado ejecutando `pnpm audit --prod --json` en esta auditoría (coincide exactamente con D1). Concentradas en `next` y `nodemailer` (directas, con fix vía bump de versión) y `undici`/`tmp` (transitivas). Sin gate de CI que las bloquee.

### MINOR

- **SEC-7** — Nombre de archivo del cliente sin sanitizar en la key de blob (`src/lib/blob.ts:5`).
- **SEC-8** — Enumeración de usuarios vía `/api/webauthn/authenticate/options` (404 uniforme para inexistente/inactivo vs. 200 diferenciado para activo con/sin credenciales).
- **SEC-9** — `admin/leaves/[id]/approve|reject` y `admin/documents/[id]/approve|reject` no validan el estado actual antes de transicionar (a diferencia de `profile-changes`, que sí lo hace).
- **SEC-10** — Export de Excel de asistencia expone geolocalización cruda sin dejar registro de auditoría de la exportación misma.
- **SEC-11** — Secretos de ejemplo predecibles en `.env.example` (`AUTH_SECRET`, `CRON_SECRET`, `SEED_ADMIN_PASSWORD`).
- **SEC-12** — Sin headers de seguridad HTTP (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy) en `next.config.mjs`.

### CORRECT (bien resuelto)

- **SEC-14** — WebAuthn: challenge de un solo uso con expiración, `origin`/`rpID` validados, `userVerification` requerido, contador anti-replay, device binding por hash SHA-256 del `credentialId`.
- **SEC-15** — `requireAdmin()` presente en los 17 route handlers bajo `/api/admin/**`, más defensa en profundidad en `src/app/admin/layout.tsx`.
- **SEC-16** — Ownership check correcto en `/api/deliveries/[id]/open`: no se puede abrir/firmar el recibo de otro usuario.
- **SEC-17** — Autorregistro deshabilitado (410), reduce superficie de ataque.
- **SEC-18** — Validación con zod (`safeParse` + 400 genérico) en la mayoría de endpoints mutantes.
- **SEC-19** — bcrypt cost factor 12 consistente en todo hashing de contraseñas.
- **SEC-20** — Flujo de "olvidé mi contraseña" es informativo (sin token self-service), evitando toda la clase de bugs de reset-token leakage/poisoning.
- **SEC-21** — Notificaciones (email/push) aisladas con `Promise.allSettled`/`.catch`, nunca bloquean ni revierten la operación principal.

---

## Detalle por área de la consigna

**AuthZ por endpoint:** de los 37 route handlers, los 17 bajo `/api/admin/**` usan `requireAdmin()` sin excepción. Los endpoints de empleado (`attendance/*`, `leaves`, `profile*`, `documents/upload`, `uploads/signature`, `push/subscribe`) validan `session?.user` pero, salvo `attendance/checkin` (que sí chequea `deviceApprovedAt` fresco vía DB), ninguno revalida `status` contra DB (ver SEC-2). Ownership en rutas `[id]`: `deliveries/[id]/open` está correcto (SEC-16); `admin/*/[id]/*` no necesitan ownership de empleado porque ya exigen rol ADMIN — no se encontró ningún caso donde un empleado pueda aprobar/abrir un recurso de otro empleado.

**Sesión JWT stateless:** ver SEC-2. No hay revalidación contra DB salvo en `attendance/checkin` (parcial).

**PII pública:** ver SEC-3. Export Excel con geolocalización: ver SEC-10 (acceso correctamente admin-only, pero sin auditoría de la exportación).

**Secretos:** contraseña temporal hardcodeada en código (SEC-1); placeholders predecibles en `.env.example` (SEC-11); no se encontraron secretos reales commiteados ni expuestos en variables `NEXT_PUBLIC_*` (sólo `NEXT_PUBLIC_APP_VERSION` y `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, ambos no sensibles por diseño — la VAPID pública es pública por definición del protocolo Web Push). No se encontraron `console.log`/`console.error` que impriman contraseñas, tokens o cuerpos de archivo; los logs de notify/email/push sólo incluyen metadatos (userId, endpoint truncado).

**Validación de input / inyección:** zod presente en la mayoría (SEC-18); uploads validan tipo/tamaño pero sólo por MIME declarado (SEC-5); no se encontró SSRF explotable por input de usuario (los `fetch()` a blobs en `pdf-sign`/`deliveries/open` sólo leen URLs generadas por el propio sistema, no URLs arbitrarias de usuario); path traversal en keys de blob: ver SEC-7 (bajo impacto real, dado que no es un filesystem).

**CRON_SECRET:** ver SEC-4 (fail-open si no está seteada, comparación no timing-safe, aceptación por query string).

**Dependencias:** `pnpm audit --prod` → **34 vulnerabilidades: 0 critical, 13 high, 16 moderate, 5 low**. Libs: `next` (directa, high: DoS Server Components, bypass Middleware/Proxy y Pages i18n, SSRF vía WebSocket upgrade, DoS Cache Components), `nodemailer` (directa, high: DoS por recursión en addressparser, SSRF/arbitrary file read vía `raw` bypasseando `disableFileAccess`/`disableUrlAccess`), `undici` (transitiva de `@vercel/blob`, high: DoS por decompression chain, WebSocket unbounded memory/exception, DoS fragment count), `tmp` (transitiva, high: path traversal vía prefix/postfix). Ver SEC-13.

**WebAuthn:** ver SEC-14 (CORRECT) y SEC-8 (enumeración vía options, MINOR).

---

## Recomendaciones priorizadas

1. **Inmediato:** eliminar la contraseña temporal hardcodeada compartida (SEC-1) — generar una por usuario, aleatoria, de vida corta, y enforzar `mustChangePassword` también en la API.
2. **Corto plazo:** blobs de PII a `access:"private"` con servido autenticado (SEC-3); `CRON_SECRET` fail-closed (SEC-4); rate-limiting en login/password/webauthn (SEC-6); actualizar `next`/`nodemailer` (SEC-13).
3. **Mediano plazo:** revisar estrategia de sesión (maxAge corto o DB-backed) para que revocar/deshabilitar tenga efecto inmediato (SEC-2); magic-byte validation en uploads (SEC-5); guards de estado en leaves/documents approve-reject (SEC-9); headers de seguridad HTTP (SEC-12).

---

## Archivos de salida

- `qa/2026-07-08/audits/A7_security.md` (este documento)
- `qa/2026-07-08/audits/A7_security.findings.json` (21 hallazgos estructurados: 13 defectos + 8 CORRECT)
