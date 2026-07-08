# D2 — Product / Feature Discovery (report-only)

Fuente: `src/app` (páginas y `api/`), `src/components/layout/AppShell.tsx`, `README.md`, `docs/architecture.md`, `docs/runbook.md`, `src/content/manual/*.mdx`. No se modificó código.

## Propósito

Emmalva "Checkin System" es una webapp de RRHH para una empresa de logística/transporte con dos categorías de empleado (chofer / ayudante). Cubre el ciclo completo de gestión de personal:

- **Fichado** (check-in/out) con geolocalización + verificación biométrica (WebAuthn) atada a un único dispositivo por usuario.
- **Legajo digital**: datos personales, tallas, vencimientos de documentación (libreta sanitaria, carnet profesional), fotos de documentos, firma digital manuscrita.
- **Vacaciones y francos** con reglas de negocio (inicio lunes, 7/14 días, cupo por categoría, un franco/mes, saldo anual).
- **Documentación** con aprobación admin y bloqueo automático de cuenta por vencimiento.
- **Recibos/notificaciones** entregados por el admin, firmados automáticamente en PDF (pdf-lib + hash SHA-256) al abrirlos.
- **Alta y aprobación de usuarios y dispositivos** — el autoregistro está deshabilitado; todo alta es manual desde el panel admin.
- **Exportación de horas trabajadas a Excel** (exceljs) — sólo visible para admin.
- **Notificaciones** email (Gmail SMTP / Resend fallback) + Web Push (VAPID) y crons Vercel (`expiry-check` diario, `checkout-reminder` cada 15 min).

## Usuarios

| Rol | Dispositivo típico | Qué hace |
|---|---|---|
| **ADMIN** (RRHH) | Desktop | Alta de usuarios, aprobación de altas/dispositivos/vacaciones/francos/documentos/cambios de perfil, ficha completa del legajo, envío de recibos/documentos, export de jornadas a Excel, reset de password/dispositivo, bloqueo/desbloqueo manual y automático. |
| **EMPLOYEE** (chofer o ayudante) | Mobile / PWA | Completa su perfil (primera carga directa, ediciones posteriores van a aprobación), sube fotos de documentos y firma digital, pide vacaciones/franco, hace check-in/out, ve y abre recibos/notificaciones (firmados al abrir), recibe alertas de vencimiento. |

## Inventario de features

### Autenticación / onboarding
| Ruta / endpoint | Rol | Descripción |
|---|---|---|
| `/login` (`LoginForm.tsx`) | público | Credentials (email+password) → si el usuario tiene WebAuthn, pide assertion (`/api/webauthn/authenticate/options`, `/verify`); si no, redirige a `/setup-biometrics`. |
| `/setup-biometrics` (`EnrollButton.tsx`) | autenticado sin WebAuthn | Registro de biometría (`/api/webauthn/register/options`, `/verify`); dispositivo queda `deviceApprovedAt=null` si es EMPLOYEE (auto-aprobado si ADMIN). |
| `/api/register` | público | **Deshabilitado** (410) — devuelve error indicando que el admin debe crear la cuenta. |
| `/register` | público | Página de registro autoservicio (llama al endpoint deshabilitado). |
| `/forgot-password`, `/reset-password` (`ResetPasswordForm.tsx`) | público / forzado | Cambio de password; forzado por `mustChangePassword` vía middleware. |
| `/api/password/change` | autenticado | Cambia password propio. |
| `/pending` | usuario `PENDING_APPROVAL` | Pantalla de espera hasta que admin aprueba el alta. |
| `src/middleware.ts` | — | Gating global: sin sesión → `/login`; `PENDING_APPROVAL` → `/pending`; `mustChangePassword` → `/reset-password`; `ACTIVE` sin WebAuthn → `/setup-biometrics`; no-ADMIN en `/admin/*` → `/dashboard`. |

### Empleado — `(app)` layout
| Ruta / endpoint | Descripción |
|---|---|
| `/dashboard` | Home del empleado. |
| `/profile` (`ProfileForm.tsx`, `SignaturePad.tsx`) + `PUT /api/profile` | Alta/edición de datos personales, categoría (chofer/ayudante), talles, vencimientos, contacto de emergencia. Primera carga = directa; carga posterior si el perfil ya está completo = `ProfileChangeRequest` pendiente de aprobación admin. Campos solo-admin: CUIL, legajo, fecha de ingreso, email. |
| `POST /api/profile/uploads` | Sube imágenes propias sin aprobación: firma (`signature`), foto de cara (`face`), libreta frente/dorso (`healthFront/Back`), carnet frente/dorso (`licenseFront/Back`), DNI frente/dorso (`dniFront/Back`). |
| `GET /api/profile/expiry` | Consulta de vencimientos propios. |
| `/calendar` (`CalendarClient.tsx`) + `POST /api/leaves` + `GET /api/calendar/availability` | Pide vacaciones (lunes, 7/14 días, saldo anual, cupo 1 chofer + 1 ayudante/semana) o franco (máx 1/mes, único aprobado por día). |
| `/documents` (`DocumentsClient.tsx`, `DocsVencimientos.tsx`) + `POST /api/documents/upload` | Sube libreta sanitaria / carnet (si chofer) con fecha de vencimiento + fotos frente/dorso; "otros documentos" libres. |
| `/inbox` | Recibos y notificaciones recibidos, filtro por mes; abrir dispara `GET /api/deliveries/[id]/open`. |
| `/checkin` (`CheckinClient.tsx`) + `POST /api/attendance/checkin` / `checkout` | Fichado con geolocalización; bloqueado si `deviceId` existe pero no está `deviceApprovedAt`. |
| `/help`, `/help/employee`, `/help/faq`, `/help/intro` | Manual in-app (MDX). |
| `/changelog` | Changelog in-app. |

### Admin — `/admin` layout
| Ruta / endpoint | Descripción |
|---|---|
| `/admin` | Panel: 3 tortas (check-in/out del día, ausentes), próximos 5 vencimientos, calendario mensual, contadores de pendientes. |
| `/admin/employees`, `/admin/employees/[id]` (`EmployeeDetailClient.tsx`) + `PUT /api/admin/employees/[id]` + `POST /api/admin/employees/[id]/uploads` | Ficha completa editable (incluye campos que el empleado no puede tocar: legajo, nombres, DNI, CUIL, fecha ingreso, categoría), carga de imágenes DNI/carnet/libreta/cara, semanas de vacaciones/año. |
| `/admin/users` (`UsersTable.tsx`) + `POST /api/admin/users`, `/[id]/approve`, `/approve-device`, `/reject-device`, `/reset-device`, `/reset-password`, `/disable`, `/enable` | Alta manual de usuarios (clave temp `Emmalva01`), aprobación de alta (pide legajo+fecha ingreso), aprobación/rechazo de dispositivo, reset password/dispositivo, deshabilitar/reactivar. |
| `/admin/profile-changes` (`ProfileChangesClient.tsx`) + `POST /api/admin/profile-changes/[id]/approve` / `reject` | Cola de cambios de perfil propuestos por empleados (diff campo por campo). |
| `/admin/leaves` (`AdminLeavesTable.tsx`) + `POST /api/admin/leaves/[id]/approve` / `reject` | Aprobación/rechazo de vacaciones y francos; valida colisión de franco al aprobar. |
| `/admin/documents` (`AdminDocuments.tsx`) + `POST /api/admin/documents/[id]/approve` / `reject` | Aprobación/rechazo de documentos subidos por empleados (motivo de rechazo visible al empleado). |
| `/admin/deliveries` (`DeliveriesClient.tsx`) + `POST /api/admin/deliveries/upload` | Envío de recibos/documentos (PDF) a un empleado puntual; ve estado abierto/firmado. |
| `/admin/attendance` (`AttendanceClient.tsx`) + `GET /api/attendance/export` | Listado de jornadas filtrable por fecha/empleado; export a Excel (legajo, apellido, nombre, fecha, check-in/out, duración min y hh:mm, coordenadas). |
| `AdminMiniCalendar.tsx` | Calendario multi-mes embebido en panel/leaves. |

### Crons / infraestructura transversal
| Endpoint | Descripción |
|---|---|
| `GET /api/cron/expiry-check` (protegido `CRON_SECRET`, diario 09:00 UTC) | Notifica (email+push) vencimientos ≤30 días de libreta/carnet/documentos; **bloquea automáticamente** (`status=DISABLED`) al día siguiente del vencimiento y avisa a admins. |
| `GET /api/cron/checkout-reminder` (cada 15 min, requiere scheduler externo en Hobby) | Notifica si pasaron 7h45m desde el check-in sin check-out. |
| `POST /api/push/subscribe` | Alta de suscripción Web Push (VAPID). |
| `src/lib/pdf-sign.ts`, `src/lib/blob.ts`, `src/lib/notify.ts`, `src/lib/email.ts`, `src/lib/audit.ts` | Firma PDF, Vercel Blob, notificación dual email+push, auditoría (`recordAudit` en casi todos los endpoints mutantes). |

## Flujos críticos

1. **Login + verificación biométrica** — `/login` (`LoginForm.tsx`) → `signIn("credentials")` → si el usuario tiene WebAuthn: `POST /api/webauthn/authenticate/options` → `startAuthentication()` (Face ID/Touch ID) → `POST /api/webauthn/authenticate/verify` (valida credencial + `deviceId` coincide con `User.deviceId`) → si `needsEnrollment`, redirige a `/setup-biometrics`. `middleware.ts` gatea `PENDING_APPROVAL`, `mustChangePassword` y falta de WebAuthn.

2. **Registro de dispositivo (setup-biometrics)** — `/setup-biometrics` (`EnrollButton.tsx`) → `POST /api/webauthn/register/options` → `startRegistration()` → `POST /api/webauthn/register/verify` → crea `WebAuthnCredential`, setea `User.deviceId = sha256(credentialId)`; si es EMPLOYEE queda `deviceApprovedAt=null` (pendiente) y se notifica a admins (`notifyAdmins("device.pending")`); si es ADMIN se auto-aprueba.

3. **Check-in / check-out** — `/checkin` (`CheckinClient.tsx`) → pide geoloc + confirma dispositivo → `POST /api/attendance/checkin` `{lat,lng}` (rechaza 403 si `deviceId` existe sin `deviceApprovedAt`; 409 si ya hay jornada abierta) → crea `Attendance`. Cierre: `POST /api/attendance/checkout` `{lat,lng}` (404 si no hay jornada abierta) → calcula `durationMin`, visible sólo para admin.

4. **Solicitud de vacaciones** — `/calendar` (`CalendarClient.tsx`) → `POST /api/leaves` `{type:"VACATION", startDate, days:7|14}` → valida en `src/lib/leaves.ts`: inicio lunes, sin solapamiento propio, saldo anual (`vacationWeeksPerYear`), cupo semanal de 1 chofer + 1 ayudante vía `category` → crea `LeaveRequest(status=PENDING)` → `notifyAdmins("leave.created")`.

5. **Solicitud de franco** — `/calendar` → `POST /api/leaves` `{type:"DAY_OFF", startDate}` → valida: no hay franco `APPROVED` de otro empleado ese día, no hay solicitud propia ese día, máximo 1 franco/mes (`monthBounds`) → crea `LeaveRequest` → notifica admins.

6. **Cambio de perfil con aprobación** — `/profile` (`ProfileForm.tsx`) → `PUT /api/profile`: si no existe perfil → alta directa (`profile.create`); si existe pero incompleto (`isEmployeeProfileComplete`) → escritura directa (`profile.complete`); si ya está completo → diff campo por campo contra `EDITABLE_FIELDS`, bloquea si ya hay `ProfileChangeRequest PENDING` (409), sino crea la solicitud y `notifyAdmins("profile.change.requested")`. (CUIL, legajo, fecha de ingreso y email quedan fuera de este flujo — sólo los edita el admin.)

7. **Carga de documentos frente/dorso** — `/documents` (`DocumentsClient.tsx`): (a) metadata + vencimiento vía `POST /api/documents/upload` (`type=DRIVER_LICENSE|HEALTH_CARD|OTHER`, PDF/PNG/JPEG ≤10MB) → crea `DocumentUpload(status pendiente de aprobación admin)` → `notifyAdmins("document.uploaded")`; (b) fotos frente/dorso vía `POST /api/profile/uploads` (`kind=healthFront/healthBack/licenseFront/licenseBack`, PNG/JPG/WEBP ≤8MB) → se guardan al instante en `EmployeeProfile`, sin aprobación.

8. **Apertura de recibo con firma automática** — `/inbox` → click "Descargar" → `GET /api/deliveries/[id]/open`: valida ownership (recipient o ADMIN); si `signedBlobUrl` ya existe, redirige directo; si no, baja el PDF original, baja la firma del empleado (`profile.signatureBlobUrl`, opcional), `signPdf()` (pdf-lib) agrega bloque con nombre+CUIL+timestamp+hash SHA-256(+imagen de firma si existe), sube a Blob, persiste `signedBlobUrl/originalHash/openedAt`, redirige al PDF firmado.

9. **Alta de usuario por admin** — `/admin/users` → "Nuevo usuario" → `POST /api/admin/users` `{email, role, legajo?, hireDate?, firstName?, lastName?}` (requiere ADMIN) → valida email/legajo únicos → crea `User(status=ACTIVE, mustChangePassword=true, passwordHash=bcrypt("Emmalva01"))` + `EmployeeProfile` con placeholders si se pasaron datos parciales → devuelve `tempPassword` para comunicar por canal seguro.

10. **Aprobación de dispositivo** — `/admin/users` → botón "Aprobar disp." → `POST /api/admin/users/[id]/approve-device` (requiere `deviceId` sin `deviceApprovedAt`, 400/409 si no aplica) → setea `deviceApprovedAt/deviceApprovedById` → `notifyUser("device.approved")`. Alternativa rechazo: `POST /api/admin/users/[id]/reject-device` borra la credencial para re-registro.

11. **Aprobación de vacaciones/francos por admin** — `/admin/leaves` (`AdminLeavesTable.tsx`) → `POST /api/admin/leaves/[id]/approve` (si es franco, re-valida que no haya otro `APPROVED` ese día antes de confirmar, 409 si colisiona) → `status=APPROVED` + `notifyUser("leave.approved")`; o `POST /api/admin/leaves/[id]/reject` (motivo).

12. **Export de horas a Excel** — `/admin/attendance` (`AttendanceClient.tsx`) → filtro por rango de fechas / empleado → `GET /api/attendance/export?from&to&userId` (requiere ADMIN) → genera workbook `exceljs` con legajo, apellido, nombre, email, fecha, check-in, check-out, duración (min y hh:mm), coordenadas in/out → descarga `.xlsx`.

13. **Bloqueo por vencimiento (automático) y desbloqueo (manual)** — `GET /api/cron/expiry-check` (diario, `CRON_SECRET`): por cada `EmployeeProfile` ACTIVE, si `healthCardExpiry` o (si `category=DRIVER`) `professionalLicenseExpiry` está vencido (`daysUntil < 0`), setea `User.status=DISABLED` + `disabledReason` y notifica al empleado + a todos los admins. Desbloqueo: admin actualiza la fecha de vencimiento en `/admin/employees/[id]` y reactiva vía `POST /api/admin/users/[id]/enable`.

14. **Aprobación de alta de empleado (registro pendiente)** — `/admin/users` → los `PENDING_APPROVAL` aparecen primero → "Aprobar" pide legajo + fecha de ingreso → `POST /api/admin/users/[id]/approve` → valida legajo único → `status=ACTIVE`, crea/actualiza `EmployeeProfile` con legajo+hireDate.

15. **Aprobación/rechazo de documentación subida** — `/admin/documents` (`AdminDocuments.tsx`) → `POST /api/admin/documents/[id]/approve` o `/reject` (con motivo visible al empleado en `/documents`).

## Resumen entregado al caller

Ver mensaje final de la tarea.
