# A6 — Code Quality (Emmalva Checkin System)

Fecha: 2026-07-08 · Método: build + test + `tsc --noEmit` + `pnpm outdated`/`pnpm audit` + análisis estático manual de `src/**`, `prisma/schema.prisma`, `package.json`, `scripts/`, `tests/`. Report-only, sin cambios de código.

## Resumen ejecutivo

- **Build**: ✅ `pnpm build` compila limpio (Next 15.5.15, todas las rutas resuelven).
- **Types**: ✅ `pnpm exec tsc --noEmit` sin errores. `tsconfig.json` con `strict: true`. Cero `as any`/`: any` en `src/**` (sólo 1 `as never` puntual en `src/lib/audit.ts`).
- **Tests**: 🔴 `pnpm test` → 4/5 pass, 1 falla (`tests/leaves.test.ts`). Causa raíz confirmada: el test usa `Date.prototype.getDay()` (huso horario local) pero `src/lib/leaves.ts` migró a `getUTCDay()` en v0.19/v0.22 para trabajar en UTC. Corriendo en `America/Argentina` (UTC-3, confirmado con `date +%Z` → `-03`), `new Date("2026-04-20")` (medianoche UTC) cae en `2026-04-19` hora local → `getDay()` devuelve `0` (domingo) donde el test espera `1` (lunes). El test quedó desactualizado, no el código de producción.
- **Lint**: 🔴 No hay ESLint configurado. `next lint` es interactivo (pide elegir "Strict/Base/Cancel") y no hay `eslint.config.*` ni `.eslintrc*` en el repo, pese a que `eslint` y `eslint-config-next` están en `devDependencies`. El comando de CI/local (`pnpm lint`) no puede correr desatendido — no hay linting automatizado en ningún punto del pipeline.
- **Cobertura de tests**: 1 solo archivo de test (33 líneas), cubre únicamente `src/lib/leaves.ts`. Cero cobertura sobre los 38 route handlers de `src/app/api/**`, ni sobre `auth.ts`, `webauthn.ts`, `pdf-sign.ts`, `notify.ts`, `email.ts`, `push.ts`, `profile.ts`, `blob.ts`, `audit.ts`.
- **Manejo de errores en API**: de 38 archivos `route.ts`, sólo 1 (`src/app/api/deliveries/[id]/open/route.ts`) tiene un bloque `try {`. Los otros 37 no envuelven sus operaciones (Prisma, blob, pdf-sign, email/push) en try/catch explícito.
- **Manejo de errores en cliente**: de 12 componentes cliente que hacen `fetch(...)`, 11 chequean `res.ok`/`response.ok`. La excepción es `src/app/admin/documents/AdminDocuments.tsx`, que no chequea el resultado del fetch ni muestra error alguno al admin.
- **Duplicación**: `ImageSlot` reimplementado 3 veces (ProfileForm, DocsVencimientos, EmployeeDetailClient); modal a mano (`fixed inset-0 z-50 bg-black/60`) reimplementado 3 veces sin componente `<Modal>` compartido; lógica de "primera carga directa, después va a aprobación del admin" (incluido el placeholder mágico `2099`) duplicada línea por línea entre `/api/profile` y `/api/profile/expiry`.
- **Dependencias**: `pnpm outdated` reporta 29 paquetes desactualizados (varios majors: Next 15→16, Prisma 6→7, Tailwind 3→4, Zod 3→4, TypeScript 5→6, react-day-picker 9→10, lucide-react 0.511→1.23). `pnpm audit`: 37 vulnerabilidades (13 high, 18 moderate, 6 low) en el árbol de dependencias, sin CI que las bloquee.
- **Esquema de datos**: no existe `prisma/migrations/` en ningún punto del historial de git — el schema de producción se gestiona 100% con `prisma db push` (`package.json:db:push`), sin migraciones versionadas, sin posibilidad de rollback ni de revisar el diff de un cambio de esquema antes de aplicarlo.
- **Positivo**: patrón consistente de autorización (`requireAdmin()` en `src/lib/admin-guard.ts`, reusado en ~23 endpoints admin) y de validación de entrada (`zod` + `.safeParse` con forma de error uniforme) en los endpoints que reciben body. TypeScript estricto y sin escapes de tipos.

## Hallazgos detallados

### CQ-1 (MAJOR) — Suite de tests en rojo: test desactualizado post-migración a UTC
`tests/leaves.test.ts:14` hace `assert.equal(r.start.getDay(), 1)`. `src/lib/leaves.ts:5` y `:30` usan `getUTCDay()` desde que la lógica de vacaciones se migró a fechas UTC (v0.19+). En cualquier entorno con offset negativo (Argentina, UTC-3, verificado con `date +%Z` → `-03`), el string `"2026-04-20"` se parsea como medianoche UTC, que localmente cae el `2026-04-19`, y `getDay()` local devuelve `0` en vez de `1`. `pnpm test` confirma: `4 pass / 1 fail`, `expected: 1, actual: 0`.
**Impacto**: la suite nunca está verde localmente para el desarrollador (zona horaria Argentina), lo que entrena a ignorar el resultado de `pnpm test` — riesgo de que una regresión real en `validateVacationRange` pase desapercibida porque "el test siempre falla".
**Fix**: cambiar el test a `getUTCDay()` (alineado con la implementación), o construir las fechas de test con `Date.UTC(...)` explícito.

### CQ-2 (MAJOR) — ESLint no configurado; sin linting automatizado
No existe `eslint.config.*` ni `.eslintrc*` en el repo. `pnpm lint` ejecuta `next lint`, que en Next 15 con "no config" cae en el wizard interactivo (`? How would you like to configure ESLint?`) y no puede correr desatendido/en CI. `eslint` (^9.21) y `eslint-config-next` (^15.2) están instalados como `devDependencies` pero no se usan nunca. Tampoco hay `.github/workflows` que lo invoque. Consecuencia indirecta: reglas de `eslint-config-next` (incluye `jsx-a11y`) nunca se ejecutaron, lo que probablemente explica parte de los hallazgos de A4 (labels sin `htmlFor`, etc.) — nada los habría atajado en el momento de escribir el código.
**Fix**: generar `eslint.config.mjs` (`next lint` una vez y commitear la elección, o usar el codemod sugerido por el propio warning: `npx @next/codemod@canary next-lint-to-eslint-cli .`), y wirearlo a un check de CI.

### CQ-3 (MINOR) — Dos lockfiles, Next infiere mal el workspace root
Existen `/Users/qfedesq/Checkin System/pnpm-lock.yaml` (el real, del repo) y `/Users/qfedesq/package-lock.json` (86 bytes, en el directorio *padre*, fuera del repo). Tanto `pnpm build` como `pnpm lint` emiten el warning "Next.js inferred your workspace root... selected the directory of /Users/qfedesq/package-lock.json as the root directory". No rompe el build hoy, pero es una fuente de bugs sutiles de resolución de módulos/tracing de archivos si el proyecto crece o se usan Server Actions con archivos fuera de `src`.
**Fix**: borrar `~/package-lock.json` (si no pertenece a otro proyecto) o setear `outputFileTracingRoot: __dirname` en `next.config.mjs`.

### CQ-4 (CRITICAL) — Ausencia sistemática de try/catch en los API route handlers
De 38 archivos `route.ts` bajo `src/app/api/**`, sólo `src/app/api/deliveries/[id]/open/route.ts` contiene un bloque `try {`. El resto (incluyendo `attendance/checkin`, `attendance/checkout`, `profile/route.ts`, `webauthn/*/verify`, `documents/upload`, todos los `admin/*`) ejecutan llamadas a Prisma, `@vercel/blob`, `pdf-lib` y `bcryptjs` sin envolverlas. Si cualquiera de esas llamadas lanza (ej. Neon con timeout/cold-start, blob storage caído, PDF corrupto en `pdf-sign.ts`), Next.js atrapa la excepción no controlada a nivel de framework y devuelve un 500 genérico — pero sin logging estructurado propio (no hay `console.error` en la mayoría de esos archivos, ver CQ-12), así que en producción esos fallos son invisibles salvo que se revisen los logs crudos de Vercel función por función.
**Evidencia**: `grep -c "try {" src/app/api/**/route.ts` → `0` en 37/38 archivos.
**Fix**: al menos en los endpoints que tocan Blob/pdf-lib/email (mayor superficie de fallo externo — `documents/upload`, `profile/uploads`, `uploads/signature`, `deliveries/*/open`, `admin/deliveries/upload`), envolver en try/catch y devolver un error 5xx con mensaje consistente + loguear con contexto (endpoint, userId, causa).

### CQ-5 (MAJOR) — `AdminDocuments.tsx` no chequea el resultado del fetch ni informa errores
`src/app/admin/documents/AdminDocuments.tsx:17-26`, función `act()`: hace `await fetch(...)` sin capturar la respuesta, sin chequear `res.ok`, sin try/catch, y sin mostrar ningún mensaje de error. Tras el `await`, siempre hace `setBusy(null)` y `router.refresh()` — es decir, si el approve/reject falla (401 por sesión expirada, 500 del servidor, network error), la UI vuelve a su estado normal como si hubiese funcionado, sin ningún indicio para el admin de que el documento sigue `PENDING_REVIEW`. Es el único de los 12 componentes cliente con `fetch()` que no verifica `.ok` (los otros 11 —`CalendarClient`, `ProfileForm`, `DocsVencimientos`, `CheckinClient`, `DocumentsClient`, `AdminLeavesTable`, `ProfileChangesClient`, `UsersTable`, `EmployeeDetailClient`, `DeliveriesClient`, `ResetPasswordForm`, `SignaturePad`— sí lo hacen).
**Fix**: replicar el patrón ya usado en el resto del código: `const res = await fetch(...); if (!res.ok) { const out = await res.json().catch(()=>({})); setMsg({kind:"err", text: out.error ?? "Error"}); return; }`.

### CQ-6 (MINOR) — `ImageSlot` reimplementado 3 veces
Tres componentes casi idénticos (~50 líneas c/u, ~150 líneas totales) que hacen lo mismo (botón con preview, input file oculto, upload a un endpoint, estado `busy`, manejo de error): `src/app/(app)/profile/ProfileForm.tsx:262-313`, `src/app/(app)/documents/DocsVencimientos.tsx:84-126`, `src/app/admin/employees/[id]/EmployeeDetailClient.tsx:290-346`. Difieren sólo en el endpoint destino (`/api/profile/uploads` vs `/api/admin/employees/${userId}/uploads`) y en detalles menores (prop `contain`, si mantiene estado local `current` o depende del padre, si hay `router.refresh()`). Cualquier fix de UX/accesibilidad (ej. A11Y-1 de la firma, o agregar `alt`/aria) hay que aplicarlo 3 veces y ya divergieron ligeramente entre sí.
**Fix**: extraer a `src/components/ui/ImageSlot.tsx` parametrizado por `endpoint` (o `uploadFn`).

### CQ-7 (MINOR) — Modal a mano reimplementado 3 veces, sin componente `<Modal>` compartido
El shell `<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>` con `onClick={(e) => e.stopPropagation()}` en el hijo para evitar cerrar al click interno se repite en `src/app/admin/users/UsersTable.tsx:225` (modal "Nuevo usuario"), `src/app/admin/users/UsersTable.tsx:299` (modal "Aprobar empleado") y `src/app/admin/documents/AdminDocuments.tsx:77` (modal "Rechazar documento"). Ninguno maneja `Escape` para cerrar, ninguno hace focus-trap (ver hallazgos de A4 accesibilidad, relacionados).
**Fix**: componente `<Modal onClose>` compartido en `src/components/ui/` que centralice overlay + stop-propagation + `Escape` + focus-trap.

### CQ-8 (MAJOR) — Lógica de "aprobación de cambios de perfil" duplicada entre `/api/profile` y `/api/profile/expiry`
Ambos endpoints implementan la misma máquina de estados con código casi idéntico: (1) si el perfil no está completo (`isEmployeeProfileComplete`) → escribir directo; (2) si está completo → comparar valor propuesto vs actual, si no cambió devolver `unchanged`, si ya hay un `ProfileChangeRequest` con status `PENDING` devolver 409, si no crear el `ProfileChangeRequest` + `recordAudit` + `notifyAdmins`. Incluye la misma regla mágica repetida en ambos lugares: el placeholder de libreta sanitaria "sin dato" se representa como fecha `2099-...` en la base y se debe mostrar como string vacío al comparar (`src/app/api/profile/route.ts:172`: `field === "healthCardExpiry" && current.startsWith("2099") ? "" : current`; `src/app/api/profile/expiry/route.ts:38`: la misma condición literal).
**Riesgo concreto**: si se cambia la regla (ej. el año placeholder, o se agrega un nuevo campo con aprobación), hay que recordar tocar los dos archivos — ya es fácil que diverjan (ya difieren en el detalle de qué pasa con múltiples campos a la vez vs uno solo).
**Fix**: extraer un helper compartido, ej. `proposeProfileChange(userId, existingProfile, changesMap)` en `src/lib/profile.ts`, que ambos endpoints llamen con su propio diff de campos.

### CQ-9 (MAJOR) — Cobertura de tests casi nula
`tests/` contiene un único archivo, `leaves.test.ts` (33 líneas, 5 casos), que cubre exclusivamente `isMonday`/`validateVacationRange`/`addDays` de `src/lib/leaves.ts`. No hay ningún test para: los 38 route handlers de `src/app/api/**` (incluyendo flujos críticos como check-in/out, aprobación de dispositivo WebAuthn, aprobación de cambios de perfil, cron de vencimientos), ni para `src/lib/auth.ts`, `webauthn.ts`, `pdf-sign.ts` (firma automática de recibos), `notify.ts`, `email.ts`, `push.ts`, `profile.ts` (`isEmployeeProfileComplete`), `blob.ts`, `audit.ts`. No hay tests de componente/UI (no hay Testing Library ni Playwright instalado). Dado que el runner es `node --test` puro (sin mocks de Prisma configurados), agregar tests de endpoints requeriría antes decidir una estrategia de test DB/mocking — no es trivial, pero hoy la red de seguridad real es cero fuera de `leaves.ts`.
**Fix priorizado**: (1) arreglar CQ-1 primero, (2) agregar tests unitarios para `isEmployeeProfileComplete`, `pdf-sign.ts` y la lógica de cupos de vacaciones/francos (alto riesgo de reglas de negocio silenciosas), (3) evaluar un test de integración liviano contra una DB de test para 2-3 endpoints críticos (checkin/checkout, profile approval).

### CQ-10 (MAJOR) — Esquema de base de datos sin migraciones versionadas
No existe `prisma/migrations/` en el working tree ni en ningún commit del historial de git (`git log --all -- prisma/migrations` no devuelve nada). El único mecanismo de esquema es `prisma db push` (`package.json:db:push`), que aplica el `schema.prisma` directo contra Neon sin generar ni versionar un archivo de migración SQL. Esto significa: sin historial auditable de cambios de esquema, sin posibilidad de rollback declarativo, y riesgo real de pérdida de datos si `db push` decide que un cambio requiere un `DROP`/reset destructivo sin que quede registro de qué se ejecutó y cuándo (aparte del propio commit de `schema.prisma`).
**Fix**: migrar a `prisma migrate dev`/`prisma migrate deploy` con migraciones commiteadas en `prisma/migrations/`, al menos para producción; `db push` puede seguir usándose sólo en el entorno local de desarrollo si se prefiere velocidad de iteración.

### CQ-11 (MAJOR) — Dependencias desactualizadas, incluyendo majors, y 37 vulnerabilidades en el árbol
`pnpm outdated` (corrido en la auditoría) reporta 29 paquetes con versión más nueva disponible, entre ellos majors: `next` 15.5.15→16.2.10, `@prisma/client`/`prisma` 6.19.3→7.8.0, `tailwindcss` 3.4.19→4.3.2, `zod` 3.25.76→4.4.3, `typescript` 5.9.3→6.0.3, `react-day-picker` 9.14.0→10.0.1, `lucide-react` 0.511.0→1.23.0, `@next/mdx` 15.5.15→16.2.10, `@vercel/blob` 1.1.1→2.5.0, `bcryptjs` 2.4.3→3.0.3 (deprecado en su versión actual de types), `nodemailer` 6.10.1→9.0.3, `resend` 4.8.0→6.17.1. `pnpm audit` reporta 37 vulnerabilidades en la resolución de dependencias: 13 high, 18 moderate, 6 low (incluye `nodemailer` <8.0.4 con advisory GHSA-c7w3-x93f-qmm8, `next` con dos advisories de cache-poisoning en middleware/RSC por debajo de 15.5.16, `undici` vía `@vercel/blob`). No hay ningún workflow de CI (`.github/workflows` no existe) que corra `pnpm audit`/Dependabot/Renovate para frenar esto de forma continua — el detalle de severidad y explotabilidad real corresponde a A7 (seguridad), pero desde code-quality el punto es que no hay proceso de actualización, sólo se descubre en auditorías puntuales.
**Fix**: al menos actualizar `next` a `>=15.5.16` (parche sin cambio de major, cubre 2 de los advisories de `next`) y `nodemailer` a `>=8.0.4`; evaluar el resto de majors en un sprint dedicado con smoke test manual (no hay tests automatizados que lo cubran, ver CQ-9).

### CQ-12 (MINOR) — Logging no estructurado; fallos de auditoría se silencian
Todo el logging del repo son 19 llamadas a `console.error`/`console.log`/`console.warn`, casi todas para tragar errores de best-effort de notificaciones (`.catch((e) => console.error("[notify] ...", e))`) sin ningún backend de observabilidad (no hay Sentry/Datadog/etc. configurado). El caso más sensible es `src/lib/audit.ts:14-16`: `recordAudit()` envuelve la escritura del log de auditoría en try/catch y, si falla, sólo hace `console.error("[audit] failed", err)` — es decir, si la tabla `AuditLog` no puede escribirse (ej. constraint, timeout), la acción de negocio (aprobar usuario, aprobar dispositivo, cambiar contraseña) sigue adelante igual, y el gap en el trail de auditoría no genera ninguna alerta, sólo una línea de log de Vercel que nadie mira proactivamente.
**Fix**: no es necesario para code-quality resolver observabilidad completa, pero como mínimo documentar la intención (best-effort) con un comentario, y considerar una tabla/mecanismo de "dead letter" para notificaciones y auditorías fallidas si el compliance de RRHH lo requiere.

### CQ-13 (COSMETIC) — Comentarios `eslint-disable` inertes
5 archivos (`SignaturePad.tsx`, `ProfileForm.tsx`, `DocsVencimientos.tsx`, `employees/page.tsx`, `EmployeeDetailClient.tsx`) tienen `// eslint-disable-next-line @next/next/no-img-element` sobre usos de `<img>`. Como no hay ESLint configurado y corriendo (CQ-2), esos comentarios no suprimen nada — son documentación muerta que sugiere una intención ("sabemos que debería ser `next/image` pero lo evitamos a propósito") que hoy no está verificada por ninguna herramienta.
**Fix**: cosmético; se resuelve solo al resolver CQ-2. No requiere acción propia.

### CQ-14 (COSMETIC) — Constante `CLOTHING_SIZES` duplicada
`const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];` está definida igual en `src/app/(app)/profile/ProfileForm.tsx:62` y `src/app/admin/employees/[id]/EmployeeDetailClient.tsx:9`. Bajo riesgo (lista estática, poco cambiante) pero es el tipo de duplicación que si un talle se agrega/quita en un lugar y se olvida en el otro, produce inconsistencia silenciosa entre lo que ve el empleado y lo que ve el admin.
**Fix**: mover a `src/lib/utils.ts` o un `src/lib/constants.ts` y reusar.

### CQ-15 (MINOR) — Cast `as never` para bypassear el tipado de Prisma JSON
`src/lib/audit.ts:11`: `metadata: input.metadata as never` — cast para forzar que un `Record<string, unknown>` entre en el campo `Json` de Prisma. Funciona porque `strict: true` no detecta el `as never` como problema (es un cast explícito), pero es el único punto de todo `src/**` donde se evade el sistema de tipos (no hay `as any` en ningún otro lugar, lo cual es un punto a favor general del repo — ver CQ-17).
**Fix**: usar el tipo `Prisma.InputJsonValue` de `@prisma/client` en la firma de `recordAudit` en vez de `as never`.

### CQ-16 (MINOR) — Scripts operativos no gobernados por `package.json`
`scripts/add-admin.ts` y `scripts/add-test-user.ts` existen en el repo pero no tienen entrada en `package.json` (a diferencia de `db:seed`, `version:bump`, `sync:changelog`, que sí la tienen). Se ejecutan presumiblemente a mano con `tsx scripts/add-admin.ts` con variables de entorno (`NEW_ADMIN_EMAIL`, etc.), sin documentación en el repo (no hay README que los mencione) — cualquier persona nueva en el equipo no sabe que existen ni cómo invocarlos.
**Fix**: agregar entradas `"admin:add": "tsx scripts/add-admin.ts"` etc. al `package.json`, o documentarlos en el README.

### CQ-17 (CORRECT) — TypeScript estricto, sin escapes de tipo, build y typecheck limpios
`tsconfig.json` tiene `strict: true`. `pnpm exec tsc --noEmit` no reporta ningún error. Búsqueda de `: any`, `<any>`, `as any` en todo `src/**` → 0 resultados (el único cast de tipo "peligroso" es el `as never` puntual de CQ-15). `pnpm build` compila sin errores ni warnings de tipo. Buena disciplina de tipado para un proyecto de este tamaño.

### CQ-18 (CORRECT) — Patrón de autorización consistente en endpoints admin
`src/lib/admin-guard.ts` expone `requireAdmin()`, que centraliza el chequeo de sesión + rol `ADMIN` y devuelve un `NextResponse` 401 uniforme. Se usa de forma consistente en los endpoints bajo `/api/admin/**`. Reduce el riesgo de un endpoint admin que se olvide de chequear el rol (relevante para la hipótesis de riesgo de autorización marcada en `01_APP_UNDERSTANDING.md`, a profundizar en A7/A1 con casos concretos, pero desde code-quality el patrón en sí es sólido).

### CQ-19 (CORRECT) — Validación de entrada consistente con Zod
Los endpoints que reciben body (`/api/profile`, `/api/profile/expiry`, `/api/leaves`, `/api/register`, `/api/password/change`, etc.) siguen un patrón uniforme: `schema.safeParse(await req.json().catch(() => ({})))` → si falla, `NextResponse.json({ error, details }, { status: 400 })` con forma de error consistente. El `.catch(() => ({}))` en el `req.json()` también evita que un body malformado tire una excepción no controlada antes de llegar al `safeParse`. Buen patrón, reusado sin fricción entre módulos.

## Conteo por severidad

| Severidad | Cantidad |
|---|---|
| BLOCKER | 0 |
| CRITICAL | 1 |
| MAJOR | 7 |
| MINOR | 6 |
| COSMETIC | 2 |
| CORRECT | 3 |
| **Total** | **19** |
