# A8 — Data & State Integrity (Auditoría, report-only)

**Proyecto:** Emmalva "Checkin System" · **Fecha:** 2026-07-08 · **Método:** lectura de `prisma/schema.prisma`, los ~37 route handlers bajo `src/app/api/**` (foco en escrituras a DB), `src/lib/leaves.ts`, `src/lib/profile.ts`, `src/lib/audit.ts`, `src/lib/blob.ts`, `src/lib/auth.ts`, `src/middleware.ts`, los 2 crons, y los componentes cliente que disparan mutaciones (`router.refresh()`). Sin modificaciones al código ni a datos de producción. Se leyeron primero `01_APP_UNDERSTANDING.md`, `discovery/D1_architecture.md` y, al detectar solapamiento, también `audits/A1_functional.findings.json` para no duplicar severidad sin aportar valor.

## Cómo leer este reporte

Varias de las condiciones de carrera y gaps de sincronización que pedía el scope de A8 ya habían sido detectados de forma independiente por A1 (functional) durante su revisión de flujos. Donde eso ocurre, se marca explícitamente "ya reportado en A1" y se mantiene la misma severidad (no se infla ni se duplica el conteo real de bugs distintos del sistema); A8 aporta el ángulo de esquema/DB (¿hay o no una barrera a nivel Postgres detrás del bug de aplicación?) y agrega hallazgos nuevos no cubiertos por A1 (DATA-2, DATA-4, DATA-7, DATA-8, DATA-9, y los tres CORRECT de esquema).

## Resumen ejecutivo

El sistema tiene **un gap estructural** (JWT stateless sin revalidación de `status`/`role` contra la DB) que neutraliza en la práctica los dos flujos de bloqueo de cuenta (manual y por vencimiento automático) durante hasta ~30 días — ya reportado como BLOCKER en A1, corroborado aquí. Más allá de eso, el hallazgo propio más importante de esta auditoría es que **el cupo semanal de vacaciones (1 chofer + 1 ayudante) nunca se re-valida en el momento de aprobar** una solicitud de tipo VACATION — sólo se valida al crearla, y sólo contra otras ya `APPROVED`. Esto no requiere ninguna condición de carrera: un admin aprobando dos solicitudes PENDING solapadas de la misma categoría, en momentos distintos, sin ninguna prisa, puede violar la regla de negocio de forma determinística.

El resto de los hallazgos nuevos son de menor severidad: una condición de carrera real (pero de bajo impacto operativo, sin reparación posible desde la UI) en el doble check-in, el riesgo ya conocido de `prisma db push` sin migraciones materializado en placeholders sentinela duplicados en dos archivos, y algunos gaps de manejo de excepciones (P2002 no capturado) que degradan a un 500 genérico pero no corrompen datos. En el otro extremo, tres aspectos de diseño de esquema están **correctamente implementados**: el filtrado de sentinelas fuera de documentos legales/notificaciones, las cascadas `onDelete`, y la protección de unicidad de dispositivo/push vía constraints DB + upsert.

## Conteo por severidad

| Severidad | Cantidad |
|---|---|
| BLOCKER | 1 |
| CRITICAL | 1 |
| MAJOR | 5 |
| MINOR | 3 |
| COSMETIC (correcto) | 3 |
| **Total** | **13** |

## Hallazgos

### DATA-1 — BLOCKER · JWT stateless: DISABLED y bajas de rol no se revalidan contra la DB
*Ya reportado en A1 (FUN-1/FUN-2).* `middleware.ts` gatea 100% sobre los claims del JWT (`status`, `role`); no hay ninguna rama para `DISABLED` (sólo para `PENDING_APPROVAL`), y `requireAdmin()` lee `role` del mismo token. Ni `attendance/checkin`, `checkout`, `webauthn/authenticate/verify` ni ningún endpoint mutante vuelve a consultar `User.status` en DB. Un empleado deshabilitado (manual o por vencimiento automático) o un admin degradado conserva acceso funcional completo hasta que el JWT expire (~30 días por defecto). Neutraliza los flujos "bloqueo por vencimiento" y "deshabilitar cuenta".
**Recomendación:** token versioning / epoch en `User` comparado en cada request sensible, o revalidación de `status` en middleware, o `session.maxAge` mucho más corto.

### DATA-2 — CRITICAL · El cupo semanal de vacaciones no se revalida al aprobar (hallazgo nuevo)
`admin/leaves/[id]/approve` sólo re-chequea colisión para `DAY_OFF`; para `VACATION` hace `update()` directo sin volver a validar el cupo por categoría (1 chofer + 1 ayudante) ni el saldo anual. Como el chequeo de creación (`leaves/route.ts`) sólo compara contra solicitudes ya `APPROVED`, dos solicitudes `PENDING` solapadas de la misma categoría pasan ambas ese filtro sin problema. El admin puede entonces aprobarlas secuencialmente — sin ninguna carrera de por medio — violando la regla de negocio de forma determinística.
**Recomendación:** repetir la consulta `categoryOverlap` (contra `APPROVED`) también en el approve de `VACATION`, devolviendo 409 si hay colisión.

### DATA-3 — MAJOR · Reglas de licencias con check-then-insert, sin transacción ni constraint DB
*Ya reportado en A1 (FUN-5).* Cupo semanal, franco 1/mes, exclusividad diaria de franco y saldo anual se validan con una secuencia de `findFirst`/`findMany` seguida de un `create()` sin `$transaction` ni aislamiento serializable. `LeaveRequest` sólo tiene índices no-únicos. Doble submit o dos empleados de la misma categoría casi simultáneos pueden ambos superar los chequeos.
**Recomendación:** transacción serializable o lock lógico por (categoría, semana)/(usuario, mes).

### DATA-4 — MAJOR · Doble check-in puede crear dos jornadas abiertas sin forma de repararlas (hallazgo nuevo)
`attendance/checkin` hace `findFirst({checkOutAt:null})` y luego `create()` sin transacción ni índice único parcial. Un doble-tap o reintento de red puede crear dos `Attendance` abiertas para el mismo usuario; `checkout` sólo cierra la más reciente (`orderBy checkInAt desc`), dejando la más vieja abierta para siempre. `admin/attendance` es de sólo lectura — no hay ninguna acción para cerrar manualmente una jornada huérfana, así que el registro queda corrupto hasta una intervención directa en la DB, contaminando el export a Excel y el KPI "jornadas abiertas".
**Recomendación:** índice único parcial (`WHERE "checkOutAt" IS NULL`) o `SELECT ... FOR UPDATE`; agregar una acción admin de cierre manual.

### DATA-5 — MAJOR · Approve/reject de licencias no valida que sigan PENDING
*Ya reportado en A1 (FUN-6).* A diferencia de `profile-changes/[id]/approve` (que sí valida `status !== "PENDING"` → 409), los endpoints de leaves hacen `update()` directo. Dos admins pueden aprobar/rechazar la misma solicitud casi en simultáneo (last-write-wins) o re-decidir una ya resuelta, agravando DATA-2.
**Recomendación:** `update({where:{id,status:"PENDING"}})` + capturar P2025 → 409, igual que en profile-changes.

### DATA-6 — MAJOR · "Hoy" del dashboard admin en hora local del proceso, no en hora de Argentina
*Ya reportado en A1 (FUN-10).* `admin/page.tsx` construye `todayStart/todayEnd` con getters locales de `Date`, sin ninguna llamada UTC explícita (a diferencia de `leaves.ts`, que usa `Date.UTC`/`getUTCDay` de forma consistente). Sólo "funciona" porque el runtime de Vercel usa UTC como TZ de proceso por defecto — es un supuesto implícito y frágil, no forzado por código. Check-ins entre las 21:00–23:59 ART caen en el día calendario incorrecto en la torta/mini-calendario del admin.
**Recomendación:** calcular explícitamente en `America/Argentina/Buenos_Aires`, igual que `formatDate`/`formatDateTime`.

### DATA-7 — MAJOR · `prisma db push` sin migraciones ya obligó a sentinelas duplicados (hallazgo nuevo)
No hay carpeta `prisma/migrations`; el esquema se sincroniza directo a Neon sin historial ni rollback. Evidencia concreta: los placeholders `dob=1970-01-01`, `cuil="PENDING-..."`, `healthCardExpiry=2099-12-31` (necesarios porque `EmployeeProfile` tiene esas columnas `NOT NULL`) están duplicados palabra por palabra en `admin/users/route.ts` y `admin/users/[id]/approve/route.ts` — sin `prisma migrate`, no hay un script de backfill versionado y único, así que la lógica de "qué placeholder usar" vive repetida en dos endpoints que deben mantenerse sincronizados a mano.
**Recomendación:** migrar a `prisma migrate deploy`; centralizar la creación de perfiles-placeholder en una única función compartida.

### DATA-8 — MINOR · Approve de ProfileChangeRequest no verifica que el perfil no haya cambiado desde la propuesta (hallazgo nuevo)
`profile-changes/[id]/approve` aplica `changes[field].to` directo sin comparar contra el valor actual del perfil (no valida que `existing[field]` siga siendo `changes[field].from`). Si el perfil cambió por otra vía entre la propuesta y la aprobación (p.ej. `admin/employees/[id]` PUT), la aprobación puede pisar silenciosamente un cambio más reciente. El check-then-create de "ya tenés cambios pendientes" en `profile/route.ts` usa un índice no-único, dejando una ventana de carrera teórica bajo doble submit muy rápido — A1 (FUN-22) evaluó este flujo en su conjunto como correcto, por lo que aquí se marca como riesgo menor/teórico, no como regresión.
**Recomendación:** comparar contra `from` antes de aplicar; marcar como conflictivo si difiere.

### DATA-9 — MINOR · Colisiones de unicidad sin manejo de excepción en la ruta de alta de perfil propio (hallazgo nuevo)
`profile/route.ts` (alta inicial de perfil, POST del empleado) escribe `cuil` sin pre-chequeo de colisión (a diferencia de `admin/employees/[id]` que sí lo hace), confiando sólo en el `@unique` de schema. Una colisión real lanza P2002 no capturado → 500 genérico sin mensaje útil. La integridad de datos está protegida por el constraint, pero la UX de error es opaca.
**Recomendación:** try/catch + `error.code === "P2002"` → 409 con mensaje claro.

### DATA-10 — MINOR · PII (GPS + identidad) en el Excel de asistencia, correctamente gateado a ADMIN
El export de `attendance/export` incluye coordenadas GPS de 5 decimales junto con legajo/nombre/email, pero el endpoint está bien restringido a `requireAdmin()`. El riesgo de exposición más severo de PII (blobs de DNI/carnet/libreta/firma con `access:"public"`) ya está documentado como CRITICAL en A1 (FUN-4); no se duplica severidad, se registra por completitud del bullet PII del scope A8.
**Recomendación:** ninguna específica de A8 (ver A1/FUN-4); opcionalmente truncar precisión de coordenadas en el export.

### DATA-11 — COSMETIC/CORRECTO · Sentinelas filtrados consistentemente de UI, PDF firmado y lógica de cron
`cuil` "PENDING-" y `healthCardExpiry` 2099 se ocultan en la UI de perfil/admin, se reemplazan por "—" antes de firmar un PDF de entrega (evitando que un sentinela quede grabado en un documento legal), y el cron de vencimientos usa un `PLACEHOLDER_YEAR` explícito para excluirlos de notificaciones y auto-bloqueo. No se encontró ninguna fuga.
**Nota:** la constante/lógica de detección está duplicada en ≥3 archivos — vale centralizarla, sin ser un bug de datos.

### DATA-12 — COSMETIC/CORRECTO · Cascadas `onDelete` consistentes; no existe ruta de borrado de User
Todas las relaciones hijas de `User` usan `onDelete: Cascade`; `AuditLog.actor` usa `SetNull` para preservar el historial. No se encontró ningún `.delete()`/`.deleteMany()` sobre `User` en el código — las "bajas" son siempre `status: DISABLED`. Las cascadas están listas pero hoy son código muerto en la práctica.

### DATA-13 — COSMETIC/CORRECTO · Unicidad de dispositivo/credencial/push resuelta con constraints DB + upsert
`User.deviceId`, `WebAuthnCredential.credentialId` y `PushSubscription.endpoint` son `@unique`; `push/subscribe` usa `upsert()` evitando el patrón check-then-insert directamente. Bajo una carrera genuina de registro de dispositivo, el peor caso es un 500 no manejado (mismo patrón que DATA-9), nunca una fila duplicada o un estado de dispositivo inconsistente.

## Cobertura del scope solicitado

- **Integridad esquema/migraciones:** cubierto — DATA-7.
- **Validación en boundaries / unicidad / TOCTOU:** cubierto — DATA-2, DATA-3, DATA-9, DATA-13.
- **Condiciones de carrera / concurrencia (vacaciones, cupo, aprobaciones, doble check-in):** cubierto — DATA-2, DATA-3, DATA-4, DATA-5, DATA-8.
- **Sync estado cliente/servidor (JWT, router.refresh):** cubierto — DATA-1; `router.refresh()` se usa de forma consistente tras toda mutación relevante en los componentes cliente revisados (`CalendarClient`, `ProfileForm`, `DocsVencimientos`, `AdminLeavesTable`, `UsersTable`, `AdminDocuments`, `EmployeeDetailClient`, `DeliveriesClient`) — no se encontró ningún caso de mutación exitosa sin refresh posterior.
- **Persistencia y zona horaria (UTC vs Argentina, cron):** cubierto — DATA-6; `leaves.ts` y los crons son UTC-consistentes (confirmado, ver DATA-11 y A1/FUN-21); el único punto no explícito es el dashboard admin (DATA-6).
- **PII (DNI/CUIL/domicilio/geolocalización, Excel, blobs públicos):** cubierto — DATA-10, DATA-11 (referencia cruzada a A1/FUN-4 para el hallazgo de mayor severidad).
- **Cascadas onDelete / orfandad:** cubierto — DATA-12.
