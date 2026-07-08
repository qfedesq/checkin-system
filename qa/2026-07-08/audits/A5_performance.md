# A5 — Auditoría de performance (report-only)

Fecha: 2026-07-08
Método: **análisis estático** de código — no hay entorno con datos de producción ni forma de perfilar runtime (no hay APM, no hay `EXPLAIN` contra la DB real, no hay Lighthouse/CI de performance). Todo hallazgo es lectura directa de `prisma/schema.prisma`, route handlers, server components y componentes cliente. Las afirmaciones sobre "esto va a doler cuando la tabla crezca" son inferencia razonada a partir del código (confidence `medium`), no medición. Las afirmaciones sobre estructura de queries/índices son lectura directa (confidence `high`).

No se modificó código de la app. Este documento y su JSON hermano (`A5_performance.findings.json`) son el único output.

## Alcance revisado

- `prisma/schema.prisma` (14 modelos, índices declarados)
- `src/app/api/cron/{expiry-check,checkout-reminder}/route.ts`
- `src/app/admin/**/page.tsx` (users, employees, employees/[id], leaves, documents, deliveries, profile-changes, attendance, admin/page.tsx, admin/layout.tsx)
- `src/app/(app)/**/page.tsx` (dashboard, checkin, documents, inbox) + `(app)/layout.tsx`
- `src/app/api/attendance/export/route.ts`, `src/app/api/calendar/availability/route.ts`, `src/app/api/deliveries/[id]/open/route.ts`
- `src/lib/{blob,pdf-sign,push,notify,email}.ts`
- Componentes cliente: `SignaturePad.tsx`, `CalendarClient.tsx`, `DonutChart.tsx`, `AdminMiniCalendar.tsx`, tablas admin
- `package.json` (deps cliente vs. server-only), `next.config.mjs`

---

## 1. Prisma — queries en loop / N+1 de escritura

**`cron/expiry-check` (diario, 09:00)** hace `employeeProfile.findMany({ include: { user: {...} } })` **sin `where`** (trae todos los perfiles, todas las columnas) y filtra `status !== "ACTIVE"` en JS en vez de en la query. Después itera con un `for` secuencial y, por cada perfil que vence, hace **hasta 3 `await` en cadena** (`sendEmail` → `sendPushToUser` → `prisma.employeeProfile.update`), y si detecta vencido además `prisma.user.update` + `prisma.user.findMany` (admins) + N `sendEmail` a admins — todo secuencial, sin `Promise.all`. Hoy con pocos empleados es tolerable; en cuanto `GMAIL_APP_PASSWORD` esté activo (memoria del proyecto: emails hoy en stub) cada `sendEmail` real vía SMTP puede tardar cientos de ms, y sin `maxDuration` configurado en el route handler ni en `vercel.json`, el cron corre con el timeout default de la función Vercel — con suficientes empleados venciendo el mismo día el job puede acercarse al límite. **Confidence: high** para el patrón de código; **medium** para el riesgo de timeout (no medido, depende de config de plan/runtime no visible en el repo).

**`cron/checkout-reminder`** (cada 15 min) está mejor: filtra en DB (`checkOutAt: null`, `checkoutReminderSentAt: null`, `checkInAt: lte threshold`, `user.status: ACTIVE`) y usa `select` acotado. Pero el loop posterior de notificación + `update` por fila sigue siendo secuencial. Con pocas jornadas abiertas simultáneas el impacto es bajo, pero es el mismo antipatrón, y corre 96 veces por día para siempre.

No se encontraron loops de **lectura** N+1 (ningún `for` que dispare un `findMany`/`findUnique` por cada fila de un resultado anterior fuera de los dos crons).

## 2. Prisma — `findMany` sin límite/paginación

Tres pantallas admin traen **la tabla completa sin `take`**, con `include` ancho (`user: { include: { profile: true } }`, es decir toda la fila de `User` + toda la fila de `EmployeeProfile`, incluidas las 8 columnas de URLs de blobs que la pantalla no usa):

- `src/app/admin/documents/page.tsx` — `documentUpload.findMany({ orderBy, include })`, sin `where` ni `take`. Esta tabla crece para siempre (cada documento subido por cada empleado, para siempre; nunca se archiva/pagina).
- `src/app/admin/leaves/page.tsx` — mismo patrón sobre `leaveRequest`.
- `src/app/admin/users/page.tsx` — mismo patrón sobre `user` (acotado por cantidad de empleados, crece más lento pero también sin límite).

Como contraste correcto: `admin/deliveries/page.tsx` (`take: 50`) y `admin/profile-changes/page.tsx` (`take: 100`) sí paginan. El patrón inconsistente sugiere que no es una decisión deliberada sino que se fue perdiendo página a página.

`admin/employees/page.tsx` tiene el mismo problema (`user.findMany({ include: { profile: true } })` sin `take`) y además ordena/filtra por búsqueda **en JS después de traer todo** en vez de `orderBy` de Prisma — para el volumen actual (decenas de empleados) es irrelevante, pero es el mismo patrón que no escala si la planta crece a cientos.

`admin/attendance/page.tsx` trae `user.findMany({ include: { profile: true } })` de **todos los empleados** sólo para poblar un `<select>` de filtro (id + nombre) — el include completo (perfil entero) es innecesario, un `select: { id, profile: { select: { firstName, lastName } } }` alcanza.

## 3. Índices — gaps frente a los `where` reales

- `Attendance` sólo tiene `@@index([userId, checkInAt])`. La query del cron `checkout-reminder` filtra por `checkOutAt: null` (columna no indexada, ni sola ni en combinación) — cada corrida cada 15 minutos hace un scan que no puede usar el índice compuesto (su columna líder es `userId`, no aplica para un filtro sin `userId`). Con la tabla creciendo indefinidamente (nunca se purga `Attendance`), el costo de esa query sube con el tiempo. Falta un índice parcial/compuesto que cubra "jornadas abiertas" (ej. `@@index([checkOutAt])` o, mejor, un índice parcial `WHERE checkOutAt IS NULL` si se migra a `prisma migrate`).
- El mismo problema afecta a `attendance/export` y `admin/attendance/page.tsx` cuando se filtra sólo por rango de fecha **sin** `userId` (el caso más común: "exportar todas las jornadas de tal mes") — el índice `[userId, checkInAt]` no ayuda a un filtro por `checkInAt` solo tan eficientemente como un índice cuya columna líder sea `checkInAt`.
- `DocumentUpload` sólo indexa `userId`. `admin/documents/page.tsx` ordena por `status` sin índice en `status` (hoy irrelevante porque no hay `where`, pero si en el futuro se agrega un filtro "sólo pendientes" para acotar el `findMany` sin límite del punto 2, haría falta el índice).
- `LeaveRequest` indexa `[startDate, endDate]` y `[userId]`, pero no `status` ni `[userId, status]` — `calendar/availability` filtra por `userId + status IN (...) + fechas` y `admin/leaves` ordena por `status` sin filtrar; ambos se beneficiarían de un índice compuesto.
- `EmployeeProfile` no indexa `healthCardExpiry`/`professionalLicenseExpiry` ni `category` — hoy no importa porque el cron hace `findMany` sin `where` (scan completo intencional) y el join por categoría en `calendar/availability` opera sobre pocas filas, pero es un gap si mañana se filtra en DB en vez de en JS.
- `AuditLog` indexa `createdAt` pero no `actorId`/`subjectId`; no se encontró ninguna pantalla que hoy consulte `AuditLog` por esos campos, así que es un gap latente, no activo.

**Confidence: high** (lectura directa del schema + de los `where` de cada query).

## 4. Imágenes — sin optimización

Confirmado con `grep`: **0 usos de `next/image`** en todo `src/`. Las 5 superficies que muestran fotos/documentos usan `<img>` crudo:

- `admin/employees/page.tsx` (avatar `faceImageBlobUrl`, mostrado en un círculo de **40×40px** — sirve el archivo original completo, potencialmente varios MB, para un thumbnail)
- `profile/ProfileForm.tsx`, `profile/SignaturePad.tsx`, `documents/DocsVencimientos.tsx`, `admin/employees/[id]/EmployeeDetailClient.tsx` (frente/dorso DNI, carnet, libreta sanitaria, foto de cara)

En el upload (`api/profile/uploads/route.ts`, `api/documents/upload/route.ts`) no hay ningún paso de **resize/compresión** — sólo se valida tipo MIME y tamaño máximo (8MB perfil, 10MB documentos) y se sube el archivo tal cual a Vercel Blob (`access: "public"`). No se usa `sharp` ni ninguna librería de imagen en el server; tampoco hay `canvas.toDataURL`/resize en el cliente antes de subir (la única excepción es `SignaturePad.tsx`, que genera un PNG pequeño desde un canvas de ~160px de alto, sin problema de tamaño).

Esto es relevante especialmente porque el usuario principal de estos uploads es el **empleado en el celular, en campo** (choferes/ayudantes con conectividad variable) subiendo fotos de cámara (que en un smartphone moderno rondan 3–8MB por imagen) — cada carga y cada vista posterior mueve el archivo completo. **Confidence: high** (ausencia confirmada por lectura de todos los puntos de upload/consumo).

## 5. Duplicación de queries — dashboard admin

`src/app/admin/layout.tsx` (envuelve **todas** las páginas `/admin/*`) ejecuta en paralelo 4 `count()`:
```
prisma.user.count({ where: { status: "PENDING_APPROVAL" } })
prisma.leaveRequest.count({ where: { status: "PENDING" } })
prisma.documentUpload.count({ where: { status: "PENDING_REVIEW" } })
prisma.profileChangeRequest.count({ where: { status: "PENDING" } })
```
para los badges del sidebar. `src/app/admin/page.tsx` (la home del panel, `/admin`) vuelve a ejecutar **exactamente los mismos 4 `count()`** (líneas 23–26) para sus propios KPIs. Next.js App Router no dedupea automáticamente llamadas arbitrarias a Prisma (sólo dedupea `fetch` dentro del mismo render), así que cada visita a `/admin` dispara **8 queries** donde 4 son redundantes. Impacto absoluto bajo (son `count()` sobre tablas chicas), pero es un desperdicio sistemático y fácil de eliminar (memoizar con `React.cache()` o levantar el cálculo a un helper compartido). **Confidence: high**.

## 6. Render — server vs. client, bundle

- **Server Components correctamente usados**: todas las páginas con datos (`admin/*`, `(app)/*`) son server components async que hacen `await prisma...` y pasan props serializadas a un client component chico (`*Client.tsx`) para la interactividad. Buen split.
- **`exceljs` y `pdf-lib` confirmados server-only**: `grep -rl "exceljs\|pdf-lib" src/` sólo devuelve `api/attendance/export/route.ts` y `lib/pdf-sign.ts` (ambos route handlers/libs de servidor, `pdf-sign.ts` con `import "server-only"`). Ninguno de los dos entra al bundle de cliente. **Correcto.**
- **Dependencias cliente son livianas**: no hay `moment`/`lodash`/librerías de gráficos pesadas; `DonutChart` es SVG puro sin librería; `react-day-picker` sólo se importa en los 2 componentes que lo necesitan (`CalendarClient.tsx`, `AdminMiniCalendar.tsx`), cada uno ya aislado en su propia ruta (code-splitting por ruta de Next, no hace falta `dynamic()` explícito).
- **Firma de PDF cacheada correctamente**: `api/deliveries/[id]/open/route.ts` firma el PDF una sola vez y guarda `signedBlobUrl`; en aperturas subsecuentes redirige directo al blob firmado sin volver a invocar `pdf-lib`. Buen patrón, evita recomputar trabajo pesado de CPU en cada descarga.
- **Push notifications en paralelo**: `lib/push.ts` usa `Promise.allSettled` sobre todas las suscripciones de un usuario (no loop secuencial); `lib/notify.ts` idem para email+push. Correcto, contrasta con el antipatrón de los crons (sección 1).
- **Fuentes self-hosted**: `@fontsource/ibm-plex-mono` importado localmente con `font-display: swap` en `globals.css` — evita el round-trip a Google Fonts y el FOIT. Correcto.
- No se encontraron listas sin `key` estable (todas usan `key={id}` o `key={i}` en listas cortas/index-estables donde no hay reordenamiento).

## 7. Caching / `force-dynamic`

Las 14 páginas server-rendered con datos de Prisma usan `export const dynamic = "force-dynamic"`. A primera vista parece "sin estrategia de cache", pero **es coherente**: todas son vistas personalizadas por sesión (dashboard del empleado logueado, panel admin con contadores en vivo, listados que deben reflejar aprobaciones recién hechas) detrás del gate de `middleware.ts` — no son cacheables de forma útil de todos modos. Como contraste correcto, las páginas verdaderamente estáticas (`help/*`, `changelog`, `login`) **no** tienen `force-dynamic` y quedan servibles desde caché/prerender. **No es un gap, es un uso apropiado del flag** — el único costo real es la duplicación de query del punto 5, no el `force-dynamic` en sí.

---

## Resumen de riesgo

El sistema está dimensionado razonablemente para el tamaño actual de la planta (decenas de empleados). Los riesgos reales no son de latencia hoy sino de **degradación con el tiempo**: tablas de solo-inserción sin límite (`Attendance`, `DocumentUpload`, `LeaveRequest`) consultadas con `findMany` sin `take` o sin índice que cubra el filtro más común, y dos crons que iteran secuencialmente. El gap más tangible para el usuario final hoy mismo es el de imágenes (fotos de cámara sin resize serví­das tal cual, incluso en thumbnails de 40px) porque afecta directamente el consumo de datos móviles de los empleados en el campo.

---
Archivo generado como parte de Auditoría A5 (report-only). No se modificó código de la app.
