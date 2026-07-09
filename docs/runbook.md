# Runbook operativo

## Resetear password de un empleado

1. Entrá a `/admin/users`.
2. Click en el icono de llave en la fila del empleado.
3. El sistema genera una contraseña temporal de 12 caracteres, la copia al portapapeles y la muestra en un toast. Pasásela por un canal seguro.
4. El empleado ingresa con esa password → el middleware lo redirige a `/reset-password` → elige su nueva.

## Resetear dispositivo

El empleado perdió el teléfono o cambió de laptop.

1. `/admin/users` → icono de celular.
2. Se borran `WebAuthnCredential` y `User.deviceId`.
3. La próxima vez que entre, el sistema le pide registrar un nuevo dispositivo.

## Revivir el cron de vencimientos

```
curl -H "Authorization: Bearer $CRON_SECRET" https://checkin-system-beta.vercel.app/api/cron/expiry-check
```

Verificar logs en Vercel. Si los emails no salen, revisá `GMAIL_USER` + `GMAIL_APP_PASSWORD` (driver primario) o `RESEND_API_KEY` (fallback).

## Configurar envío de emails (Gmail SMTP)

Los emails salen desde la cuenta del administrador (`emmalvasas@gmail.com`). Google requiere un **App Password** — 2FA obligatorio.

1. Entrar a https://myaccount.google.com con `emmalvasas@gmail.com`.
2. Seguridad → Verificación en dos pasos (activar si no lo está).
3. Contraseñas de aplicaciones → crear una nueva con nombre "Emmalva Workforce" — te devuelve una cadena de 16 caracteres, sin espacios.
4. En Vercel del proyecto `checkin-system`:
   - `GMAIL_USER=emmalvasas@gmail.com` (production, preview, development)
   - `GMAIL_APP_PASSWORD=<esos 16 caracteres>` (production, preview, development)
   - `MAIL_FROM_NAME=Emmalva` (opcional — queda así si no se setea)
5. Redeploy o esperar al próximo push.

**Límite Gmail free**: 500 emails/día por cuenta. Para workspace (dominio corporativo) son 2.000/día. Si se supera, Google bloquea la cuenta por 24 hs.

## Alternativa: Resend

Para volúmenes mayores o para no depender de una cuenta Gmail, usar Resend:

1. Crear cuenta en https://resend.com y verificar un dominio propio (DNS: SPF + DKIM).
2. Setear en Vercel: `RESEND_API_KEY=re_...`, `RESEND_FROM="Emmalva <no-reply@tudominio.com>"`.
3. Si tanto `GMAIL_*` como `RESEND_*` están seteados, gana Gmail SMTP. Para forzar Resend, borrar `GMAIL_APP_PASSWORD`.

## Notificaciones push (Web Push)

Las notificaciones al empleado salen por **email + push**. El push usa claves VAPID:

1. Generar claves una sola vez: `npx web-push generate-vapid-keys`.
2. Setear en Vercel:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (clave pública — también la usa el browser)
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (ej. `mailto:emmalvasas@gmail.com`)
3. Sin estas variables el push queda en modo stub (loguea a consola) y el email sigue saliendo normal.
4. **iOS**: el push sólo funciona si el empleado agregó la app a inicio (PWA instalada, iOS 16.4+). En Android y desktop funciona directo en el browser.
5. Las suscripciones viven en la tabla `PushSubscription`; las vencidas (404/410) se limpian solas al intentar enviar.

## Cron de recordatorio de check-out

`GET /api/cron/checkout-reminder` corre cada 15 minutos (vercel.json). **Vercel Hobby no soporta crons sub-diarios**: si el proyecto está en Hobby, crear un job en cron-job.org (u otro scheduler) que llame `https://<dominio>/api/cron/checkout-reminder?key=<CRON_SECRET>` cada 15 minutos.

## Backfill de aprobación de dispositivos (v0.16)

Al deployar v0.16 correr una única vez, con la DATABASE_URL de producción:

```bash
node scripts/backfill-device-approval.mjs
```

Aprueba retroactivamente los dispositivos ya registrados. Sin esto, todos los usuarios existentes quedan bloqueados para fichar.

## Migraciones Prisma versionadas (desde WS-8 / QA-016)

A partir de ahora el schema **no se sincroniza más con `prisma db push`** en producción. Se usan migraciones versionadas (`prisma/migrations/`). `db push` queda sólo para desarrollo local contra una DB descartable.

Migraciones existentes:
- `0_init`: baseline — representa el schema que ya está desplegado en prod (generado con `prisma migrate diff --from-empty --to-schema-datamodel`, sin tocar ninguna DB).
- `1_indexes`: agrega `LeaveRequest.status`, `DocumentUpload.status`, `Attendance.checkOutAt`, y el índice único parcial `attendance_one_open_per_user` (cierra el race de doble check-in, QA-008).

**Baseline en la DB de producción (hacer una sola vez, la primera vez que se corre este flujo contra la Neon existente):**

```bash
# marca 0_init como ya aplicado sin ejecutar su SQL (la DB ya tiene ese estado)
pnpm prisma migrate resolve --applied 0_init

# aplica las migraciones pendientes (hoy: 1_indexes)
pnpm prisma migrate deploy
```

**De ahí en adelante**, cada cambio de schema se hace así:
1. Editar `prisma/schema.prisma`.
2. Local: `pnpm prisma migrate dev --name <descripcion>` contra una DB de desarrollo (crea la carpeta de migración y la aplica ahí).
3. Commit de `prisma/migrations/<nueva_carpeta>/migration.sql`.
4. Deploy a producción: `pnpm prisma migrate deploy` (o `pnpm migrate:deploy`), nunca `db push`.

Nota sobre el índice único parcial: Prisma no soporta `WHERE` en `@@index`/`@@unique` del schema, así que ese índice vive únicamente en el SQL de la migración (`1_indexes/migration.sql`) y no aparece reflejado en `schema.prisma`. Evitar `db push` en producción — al no reconocer índices parciales, un `db push` sin cuidado podría no recrearlo si se resetea el schema.

## Restaurar DB

Neon ofrece branches y point-in-time restore. Desde el dashboard de Neon, crear branch desde timestamp deseado y actualizar `DATABASE_URL` en Vercel.

## Bumpear versión y publicar

1. `pnpm version:bump` → sube la versión en `package.json`.
2. Editar `src/content/changelog.mdx` con la nueva entrada.
3. `pnpm sync:changelog` → regenera `CHANGELOG.md`.
4. Actualizar `src/content/manual/*.mdx` si cambió el comportamiento.
5. PR → merge → Vercel deploy automático.
