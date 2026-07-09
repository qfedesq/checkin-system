# A2 — UX/UI QA · Emmalva Checkin System

Fecha: 2026-07-08 · Alcance: `src/app/**`, `src/components/**` · Método: revisión estática de código (la app no corre en local en este entorno) + heurística de Nielsen + comparación contra el design system (`src/app/globals.css`). Report-only, no se modificó código de la app.

Fuentes previas usadas como punto de partida y verificadas contra el código: `qa/2026-07-08/discovery/D3_design.md`, `qa/2026-07-08/discovery/D2_product.md`, `qa/2026-07-08/01_APP_UNDERSTANDING.md`.

---

## 1. Resumen ejecutivo

El sistema de diseño (`globals.css`) es sólido, consistente y bien tokenizado (HSL semántico, dark/light sin FOUC, tipografía propia). La debilidad de la auditoría no está en el "look" sino en el **feedback de las acciones**: varias acciones administrativas irreversibles (deshabilitar usuario, rechazar dispositivo, rechazar licencia/franco, rechazar cambio de perfil) se disparan con un solo clic, sin confirmación, y en un caso (`AdminDocuments.act`) sin manejo de errores de red en absoluto. Se encontró además un bug de affordance real: en `ProfileChangesClient`, cancelar el `window.prompt()` de motivo de rechazo **no cancela el rechazo** — el motivo queda vacío pero la acción se ejecuta igual.

Conteo por severidad (24 hallazgos, incluye 8 ítems `CORRECT`):

| Severidad | Cantidad |
|---|---|
| Critical | 1 |
| High | 2 |
| Medium | 8 |
| Low | 5 |
| Info | 8 |

---

## 2. Hallazgos — acciones y manejo de errores

### UX-1 · Critical — `AdminDocuments.act()` no maneja errores de red/servidor
`src/app/admin/documents/AdminDocuments.tsx:17-26`. La función `act()` hace `await fetch(...)` sin `try/catch` y sin revisar `res.ok`; si el endpoint devuelve 4xx/5xx la UI simplemente limpia `busy` y llama `router.refresh()` como si hubiese funcionado. Es el único componente de la app sin ningún manejo de error (todos los demás `act()`/`post()` similares chequean `res.ok`). Un rechazo de "aprobar documento" que falla en el servidor queda indistinguible de un éxito para el admin.
**Recomendación**: agregar `try/catch` + chequeo de `res.ok` + banner de error, igual que `AdminLeavesTable.tsx`. **Effort**: S.

### UX-2 · High — Cancelar el `window.prompt()` de motivo no cancela el rechazo
`src/app/admin/profile-changes/ProfileChangesClient.tsx:46-51`:
```
const note = window.prompt("Motivo del rechazo (opcional):") ?? "";
body = JSON.stringify({ note });
```
`window.prompt` devuelve `null` si el admin toca "Cancelar", pero `?? ""` lo convierte en string vacío y el código sigue adelante con el `fetch` de rechazo. El admin que abre el prompt y decide no rechazar (clic en Cancelar del diálogo nativo) termina rechazando el cambio de perfil igual, solo que sin motivo. Es un bug de affordance: el botón "Cancelar" del prompt no cancela nada.
**Recomendación**: distinguir `null` (abortar todo el flujo) de `""` (nota vacía explícita). **Effort**: S.

### UX-3 · High — Acciones irreversibles sin ningún paso de confirmación
- "Deshabilitar" usuario — `src/app/admin/users/UsersTable.tsx:141-147`, un clic dispara `POST .../disable`.
- "Rechazar dispositivo (borra la credencial)" — `UsersTable.tsx:109-115`, un clic borra la credencial WebAuthn registrada; el propio `title` del botón avisa que "borra la credencial" pero solo en el tooltip.
- "Rechazar" vacaciones/franco — `src/app/admin/leaves/AdminLeavesTable.tsx:56`, un clic, sin modal ni motivo.

En contraste, `AdminDocuments.tsx:63-88` sí abre un modal con motivo antes de rechazar. La app no tiene una decisión consistente sobre qué acciones necesitan confirmación explícita — hoy depende de qué pantalla se use.
**Recomendación**: agregar confirmación (modal o `window.confirm` como mínimo) a las 3 acciones listadas. **Effort**: M.

### UX-4 · Medium — Éxito silencioso tras aprobar/rechazar/subir en varias pantallas
No hay confirmación positiva visible tras: aprobar/rechazar en `AdminLeavesTable.tsx:13-20`, aprobar/rechazar en `ProfileChangesClient.tsx:46-63`, subir entrega en `DeliveriesClient.tsx:22-38`, subir documento propio en `DocumentsClient.tsx:32-46`. El único indicio de que la acción funcionó es que la fila desaparece/cambia tras `router.refresh()`. Contrasta con `AdminDocuments`-modal, `ProfileForm` y `EmployeeDetailClient`, que sí muestran un banner ("Ficha guardada", "Solicitud enviada").
**Recomendación**: reusar el patrón de banner de éxito que ya existe en `ProfileForm.tsx:119-131` / `CalendarClient.tsx:87`. **Effort**: M.

### UX-5 · Medium — Fallback de copy `"Error"` genérico, inconsistente con el resto del tono
`AdminLeavesTable.tsx:18`, `ProfileChangesClient.tsx:61`, `CalendarClient.tsx:86`, `CheckinClient.tsx:51,55` caen a la palabra suelta `"Error"` cuando el backend no manda `error` o cuando no hay mensaje capturado. Convive con mensajes mucho más cuidados en el resto de la misma pantalla (p. ej. `CheckinClient.tsx:33` "Registrá primero tu dispositivo.").
**Recomendación**: definir 2-3 fallbacks estándar en español rioplatense ("No pudimos completar la acción. Probá de nuevo.") y reemplazar los `"Error"` sueltos. **Effort**: S.

### UX-6 · Low — Etiqueta técnica "pwd temp" filtrada al copy visible
`src/app/admin/users/UsersTable.tsx:81`: `<span className="badge-primary ml-1">pwd temp</span>`. Es jerga interna abreviada en inglés, en medio de badges por lo demás cuidados y en español ("aprobado", "pendiente", "deshabilitado").
**Recomendación**: renombrar a algo como "clave temporal". **Effort**: S.

### UX-7 · Medium — Doble submit posible en varios botones de `UsersTable` sin `disabled`
`UsersTable.tsx:102-147`: los botones "Aprobar disp." (105), "Rechazar disp." (112 vía `ShieldX`), "Resetear contraseña" (121), "Resetear dispositivo" (136) y "Deshabilitar" (144) **no** tienen atributo `disabled` atado al estado `busy`, a diferencia del botón "Aprobar" de alta pendiente (línea 94, `disabled={busy !== null}`). Un doble clic accidental en, por ejemplo, "Deshabilitar" o "Rechazar disp." puede disparar dos requests concurrentes a una acción irreversible.
**Recomendación**: aplicar `disabled={busy !== null}` de forma consistente a los 5 botones. **Effort**: S.

---

## 3. Hallazgos — estados de carga / vacío / error de sistema

### UX-8 · Medium — No existen `loading.tsx`, `error.tsx` ni `not-found.tsx` en ningún segmento
Verificado por búsqueda en `src/app/**` (49 archivos `.tsx`, cero coincidencias de estos 3 nombres de convención de Next App Router). Ningún segmento tiene skeleton, error boundary ni página 404 dedicada; una excepción no capturada en un Server Component rompe a la pantalla de error genérica de Next.
**Recomendación**: al menos un `error.tsx` global en `src/app/` y uno en `src/app/admin/`. **Effort**: M.

### UX-9 · Medium — `CalendarClient` no comunica el estado de carga inicial
`src/app/(app)/calendar/CalendarClient.tsx:22,30-33`: `data` arranca en `null` y el `fetch` de disponibilidad no tiene indicador visual. Las secciones de saldo de vacaciones (línea 100) y de "Mis solicitudes" (línea 174) están condicionadas a `data &&`, así que mientras resuelve el fetch la pantalla se ve vacía, sin placeholder ni texto "Cargando…", indistinguible de un error silencioso.
**Recomendación**: mostrar un texto/skeleton mínimo mientras `data === null`. **Effort**: S.

---

## 4. Hallazgos — consistencia visual / design system

### UX-10 · Medium — Paleta de estado paralela en `CalendarClient` (no tokenizada)
`CalendarClient.tsx:131-134,164-167` usa HSL crudo (`hsl(19 95% 53%)` para "pendiente", `hsl(142 72% 45%)` para "aprobado", `hsl(1 79% 64%)` para "de otros") en vez de las variables `--success`/`--destructive`/`--accent` de `globals.css:46-91`. El resultado es que "pendiente" se ve **naranja/ámbar** en el calendario pero **cian** (`badge-accent`, `globals.css:260`) en Documentos, Licencias, Usuarios y Entregas — la única pantalla con un sistema de color de estado distinto al resto de la app. No existe token `--warning` en `globals.css:39-100`, que es probablemente la raíz de por qué esta pantalla usó un valor ad hoc en vez de reusar `--accent`.
**Recomendación**: reemplazar los HSL crudos por `hsl(var(--accent))`/`hsl(var(--success))`/`hsl(var(--destructive))`, o formalizar un token `--warning` si se quiere mantener el ámbar. **Effort**: M.

### UX-11 · Low — Patrón de feedback dual: un único toast flotante vs. banner inline en todo el resto
`UsersTable.tsx:170-174,182-183` es el único lugar de la app con un toast flotante con auto-dismiss (`setTimeout`); todas las demás pantallas (`AdminLeavesTable`, `ProfileChangesClient`, `DeliveriesClient`, `DocumentsClient`, `ProfileForm`, `CalendarClient`, `CheckinClient`) usan un banner inline debajo de la acción. No hay un criterio de sistema documentado sobre cuándo usar cada uno.
**Recomendación**: adoptar un solo patrón (el toast es más apto para "contraseña temporal copiada", que necesita persistir tras navegar); documentar la regla. **Effort**: M.

### UX-12 · Medium — Contraseña temporal se expone en texto plano en el toast, sin gesto de "revelar"
`UsersTable.tsx:121-127` (reset de password) y `176-186` (alta de usuario), `EmployeeDetailClient.tsx:127-128`: la contraseña temporal (`Emmalva01` + variantes) se copia al portapapeles automáticamente y además se muestra en claro en un toast visible hasta 9-15 segundos, en una pantalla de admin que puede estar compartida/proyectada. No hay un paso de "click para revelar" ni ocultamiento tras copiar.
**Recomendación**: considerar ocultar el valor por default y mostrar solo "Copiada al portapapeles", revelando el texto solo con un clic explícito. Cross-referencia con el hallazgo de exposición de credenciales de A7 (seguridad). **Effort**: M.

### UX-13 · Medium — Modal reimplementado a mano 4 veces con el mismo patrón
`fixed inset-0 z-50 grid place-items-center bg-black/60 ...` aparece idéntico en `UsersTable.tsx:225` (`CreateUserDialog`), `UsersTable.tsx:299` (`ApproveDialog`), `AdminDocuments.tsx:77` (diálogo de rechazo) y `AppShell.tsx:215` (drawer mobile, con `role="dialog"`). Hoy son visualmente idénticos porque todos comparten `.panel`, pero es duplicación de código real: una actualización de estilo de modal (p. ej. animación de entrada, foco atrapado) tiene que aplicarse a mano en 4 lugares y es fácil que alguno quede desactualizado.
**Recomendación**: extraer un componente `Modal`/`Dialog` genérico en `src/components/ui/`. **Effort**: L.

### UX-14 · Low — Navegación del drawer mobile duplica la del sidebar a mano
`AppShell.tsx:122-146` (sidebar desktop) y `AppShell.tsx:224-249` (drawer mobile) recorren el mismo array `nav` con JSX casi idéntico (mismo `isActive`, mismo badge, misma estructura `Link`) repetido en dos bloques en vez de un subcomponente compartido `NavList`.
**Recomendación**: extraer `NavList` reusable. **Effort**: S.

### UX-15 · Low — Logo con colores hardcodeados fuera de los tokens de tema
`src/components/brand/Logo.tsx:20,22,24,26,28` usa `fill="#29ABE2"` / `"#2B8BB0"` literal en vez de `hsl(var(--primary))`/`hsl(var(--primary-dark))`. Es intencional (identidad de marca fija, coincide con `--primary: 197 77% 53%` de `globals.css:46`), pero significa que el isotipo no reaccionaría a un futuro ajuste de marca hecho solo vía tokens.
**Recomendación**: ninguna acción urgente; documentar como decisión consciente. **Effort**: S.

---

## 5. Hallazgos — copy (español rioplatense)

### UX-16 · Low — No se explica por qué desaparece la opción "14 días"
`CalendarClient.tsx:147-149`: el botón "14 días" simplemente deja de renderizarse (`{leftDays >= 14 && (...)}`) cuando el saldo no alcanza, sin ningún texto que lo explique — a diferencia del bloqueo de saldo insuficiente para 7 días, que sí tiene copy explícito (línea 109: "No te queda saldo de vacaciones este año…").
**Recomendación**: agregar una nota breve ("Necesitás 14 días de saldo para esta opción") cuando `leftDays` está entre 7 y 13. **Effort**: S.

### UX-17 · Low — Botón "Registrando…" genérico para 3 pasos asíncronos distintos
`CheckinClient.tsx:19-58`: el flujo de check-in encadena geolocalización → assertion WebAuthn → request de red bajo un solo texto de botón "Registrando…" (líneas 72,81). Los mensajes de error sí son específicos por etapa (líneas 23,33,40), pero mientras está en curso el usuario no sabe si está esperando el GPS o la huella/Face ID.
**Recomendación**: opcional, texto de botón de dos estados ("Ubicando…" / "Verificando…"). **Effort**: S.

---

## 6. Ítems `CORRECT` (buenas prácticas verificadas)

### UX-18 · CORRECT — Manejo de errores de red robusto en `ProfileForm`
`src/app/(app)/profile/ProfileForm.tsx:100-118` es el único flujo con `try/catch` explícito alrededor del `fetch` (para distinguir fallo de red de error de servidor) y con auto-scroll al mensaje (`msgRef`, líneas 77-82,231). Es el mejor patrón de manejo de errores de la app y debería ser el estándar a replicar en el resto (ver UX-1, UX-4).

### UX-19 · CORRECT — Estados vacíos consistentes y con copy variado
Todas las tablas cubren el caso vacío con `colSpan` centrado y texto natural, no repetitivo: "Sin documentos.", "No hay usuarios todavía.", "Sin solicitudes.", "Sin entregas todavía.", "No hay cambios de perfil para revisar." (`AdminDocuments.tsx:72`, `UsersTable.tsx:159-165`, `AdminLeavesTable.tsx:62`, `DeliveriesClient.tsx:94`, `ProfileChangesClient.tsx:68`).

### UX-20 · CORRECT — Sistema de tokens de color y theming claro/oscuro sólido
`globals.css:39-100` define tokens HSL semánticos completos para ambos modos, sin estilos de tema embebidos en componentes (salvo la excepción ya señalada en UX-10). `.panel`/`.surface-*`/`.btn-*`/`.badge-*` (líneas 133-262) dan una composición uniforme en toda la app.

### UX-21 · CORRECT — Semántica de color de badges consistente entre módulos
`badge-success`/`badge-accent`/`badge-danger` (`globals.css:259-262`) mapean siempre los mismos 3 significados (aprobado=verde, pendiente=cian, rechazado/bloqueado=rojo) en Documentos, Licencias, Usuarios y Entregas — la única excepción es `CalendarClient` (ver UX-10).

### UX-22 · CORRECT — Copy en voseo rioplatense genuino y sin mezcla de registros
No se encontró mezcla con "tú" en ningún archivo revisado. Mensajes de error orientados a la acción, no genéricos: "Firmá en el recuadro antes de guardar" (`SignaturePad.tsx:86`), "No pudimos conectar. Revisá tu conexión e intentá de nuevo." (`ProfileForm.tsx:110`), "Registrá primero tu dispositivo." (`CheckinClient.tsx:33`).

### UX-23 · CORRECT — Fix de zoom iOS y safe-areas correctamente implementados
`globals.css:287-297` fuerza `font-size:16px` en inputs bajo 640px (evita el auto-zoom de iOS, documentado inline como fix para el navegador in-app de WhatsApp) y `AppShell.tsx:99,175,217` aplican `env(safe-area-inset-*)` en topbar, bottom-nav y drawer.

---

## 7. Cobertura de flujos críticos (de los 15 de D2)

| # | Flujo | Cubierto en |
|---|---|---|
| 1 | Login + biometría | UX-5, UX-17, UX-22 |
| 2 | Registro de dispositivo | (sin hallazgos nuevos; `EnrollButton.tsx` sigue el patrón correcto banner+redirect) |
| 3 | Check-in/out | UX-17, UX-22 |
| 4 | Solicitud de vacaciones | UX-9, UX-10, UX-16 |
| 5 | Solicitud de franco | UX-9, UX-10 |
| 6 | Cambio de perfil c/aprobación | UX-2, UX-4, UX-18 |
| 7 | Carga de documentos frente/dorso | UX-4 (upload silencioso) |
| 8 | Apertura de recibo con firma | sin UI compleja (redirect); sin hallazgos |
| 9 | Alta de usuario por admin | UX-3, UX-7, UX-12, UX-13 |
| 10 | Aprobación/rechazo de dispositivo | UX-3, UX-7 |
| 11 | Aprobación de vacaciones/francos | UX-3, UX-4, UX-5 |
| 12 | Export de horas a Excel | sin hallazgos de UI (descarga directa) |
| 13 | Bloqueo por vencimiento / desbloqueo | UX-18 (positivo, vía `EmployeeDetailClient`) |
| 14 | Aprobación de alta pendiente | UX-13 |
| 15 | Aprobación/rechazo de documentación | UX-1, UX-13 |

Los 15 flujos quedan cubiertos por al menos un hallazgo o una verificación positiva explícita.
