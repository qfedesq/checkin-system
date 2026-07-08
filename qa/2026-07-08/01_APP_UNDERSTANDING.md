# 01 — App Understanding (síntesis Fase 1)

## Propósito
Emmalva "Checkin System": webapp RRHH para una empresa de logística (choferes/ayudantes). Gestiona altas de personal, fichaje (check-in/out con geolocalización + biometría), legajo digital, vacaciones/francos, documentación con vencimientos, recibos/notificaciones firmados, y avisos automáticos. En producción (v0.24) en https://checkin-system-beta.vercel.app.

## Usuarios
- **ADMIN** (RRHH, desktop): altas, aprobaciones (usuarios, dispositivos, cambios de perfil, vacaciones/francos, documentos), envío de recibos, export de jornadas a Excel, dashboard.
- **EMPLEADO** (mobile/PWA): completा su ficha, ficha check-in/out, solicita vacaciones/francos, carga documentación, abre recibos (se firman solos).

## Arquitectura (D1)
Next.js 15 App Router + React 19 + TS · Prisma 6 / Neon Postgres (`prisma db push`, sin migraciones versionadas) · Auth.js v5 beta (JWT stateless + Credentials) · @simplewebauthn (device binding + aprobación) · Vercel Blob (uploads `access:public`) · nodemailer Gmail SMTP → Resend → stub · pdf-lib (firma) · exceljs · react-day-picker · Tailwind · PWA + Web Push (VAPID) · Vercel Cron (2: expiry-check diario, checkout-reminder */15). 13 módulos en `src/lib`, ~37 route handlers.

## Matriz de plataformas (D4)
| Plataforma | Soporte | Riesgo |
|---|---|---|
| Desktop web (admin) | Pleno | Bajo |
| Mobile Safair iOS (empleado, PWA instalada) | Pleno | Push requiere iOS ≥16.4 + A2HS |
| iOS Safari (no instalada) | Parcial | Push no funciona; sin aviso |
| **Navegador in-app WhatsApp** | **Riesgoso** | **WebAuthn (`navigator.credentials`) puede no existir → check-in/out roto**; push no |
| Android | Pleno | Bajo |
Único breakpoint real `md:` (768px). Fix de zoom iOS (16px <640px) y safe-areas ya implementados. Sin branching por user-agent.

## Flujos críticos (D2) — 15
login+biometría · registro de dispositivo · check-in/out · solicitud vacaciones · solicitud franco · cambio de perfil con aprobación · carga de documentos frente/dorso · apertura de recibo con firma automática · alta de usuario por admin · aprobación/rechazo de dispositivo · aprobación de vacaciones/francos · export de horas Excel · bloqueo por vencimiento (auto) + desbloqueo (manual) · aprobación de alta pendiente · aprobación/rechazo de documentación.

## Diseño y estados (D3)
Design system centralizado y consistente (tokens + clases `.panel/.surface-*/.btn-*/.badge-*`), theming claro/oscuro sólido. Navegación por rol (sidebar/bottom-nav/drawer con badges). **Gaps**: sin `loading.tsx`/`error.tsx`/`not-found.tsx`, sin spinners/skeletons, varias acciones admin sin confirmación positiva (refresh silencioso), feedback mixto (banners vs 1 toast), modales triplicados a mano, fallbacks `"Error"` genéricos, etiqueta técnica "pwd temp".

## Hipótesis de riesgo (dónde esperar problemas → scoping Fase 2)
1. **Seguridad/sesión**: JWT stateless → deshabilitar cuenta o bajar rol no surte efecto hasta expirar el token; cuenta bloqueada por vencimiento podría seguir operando. (A7, A1, A8)
2. **Exposición de PII**: DNI, licencia, libreta y firmas suben como `access:public` a Blob con URL semi-predecible → acceso sin auth. (A7)
3. **Plataforma**: check-in/out con WebAuthn obligatorio sin guarda de soporte → roto en in-app WhatsApp. (A3, A1)
4. **Autorización por endpoint**: verificar que TODOS los `/api/**` validan sesión/rol y ownership (ej. abrir/firmar recibo de otro, aprobar cambios ajenos). (A7, A1)
5. **Timezone/fechas**: recién migrado a UTC; verificar consistencia en crons, dashboard "hoy", saldos anuales. (A1, A8)
6. **Robustez UX**: acciones sin feedback / sin manejo de `res.ok` (AdminDocuments), estados de error ausentes. (A2)
7. **Dependencias**: 13 vulns high (next/nodemailer/undici) sin CI que las frene. (A7, A6)
8. **Concurrencia/reglas**: cupos de vacaciones (1 chofer+1 ayudante/semana), franco 1/mes, doble submit, aprobaciones concurrentes. (A1, A8)
9. **Calidad**: suite de tests en rojo (test stale post-UTC), lint no configurado. (A6)
