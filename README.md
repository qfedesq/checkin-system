# Emmalva

Plataforma de gestión de empleados, vacaciones, documentación y check-in/out con biometría.
Construida con **Next.js 15** + **Prisma** + **Auth.js** + **WebAuthn**, desplegada en **Vercel** sobre **Neon Postgres**.

Identidad visual acorde al [Manual de Marca Emmalva](public/emmalva-horizontal.svg): isotipo cian (#29ABE2) y tipografía **Nunito** (alternativa libre a Gotham Rounded del manual).

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript
- Tailwind CSS · Nunito + IBM Plex Mono
- Prisma ORM · Postgres (Neon)
- Auth.js v5 beta (Credentials) + `@simplewebauthn` (biometría + device binding)
- Vercel Blob (uploads) · Vercel Cron (alertas de vencimiento)
- `pdf-lib` (firma automática de recibos) · `exceljs` (export de jornadas) · `react-day-picker` (calendario)
- Resend (emails) · Zod (validación)

## Setup local

```bash
pnpm install
cp .env.example .env.local   # completar variables
pnpm prisma:generate
pnpm db:push
pnpm db:seed                  # crea un admin (ver SEED_ADMIN_EMAIL/PASSWORD)
pnpm dev
```

### Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Postgres (Neon) |
| `AUTH_SECRET` | Secreto Auth.js (generar con `openssl rand -base64 32`) |
| `AUTH_URL` | URL pública (`http://localhost:3000` en dev) |
| `WEBAUTHN_RP_ID` | Host sin esquema (`localhost`, `checkin.tu-dominio.com`) |
| `WEBAUTHN_RP_NAME` | Nombre visible del RP (default `Checkin System`) |
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob |
| `RESEND_API_KEY` | API key de Resend (opcional en dev — loguea a consola si falta) |
| `RESEND_FROM` | Remitente, ej `Checkin <no-reply@tu-dominio>` |
| `CRON_SECRET` | Bearer que protege `/api/cron/expiry-check` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credenciales del admin creado por `db:seed` |

## Scripts

- `pnpm dev` — dev server
- `pnpm build` — build de prod
- `pnpm test` — tests de utilidades (`node --test`)
- `pnpm version:bump` — sube la versión +0.01
- `pnpm sync:changelog` — regenera `CHANGELOG.md` desde `src/content/changelog.mdx`
- `pnpm db:push` / `pnpm db:seed` — aplicar schema / crear admin

## Workflow

- **Trunk-based**: se trabaja directo sobre `main`. Cada PR va derecho a `main` y se publica automáticamente a Vercel producción.
- Cada PR que modifica comportamiento **debe** bumpear la versión y actualizar el changelog y el manual. El [PR template](.github/pull_request_template.md) tiene el checklist.
- La versión actual se muestra abajo a la izquierda en la app (`<VersionBadge />`), lincada a `/changelog`.

## Documentación extra

- Manual de usuario in-app: `/help`
- Changelog in-app: `/changelog` (fuente: `src/content/changelog.mdx`)
- Runbook operativo: [`docs/runbook.md`](docs/runbook.md)
- Arquitectura: [`docs/architecture.md`](docs/architecture.md)
