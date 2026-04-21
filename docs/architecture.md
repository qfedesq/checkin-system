# Arquitectura

## Módulos

```
src/
├── app/                     # App Router
│   ├── (app)/               # layout + páginas del empleado (dashboard, profile, calendar, documents, inbox, checkin)
│   ├── admin/               # layout + páginas del administrador
│   ├── api/                 # endpoints REST
│   ├── login / register / reset-password / forgot-password / pending / setup-biometrics
│   ├── help/[section]       # manual de usuario (MDX)
│   └── changelog            # changelog visible in-app
├── components/              # UI, layout, providers, brand
├── content/                 # MDX del manual y changelog (única fuente de verdad)
├── lib/                     # auth, prisma, webauthn, email, pdf-sign, blob, audit, utils, leaves
└── middleware.ts            # gating por rol, device, mustChangePassword
```

## Autenticación y device binding

1. `Credentials` provider valida email + password (bcrypt).
2. Tras el autorize, JWT lleva `role`, `status`, `mustChangePassword`, `hasWebauthn`.
3. En `/login`, luego del signIn, el cliente pide un assertion WebAuthn al servidor (`/api/webauthn/authenticate/options` + `verify`). Se verifica que:
   - La credencial pertenezca al usuario.
   - El `deviceId` coincida con el guardado en `User.deviceId`.
4. El primer login sin credenciales redirige a `/setup-biometrics`, que hace `generateRegistrationOptions` + `verifyRegistrationResponse` y setea `deviceId = sha256(credentialId)`.

## Firma automática de PDFs

- `lib/pdf-sign.ts` carga el PDF con `pdf-lib`, dibuja un bloque con nombre, CUIL, timestamp, hash SHA-256 del original y — si existe — la imagen de firma cargada por el empleado.
- El handler `/api/deliveries/[id]/open`:
  1. Valida ownership.
  2. Si ya hay `signedBlobUrl`, redirige directo.
  3. Si no: baja original, firma, sube firmado a Blob, guarda `signedBlobUrl` + `originalHash` + `openedAt`, redirige.

## Calendario

- Vacaciones: validación server-side obliga `start.getDay() === 1` y `days ∈ {7, 14}`.
- Franco: `type=DAY_OFF` + `status=APPROVED` por fecha es único.
- `/api/calendar/availability` entrega al cliente lo necesario para marcar el day-picker (mis solicitudes + francos tomados por otros).

## Alertas de vencimiento

- Vercel Cron dispara `GET /api/cron/expiry-check` diariamente (09:00 UTC, `vercel.json`).
- Protegido con `CRON_SECRET`.
- Itera perfiles (carnet profesional + libreta sanitaria) y documentos subidos; envía email y marca `notifiedAt` / `notifiedHealthExpiryAt` / `notifiedLicenseExpiryAt` para no spammear.
