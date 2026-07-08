# A1 — Auditoría funcional (QA report-only)

Fecha: 2026-07-08 · Método: análisis estático trazando los 15 flujos críticos por código (`src/app/api/**`, `src/app/**`, `src/lib/**`) + ejecución de `pnpm test` y `pnpm build`. No se modificó código de la app, no se mutó producción, no se corrió la app local (requiere DB Neon viva). Los hallazgos que dependen de comportamiento en runtime real (timing de race conditions, comportamiento exacto de un navegador/PWA) están marcados `confidence: medium|low`; los verificados por ejecución directa (`pnpm test`, `pnpm build`) o por lectura de código 100% determinística están en `high`.

## Resumen ejecutivo

La app tiene una arquitectura de autorización consistente a nivel de **endpoint** (todo `/api/admin/**` exige `requireAdmin()`, ownership bien chequeado en `deliveries/[id]/open`, binding de dispositivo WebAuthn correcto) y una lógica de negocio de vacaciones/francos (`src/lib/leaves.ts`) sólida y UTC-consistente. El problema principal no está en "¿falta un check de rol?" sino en tres capas más sutiles, exactamente las que anticipaba la hipótesis de riesgo de Fase 1:

1. **Sesión JWT stateless que nunca se revalida contra la DB** (FUN-1/FUN-2/FUN-23): deshabilitar una cuenta —a mano o automáticamente por vencimiento de documentación— no tiene efecto sobre una sesión ya emitida. Esto es el hallazgo más grave: la función de negocio "bloqueo por vencimiento" (flujo 13) queda parcialmente cosmética para cualquiera que ya esté logueado.
2. **La biometría de login es una ceremonia del cliente, no una condición del servidor** (FUN-3): el cookie de sesión completa se establece con el primer factor (password) antes de correr el challenge WebAuthn.
3. **Timezone**: el módulo de fechas-calendario (`leaves.ts`/`utils.ts`) está bien resuelto, pero dos lugares fuera de ese módulo (dashboard admin "hoy", export de horas) mezclan getters de hora local del proceso con la convención UTC/Argentina del resto de la app, produciendo ventanas de 2-3 horas mal clasificadas — justo la hipótesis #5 de discovery, confirmada.

A nivel de reglas de negocio con estado compartido (cupos de vacaciones/francos, aprobación de solicitudes), el patrón dominante es "leer-validar-escribir" sin transacción ni constraint único, así que hay ventanas de carrera reales ante doble-submit o dos admins actuando en paralelo (FUN-5/FUN-6/FUN-7/FUN-8). Ninguna de ellas es explotable para escalar privilegios; son bugs de consistencia de datos/UX, no brechas de autorización.

`pnpm build` compila limpio (37/37 rutas, exit 0). `pnpm test` falla 1/5 — causa confirmada por ejecución: el test usa getters de fecha locales contra fechas construidas en UTC (bug del test, no del producto). Ver FUN-16/FUN-17.

## Catálogo de flujos (los 15) con veredicto

| # | Flujo | Archivos clave | Veredicto | Hallazgos |
|---|---|---|---|---|
| 1 | Login + biometría | `src/lib/auth.ts`, `LoginForm.tsx`, `webauthn/authenticate/*` | MODIFY | FUN-3, FUN-23 (parcial correct) |
| 2 | Registro de dispositivo | `setup-biometrics/EnrollButton.tsx`, `webauthn/register/*` | CORRECT | FUN-20 |
| 3 | Check-in / check-out | `CheckinClient.tsx`, `attendance/checkin`, `attendance/checkout` | MODIFY | FUN-1, FUN-2 |
| 4 | Solicitud de vacaciones | `CalendarClient.tsx`, `api/leaves`, `lib/leaves.ts` | IMPROVE | FUN-5, FUN-21 (correct la lógica, improve la concurrencia) |
| 5 | Solicitud de franco | idem | IMPROVE | FUN-5, FUN-21 |
| 6 | Cambio de perfil con aprobación | `ProfileForm.tsx`, `api/profile`, `api/profile/expiry` | CORRECT | FUN-22 |
| 7 | Carga de documentos frente/dorso | `DocumentsClient.tsx`, `api/documents/upload`, `api/profile/uploads` | MODIFY | FUN-4 |
| 8 | Apertura de recibo con firma | `api/deliveries/[id]/open`, `lib/pdf-sign.ts`, `lib/blob.ts` | IMPROVE | FUN-8, FUN-19 (correct ownership) |
| 9 | Alta de usuario por admin | `UsersTable.tsx`, `api/admin/users` | CORRECT | FUN-18 |
| 10 | Aprobación/rechazo de dispositivo | `api/admin/users/[id]/{approve-device,reject-device}` | CORRECT | FUN-18 |
| 11 | Aprobación de vacaciones/francos | `AdminLeavesTable.tsx`, `api/admin/leaves/[id]/*` | MODIFY | FUN-6 |
| 12 | Export de horas a Excel | `AttendanceClient.tsx`, `api/attendance/export` | MODIFY | FUN-11 |
| 13 | Bloqueo por vencimiento (auto) + desbloqueo | `api/cron/expiry-check`, `api/admin/users/[id]/enable` | MODIFY | FUN-1, FUN-2, FUN-13 |
| 14 | Aprobación de alta pendiente | `api/admin/users/[id]/approve`, `/pending` | IMPROVE (dead code) | FUN-12 |
| 15 | Aprobación/rechazo de documentación | `AdminDocuments.tsx`, `api/admin/documents/[id]/*` | MODIFY | FUN-7, FUN-7b |

Transversal (no es "un flujo" pero atraviesa varios): dashboard admin "hoy" → FUN-10.

## Narrativa por flujo

### 1. Login + verificación biométrica
`LoginForm.tsx` llama `signIn("credentials", {redirect:false})`; next-auth ya fija la cookie de sesión JWT completa en esa llamada. El challenge WebAuthn que sigue (`/api/webauthn/authenticate/options` → `startAuthentication` → `/verify`) es, en el código actual, un paso adicional del **cliente**: si falla, el cliente llama a `/api/auth/signout` para "deshacer" la sesión, pero nada en el servidor exige que ese assertion haya ocurrido para que la sesión sea válida fuera de `/checkin`. `middleware.ts` sólo exige `hasWebauthn` (que el usuario tenga *algún* device enrolado alguna vez), no que la sesión actual haya pasado un challenge. Ver FUN-3. En contraste, el rechazo de logins nuevos para cuentas `DISABLED` (`auth.ts:64`) y para cuentas no-`ACTIVE` en `webauthn/authenticate/options` (línea 13) está bien implementado — FUN-23.

### 2. Registro de dispositivo (setup-biometrics)
`register/verify` crea el `WebAuthnCredential`, calcula `deviceId = sha256(credentialId)`, rechaza colisión con otro usuario (409) y decide auto-aprobación (ADMIN) vs pendiente (EMPLOYEE) correctamente. `authenticate/verify` valida ownership de la credencial y coincidencia de deviceId. Sin hallazgos — FUN-20.

### 3. Check-in / check-out
`checkin/route.ts` valida sesión, body con zod, `deviceApprovedAt`, jornada abierta duplicada (409) — pero nunca lee `User.status`. `checkout/route.ts` ni siquiera consulta `deviceApprovedAt`. Combinado con el stateless-JWT de FUN-1, esto es la vía concreta por la que un empleado deshabilitado sigue operando. Ver FUN-1, FUN-2.

### 4/5. Solicitud de vacaciones / franco
`src/lib/leaves.ts` es el módulo más prolijo de la app: `isMonday`, `validateVacationRange`, `rangesOverlap`, `monthBounds`/`yearBounds`, `vacationBalance`, todo en UTC consistente. `POST /api/leaves` aplica correctamente: inicio-lunes, 7|14 días, sin solapamiento propio, saldo anual, cupo semanal 1 chofer+1 ayudante (vía `category`), y para franco: exclusividad diaria + máximo 1/mes. El único gap es de concurrencia: todo el flujo es `findFirst` → validar → `create`, sin transacción ni `@@unique` en el schema que respalde esas invariantes a nivel DB — dos requests casi simultáneos pueden ambos pasar validación antes de que el primer `create` se persista. Ver FUN-5.

### 6. Cambio de perfil con aprobación
Tres caminos bien diferenciados y correctos: alta directa (sin perfil previo), primera carga sobre placeholder (directa, vía `isEmployeeProfileComplete`), y edición sobre perfil completo (diff campo por campo, bloqueo si ya hay un `ProfileChangeRequest PENDING`, 409). CUIL/legajo/fecha de ingreso/email correctamente fuera de lo que el empleado puede tocar. `api/profile/expiry` replica el mismo patrón para un solo campo. Ver FUN-22.

### 7. Carga de documentos frente/dorso
Dos rutas separadas y razonables: `documents/upload` (metadata+vencimiento, va a aprobación) y `profile/uploads` (fotos, directo). Ambas validan tipo MIME y tamaño. El gap real no es de lógica sino de exposición: todo termina en Vercel Blob con `access:"public"` (`lib/blob.ts`), así que el DNI/carnet/libreta/firma de cualquier empleado queda accesible sin auth para quien tenga la URL. Ver FUN-4 (severidad CRITICAL, PII sensible).

### 8. Apertura de recibo con firma automática
Ownership correctamente chequeado (`recipientId === session.user.id || ADMIN`). El flujo de firma (`pdf-sign.ts`: hash SHA-256, bloque con nombre/CUIL/timestamp, imagen de firma opcional) es correcto. Gap menor de concurrencia: dos aperturas casi simultáneas antes de que se persista `signedBlobUrl` pueden firmar y subir el PDF dos veces. Ver FUN-8, FUN-19.

### 9/10. Alta de usuario por admin / aprobación de dispositivo
`api/admin/users` valida unicidad de email/legajo, genera password temporal fija (`Emmalva01`, pedido explícito del cliente) con `mustChangePassword=true`. `approve-device`/`reject-device` validan estado previo (400/409) antes de mutar. Todo bajo `requireAdmin()`. Sin hallazgos nuevos más allá de FUN-18 (cobertura confirmada, no sólo en estas dos rutas sino en las 16 rutas admin).

### 11. Aprobación de vacaciones/francos
La única validación de negocio al aprobar un franco (colisión con otro franco ya `APPROVED` ese día) está bien hecha. Lo que falta es un guard de estado: ni approve ni reject verifican que la solicitud siga `PENDING` antes de mutar (contrastar con `profile-changes/approve` que sí lo hace). Esto abre una ventana de carrera entre dos admins y permite revertir decisiones ya tomadas sin aviso. Ver FUN-6.

### 12. Export de horas a Excel
Genera el workbook correctamente (legajo, nombre, fechas, duración, coordenadas). El bug es de parseo de fecha: `from` se interpreta como UTC-medianoche (fecha-only ISO string) pero `to + "T23:59:59"` se interpreta en hora local del proceso (sin sufijo de zona) — para un runtime en UTC eso equivale a las 20:59:59 hora Argentina, recortando ~3 horas del día final del reporte. Para un reporte usado como insumo de horas trabajadas, esto es una pérdida de datos silenciosa. Ver FUN-11.

### 13. Bloqueo por vencimiento (auto) + desbloqueo (manual)
`cron/expiry-check` calcula correctamente vencimientos (con placeholder 2099 excluido), evita re-notificar el mismo día, y bloquea (`status=DISABLED`, `disabledReason`) al día siguiente del vencimiento — la lógica de *cuándo* bloquear es correcta. El problema es lo que pasa *después*: como se documenta en FUN-1/FUN-2, ese `DISABLED` en DB no tiene ningún mecanismo que fuerce a la sesión JWT ya emitida a enterarse. `enable` (desbloqueo manual) es simple y correcto, pero no hay guard contra que un admin se deshabilite a sí mismo o deje el sistema sin ningún admin activo (FUN-13).

### 14. Aprobación de alta de empleado (registro pendiente)
El endpoint (`admin/users/[id]/approve`) es correcto (transacción, valida legajo único, crea perfil placeholder si falta). El problema es que es inalcanzable en el estado actual del producto: `POST /api/register` devuelve 410 siempre, y `POST /api/admin/users` (la única vía de alta) crea usuarios `ACTIVE` directamente, nunca `PENDING_APPROVAL`. Todo el aparato de `/pending`, el badge "pendiente" en `UsersTable`, y los contadores de `admin/layout.tsx`/`admin/page.tsx` para este estado son código vivo pero funcionalmente muerto. Ver FUN-12.

### 15. Aprobación/rechazo de documentación
Mismo gap de guard de estado que en leaves (FUN-6): ni approve ni reject de `DocumentUpload` verifican `status === "PENDING_REVIEW"` antes de mutar. Además, a diferencia de todos los demás paneles admin del código (`AdminLeavesTable`, `ProfileChangesClient`, `UsersTable`, `EmployeeDetailClient`, `DeliveriesClient`), `AdminDocuments.tsx` no revisa `res.ok` tras el fetch de aprobar/rechazar: si el request falla, la UI igual refresca como si hubiese funcionado. Ver FUN-7, FUN-7b.

## `pnpm test` — 1/5 falla, causa confirmada

Ejecutado en este entorno (TZ local `America/Argentina/Buenos_Aires`, offset UTC-3):

```
not ok 2 - validateVacationRange: lunes + 7 días
  Expected values to be strictly equal: 0 !== 1  (r.start.getDay())
```

Causa raíz: `tests/leaves.test.ts:14` llama `r.start.getDay()` — un getter de **hora local** — sobre una fecha que `parseLocalDate`/`validateVacationRange` construyó con `Date.UTC(...)` (medianoche UTC del lunes 20/04/2026). En UTC-3, esa medianoche UTC cae el domingo 19 a las 21:00 hora local, así que `getDay()` devuelve 0 (domingo) en vez de 1 (lunes). La lógica de negocio en `src/lib/leaves.ts` no tiene este bug — usa `getUTCDay()` de punta a punta (ver el test #1 de la misma suite, que sí pasa, porque compara con `getUTCDay()` indirectamente vía `isMonday`). Es un test desactualizado post-migración a UTC, no un bug de producto. Fix sugerido en FUN-16.

## `pnpm build`

Exit code 0, 37/37 rutas generadas. Aparece un warning de webpack sobre una API de Node (`setImmediate`) no soportada en Edge Runtime, con traza hacia el bundle de `Middleware` (por la importación transitiva de `@prisma/client` a través de `src/lib/auth.ts`). Es sólo informativo — el build no falla y el middleware sigue corriendo en Node runtime (no Edge) según la config del proyecto. Ver FUN-17.

## Notas de alcance

- No se ejecutó la app contra una DB real ni se realizaron requests que escriban datos en producción; todos los hallazgos de lógica de negocio y autorización provienen de lectura de código, con `confidence` ajustado según cuán determinística es la conclusión.
- Los hallazgos de exposición de PII (FUN-4) y de sesión stateless (FUN-1) se solapan con la hipótesis de riesgo #1/#2 de la fase de discovery (D2/01_APP_UNDERSTANDING.md) y con el scope típico de una auditoría de seguridad (A7); se incluyen aquí porque afectan directamente la corrección funcional de los flujos 3 y 13, pero no deberían tratarse como "ya cubiertos" sólo por A1.
