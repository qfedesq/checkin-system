# D1 — Architecture Mapper (Discovery, report-only)

**Proyecto:** Emmalva "Checkin System" — webapp RRHH
**Fecha:** 2026-07-08 · **Versión analizada:** v0.24 (package.json)
**Método:** lectura de estructura de carpetas, `prisma/schema.prisma`, `src/app`, `src/lib`, `src/middleware.ts`, `package.json`, `vercel.json`, `.env.example`; `pnpm outdated` y `pnpm audit --prod --json`. Sin modificaciones al código.

---

## 1. Stack & versiones

| Capa | Tecnología | Versión instalada (lockfile) | Última disponible |
|---|---|---|---|
| Framework | Next.js (App Router) | 15.5.15 | 16.2.10 |
| UI | React / React DOM | 19.2.5 | 19.2.7 |
| Lenguaje | TypeScript | 5.9.3 | 6.0.3 |
| ORM | Prisma / @prisma/client | 6.19.3 | 7.8.0 |
| DB | Neon Postgres (vía `DATABASE_URL`) | — | — |
| Auth | next-auth (Auth.js v5 beta) | 5.0.0-beta.25 | — (sigue en beta) |
| Biometría | @simplewebauthn/server, /browser | 13.3.0 / 13.1.0 (browser) | 13.3.2 |
| Storage | @vercel/blob | 1.1.1 | 2.5.0 |
| Email | nodemailer (SMTP Gmail) + resend (fallback) | 6.10.1 / 4.8.0 | 9.0.3 / 6.17.1 |
| PDF | pdf-lib | 1.17.1 | — |
| Export | exceljs | 4.4.0 | — |
| Calendario UI | react-day-picker | 9.14.0 | 10.0.1 |
| Push | web-push | 3.6.7 | — |
| Validación | zod | 3.25.76 | 4.4.3 |
| Estilos | Tailwind CSS | 3.4.19 | 4.3.2 |
| Runtime pkg manager | pnpm | 10.32.1 | — |
| Hosting | Vercel (checkin-system-beta.vercel.app) + Vercel Cron | — | — |

Auth.js sigue en **beta** (5.0.0-beta.25) en producción — riesgo de breaking changes en updates menores.

---

## 2. Mapa de módulos

```
src/
├── app/
│   ├── (app)/            → área autenticada empleado: checkin, calendar, dashboard, documents, inbox, profile
│   ├── admin/             → área ADMIN: attendance, deliveries, documents, employees, leaves, profile-changes, users
│   ├── api/               → route handlers (ver sección 3)
│   ├── login, register, forgot-password, reset-password, pending, setup-biometrics
│   ├── help/              → admin, employee, faq, intro (contenido MDX)
│   └── changelog/
├── components/
│   ├── brand/  layout/  providers/  ui/
├── content/manual/        → contenido MDX del manual de usuario
├── lib/                    → módulos de dominio/infra (ver abajo)
└── middleware.ts           → gate de auth/estado a nivel de toda la app
```

**`src/lib/` (13 módulos, todos `server-only`):**
- `auth.ts` — configuración NextAuth (Credentials + JWT callbacks, tipado de sesión extendido)
- `admin-guard.ts` — helper `requireAdmin()` para route handlers
- `webauthn.ts` — RP config + hash de credentialId (device binding)
- `blob.ts` — wrapper de `@vercel/blob` `put()` (uploads)
- `pdf-sign.ts` — firma de PDFs con pdf-lib (hash SHA-256 + sello + firma manuscrita)
- `email.ts` — driver de email con fallback en cascada: SMTP Gmail → Resend → stub (console.log)
- `notify.ts` — orquesta notificaciones a admins/empleados (email + push, `Promise.allSettled`)
- `push.ts` — Web Push (VAPID)
- `audit.ts` — `recordAudit()` → tabla `AuditLog`
- `leaves.ts`, `profile.ts`, `utils.ts` — lógica de dominio (cálculo de días de licencia, perfil, helpers varios)
- `prisma.ts` — singleton de PrismaClient

**Prisma schema** (14 modelos): `User`, `EmployeeProfile`, `WebAuthnCredential`, `WebAuthnChallenge`, `PushSubscription`, `ProfileChangeRequest`, `LeaveRequest`, `DocumentUpload`, `DeliveredDocument`, `Attendance`, `AuditLog` + enums (`Role`, `AccountStatus`, `Category`, `LeaveType/Status`, `DocType/Status`, `DeliveredDocType`, `DisableReason`, `ChangeRequestStatus`).

---

## 3. Entry points

- **UI (App Router)**: `src/app/(app)/*` (empleado autenticado), `src/app/admin/*` (rol ADMIN), páginas públicas (`login`, `register`, `forgot-password`, `reset-password`, `pending`, `setup-biometrics`, `help/*`, `changelog`).
- **API — 37 route handlers** bajo `src/app/api/`, agrupados en:
  - **Auth**: `auth/[...nextauth]`, `register`, `password/change`, `webauthn/{authenticate,register}/{options,verify}`
  - **Attendance**: `attendance/{checkin,checkout,export}`
  - **Admin**: `admin/{deliveries,documents,employees,leaves,profile-changes,users}/**` (aprobaciones, altas/bajas, device approve/reject/reset)
  - **Perfil/documentación**: `profile`, `profile/expiry`, `profile/uploads`, `documents/upload`, `uploads/signature`
  - **Leaves/calendar**: `leaves`, `calendar/availability`
  - **Deliveries**: `deliveries/[id]/open`
  - **Push**: `push/subscribe`
  - **Cron** (públicos, autenticados por `CRON_SECRET`, no por sesión): `cron/expiry-check`, `cron/checkout-reminder`
- **Middleware** (`src/middleware.ts`): único gate global de autenticación/estado — corre en casi todas las rutas salvo `PUBLIC_PATHS` (`/login`, `/forgot-password`, `/api/auth`, `/api/cron`) y assets.
- **Scripts** (`scripts/`): `add-admin.ts`, `add-test-user.ts`, `backfill-device-approval.mjs`, `bump-app-version.mjs`, `sync-changelog.mjs` — ejecución manual/CI, no expuestos como HTTP.
- **Vercel Cron** (`vercel.json`): `expiry-check` diario (09:00) y `checkout-reminder` cada 15 min.

---

## 4. Flujo de datos

1. **Alta de usuario**: `register` → `User` (`PENDING_APPROVAL`) → notifica admins (`notifyAdmins`) → admin aprueba en `admin/users` (`approve` route) → estado `ACTIVE`.
2. **Login**: Credentials provider (`auth.ts`) valida email+bcrypt contra `User.passwordHash` → JWT con `role/status/mustChangePassword/hasWebauthn` embebido en el token/sesión (sin round-trip a DB en cada request, salvo `trigger:"update"`).
3. **Gating post-login** (`middleware.ts`, orden secuencial): sin sesión → `/login`; `PENDING_APPROVAL` → `/pending`; `mustChangePassword` → `/reset-password`; `ACTIVE` sin WebAuthn → `/setup-biometrics`; `/admin/*` sin rol ADMIN → `/dashboard`.
4. **Biometría / device binding**: `webauthn/register/{options,verify}` crea `WebAuthnCredential` ligado a `User.deviceId` (hash del credentialId); requiere aprobación de admin (`deviceApprovedAt`) antes de habilitar check-in. `webauthn/authenticate/*` verifica en cada fichaje.
5. **Check-in/out** (`attendance/checkin`, `.../checkout`): valida sesión + `deviceApprovedAt`, geolocalización (`lat/lng` recibida del cliente **sin verificación de geofence server-side**), crea/cierra fila en `Attendance`; cron `checkout-reminder` notifica si queda una jornada abierta.
6. **Documentación**: `documents/upload` / `profile/uploads` sube a Vercel Blob (`blob.ts`, `access: "public"`) y crea `DocumentUpload`/campos en `EmployeeProfile` (DNI, licencia, carnet de salud, foto, firma) → cola de revisión admin (`admin/documents/[id]/approve|reject`) → notificación.
7. **Vencimientos**: cron `expiry-check` recorre `EmployeeProfile.professionalLicenseExpiry` / `healthCardExpiry` y `DocumentUpload.expiresAt`, envía recordatorios (`notify.ts` → email + push) y puede deshabilitar cuentas (`DisableReason.EXPIRED_*`).
8. **Entregas (payslips/docs)**: admin sube original a `admin/deliveries/upload` → `pdf-sign.ts` firma con hash SHA-256 + metadata + firma manuscrita → `DeliveredDocument` → empleado abre en `inbox` (`deliveries/[id]/open` marca `openedAt`).
9. **Licencias**: empleado crea `LeaveRequest` (`leaves`) → notifica admins → admin aprueba/rechaza (`admin/leaves/[id]/approve|reject`) → notifica empleado; `calendar/availability` agrega vista consolidada.
10. **Cambios de perfil**: empleado propone cambios (`profile` PATCH → `ProfileChangeRequest.changes` como `Json`) → admin aprueba/rechaza → aplica al `EmployeeProfile` real.
11. **Auditoría**: casi toda mutación relevante llama `recordAudit()` → tabla `AuditLog` (actor, acción, subjectId, metadata JSON).
12. **Export**: `attendance/export` genera Excel (`exceljs`) de jornadas para admin.

---

## 5. Servicios externos / APIs

| Servicio | Uso | Config |
|---|---|---|
| **Neon Postgres** | DB primaria vía Prisma | `DATABASE_URL` (+ variables Neon/Vercel Postgres inyectadas: `POSTGRES_*`, `PG*`) |
| **Vercel Blob** | Almacenamiento de uploads (DNI, licencia, carnet salud, foto, firma, docs entregados) — **`access: "public"`** | `BLOB_READ_WRITE_TOKEN` |
| **Gmail SMTP** (nodemailer) | Canal primario de email | `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| **Resend** | Fallback de email si no hay Gmail configurado | `RESEND_API_KEY`, `RESEND_FROM` |
| **Web Push (VAPID)** | Notificaciones push a PWA | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| **WebAuthn / FIDO2** (@simplewebauthn) | Biometría + device binding | `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `AUTH_URL` (origin) |
| **Vercel Cron** | Jobs programados (`expiry-check`, `checkout-reminder`) | `CRON_SECRET` (bearer, valida requests entrantes) |
| **Vercel (hosting/deploy)** | Runtime, envs `VERCEL_*` inyectadas automáticamente | — |

Sin fallback si falla tanto Gmail como Resend: cae a **stub** (solo `console.log`, no se envía nada) — confirma lo ya registrado en memoria del proyecto (emails en stub pendientes de `GMAIL_APP_PASSWORD` en algún momento del deploy).

---

## 6. Estado / sesión

- **Estrategia**: JWT (Auth.js v5, `session: { strategy: "jwt" }`), sin sesiones en DB (el adapter `@auth/prisma-adapter` está en dependencias pero la config activa usa Credentials + JWT puro, no session DB-backed).
- **Contenido del token**: `id, role, status, mustChangePassword, hasWebauthn` — se fija en login y se puede refrescar puntualmente vía `trigger: "update"` (usado tras cambiar password o registrar WebAuthn) sin releer todo de DB.
- **Riesgo de statelessness**: cambios de `role`/`status` hechos por un admin (ej. deshabilitar cuenta, cambiar rol) **no se reflejan hasta que el JWT expira o se fuerza un `update`** — una cuenta recién deshabilitada puede seguir "activa" en el cliente hasta que el middleware la intercepte en el próximo request que dependa de datos frescos (el middleware lee `req.auth`, que es el JWT, no la DB).
- **Gate de estado global**: enteramente en `middleware.ts` (stateless, basado en claims del JWT), con reglas secuenciales (pending → reset password → setup biometría → admin-only).
- **Device binding**: estado adicional fuera de la sesión estándar — `User.deviceId` + `deviceApprovedAt` en DB, chequeado en cada `attendance/checkin` vía query a Prisma (no vive en el JWT).
- **Sin CSRF explícito custom** más allá de lo que provee Auth.js; no hay rate-limiting visible en route handlers sensibles (login, register, password/change).

---

## 7. Build & deploy

- **Build**: `next build` (Next 15, App Router, MDX habilitado vía `@next/mdx`, `pageExtensions: ["ts","tsx","mdx"]`).
- **Postinstall**: `prisma generate` automático (`postinstall` script) — garantiza cliente actualizado en cada `pnpm install` (incluido en CI/Vercel build).
- **DB migrations**: proyecto usa `prisma db push` (`db:push` script), **no `prisma migrate`** — no hay carpeta de migraciones versionadas; esquema se sincroniza directo. Riesgo: sin historial de migraciones para rollback/audit del esquema en producción.
- **Seed**: `db:seed` → `prisma/seed.ts` (crea admin inicial vía `SEED_ADMIN_EMAIL/PASSWORD`).
- **Versionado**: `version:bump` (sube +0.01 en package.json) + `sync:changelog` (regenera `CHANGELOG.md` desde `src/content/changelog.mdx`) — workflow manual documentado en memoria del proyecto (trunk-based, cada cambio bump + changelog + manual).
- **Deploy target**: Vercel (`checkin-system-beta.vercel.app`), `.vercel/` presente (proyecto linkeado). `vercel.json` solo define los 2 crons; no hay config de regions/functions custom.
- **Body size**: `experimental.serverActions.bodySizeLimit: "10mb"` — relevante para uploads de imágenes/PDFs vía Server Actions.
- **PWA**: `public/manifest.webmanifest` + `public/sw.js` (service worker manual, no plugin) + iconos (`icon-512.png`, `apple-touch-icon.png`).
- **CI**: existe `.github/` pero sin workflows `.yml` detectados (carpeta vacía o sin pipelines de CI configurados) — no hay gate automático de lint/test/audit antes de merge a `main` (el propio workflow del equipo es merge directo a `main`, ver memoria del proyecto).
- **Tests**: `pnpm test` → `node --import tsx --test tests/*.test.ts` (una sola carpeta `tests/`, alcance acotado a utilidades, no hay tests de integración de API ni e2e).

---

## 8. Env vars

**Documentadas en `.env.example`:**
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

**Usadas en código pero ausentes de `.env.example`** (gap de documentación):
`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM_NAME` (driver de email primario — pieza central del sistema de notificaciones no está documentada para nuevos setups), `NEW_ADMIN_EMAIL/FIRSTNAME/LASTNAME/PASSWORD`, `NEW_USER_EMAIL/PASSWORD/FORCE_RESET` (scripts `add-admin.ts`/`add-test-user.ts`), `NODE_ENV`.

**Inyectadas automáticamente por la plataforma** (Neon/Vercel, no requieren acción manual): `POSTGRES_*`, `PG*`, `NEON_PROJECT_ID`, `VERCEL_*`, `TURBO_*`, `NX_DAEMON`.

**Riesgo puntual**: `SEED_ADMIN_PASSWORD` en `.env.example` trae un valor de ejemplo predecible (`Admin123!Change`) — si algún entorno real quedó con ese valor sin cambiar, es una credencial de admin por defecto conocida públicamente en el repo.

---

## 9. Salud de dependencias

### `pnpm outdated` — 27 paquetes desactualizados (ninguno bloqueado por rango semver, todos requieren bump manual de mayor/minor)

Destacados con salto de **major**:
- `next` 15.5.15 → **16.2.10**
- `@prisma/client` / `prisma` 6.19.3 → **7.8.0**
- `@next/mdx` / `eslint-config-next` 15.5.15 → **16.2.10**
- `bcryptjs` 2.4.3 → **3.0.3**
- `@vercel/blob` 1.1.1 → **2.5.0**
- `resend` 4.8.0 → **6.17.1**
- `zod` 3.25.76 → **4.4.3**
- `react-day-picker` 9.14.0 → **10.0.1**
- `tailwindcss` 3.4.19 → **4.3.2**
- `typescript` 5.9.3 → **6.0.3**
- `eslint` 9.39.4 → **10.6.0**
- `nodemailer` 6.10.1 → **9.0.3**
- `lucide-react` 0.511.0 → **1.23.0**
- `dotenv` 16.6.1 → **17.4.2**

El resto son bumps menores/patch (`react`, `react-dom`, `date-fns`, `tailwind-merge`, `@simplewebauthn/server`, `postcss`, `autoprefixer`, `@types/*`, `tsx`).

### `pnpm audit --prod` — **34 vulnerabilidades**: 0 critical, **13 high**, **16 moderate**, 5 low

Por paquete (todas transitivas o directas de dependencias de producción):

| Paquete | Vía | Severidades |
|---|---|---|
| **next** | directa | múltiples high (DoS por Server Components, bypass de Middleware/Proxy en App Router y Pages Router i18n, SSRF vía WebSocket upgrades, DoS por connection exhaustion en Cache Components) + moderate (XSS con CSP nonces/beforeInteractive scripts, cache poisoning, DoS en Image Optimization) + low (cache poisoning en redirects) |
| **nodemailer** | directa | high (DoS en addressparser por recursión; SSRF/arbitrary file read vía opción `raw` con `disableFileAccess`/`disableUrlAccess` bypass) + moderate (SMTP command injection CRLF en EHLO/HELO y en headers `List-*`, email a dominio no intencionado, bypass de `disableFileAccess`/`disableUrlAccess` en jsonTransport, TLS cert validation en OAuth2) + low (SMTP command injection vía `envelope.size`) |
| **undici** | transitiva de `@vercel/blob` | high (DoS por decompression chain, WebSocket unbounded memory, WebSocket exception handling, DoS por fragment count bypass) + moderate (HTTP request/response smuggling, CRLF injection vía `upgrade`, header injection vía Set-Cookie percent-decoding) + low (queue poisoning por keep-alive reuse, SameSite downgrade) |
| **next-auth** | directa (beta) | moderate (email misdelivery) |
| **postcss** | transitiva (dev/build) | moderate (XSS vía `</style>` sin escapar en stringify) |
| **uuid** | transitiva | moderate (missing buffer bounds check en v3/v5/v6) |
| **tmp** | transitiva | high (path traversal vía prefix/postfix no saneado) |

**Concentración de riesgo**: `next` y `nodemailer` explican la mayoría de los `high`, y ambos son dependencias **directas** con fix disponible simplemente subiendo versión (next ≥15.5.16 ya resuelve dos de los low/moderate; nodemailer y `@vercel/blob`→undici requieren bump de mayor para llegar a versiones parcheadas). No se aplicó ningún fix — reporte read-only.

---

## Riesgos arquitectónicos (resumen para el llamador)

Ver resumen de la respuesta final para los top-3.
