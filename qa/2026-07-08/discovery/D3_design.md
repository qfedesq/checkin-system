# D3 — Design System Auditor (Discovery, report-only)

Fecha: 2026-07-08 · Alcance: `src/components/**`, `src/app/globals.css`, patrones de UI en `src/app/**/*.tsx`. No se modificó código.

---

## 1. Design system (tokens / clases)

**Tokens de color** — HSL vía CSS variables en `:root` (light) y `.dark` (dark), en `src/app/globals.css:39-100`. Semántica estándar tipo shadcn: `--background`, `--foreground`, `--card`, `--primary` (197 77% 53% ≈ `#29ABE2`, fiel al manual de marca), `--primary-dark`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--success`, `--border`, `--input`, `--ring`, `--radius` (1.125rem). Además hay tokens "de superficie" propios del proyecto (`--surface-overlay`, `--surface-overlay-strong`, `--panel-border`, `--panel-inner-highlight`) que cambian de opacidad entre modos para simular vidrio esmerilado en dark.

**Tipografía** — Gotham Rounded self-hosted vía `@font-face` (Light/Book/Medium/Bold) con fallback `Nunito, system-ui`. IBM Plex Mono (400/500) para `.mono` y `.eyebrow` (labels en mayúscula, tracking ancho, uso consistente como "etiqueta de dato").

**Clases utilitarias propias** (`@layer components`): `.panel` / `.panel-muted` (contenedor principal, sombra distinta light/dark), `.surface-card` (+ `.surface-card-hover`), `.surface-control` / `.surface-select` / `.surface-textarea` (inputs), `.btn` + variantes `.btn-primary` (gradiente cian con glow), `.btn-ghost`, `.btn-danger`, `.btn-success`, `.badge` + variantes `-primary/-accent/-danger/-success`, `.eyebrow`, `.rail-icon-button` (+ `-active`), `.prose-doc` (contenido de ayuda/changelog), overrides de `react-day-picker`, `.modal-safe` (safe-area en modales full-height). Fix táctico documentado inline: `font-size: 16px` forzado en inputs en mobile para evitar el auto-zoom de iOS.

No hay capa de "design tokens" tipográficos (tamaños/tracking) fuera de utilidades de Tailwind ad hoc (`text-3xl font-semibold`, `text-[11px] uppercase tracking-[0.16em]` repetido literal en varias tablas en lugar de una clase reusable) — funciona pero es duplicación de bajo riesgo.

## 2. Inventario de componentes

| Componente | Rol |
|---|---|
| `layout/AppShell.tsx` | Shell autenticado: topbar mobile, sidebar desktop, bottom-nav mobile, drawer mobile. Recibe `role` y pinta nav distinta admin/empleado. |
| `layout/AuthShell.tsx` | Shell de páginas no autenticadas (login, forgot/reset password, pending, setup-biometrics): logo + panel centrado + footer manual/changelog. |
| `providers/ThemeProvider.tsx` | Contexto de tema con persistencia en `localStorage` y seguimiento de `prefers-color-scheme`. |
| `providers/SessionProvider.tsx`, `providers/PushProvider.tsx` | Wrappers de NextAuth y suscripción push, sin UI propia visible. |
| `ui/PageHeader.tsx` | Encabezado de página estandarizado (eyebrow + título + descripción + acciones). Usado de forma consistente en casi todas las pantallas de contenido. |
| `ui/ThemeToggle.tsx` | Botón sol/luna, usa `.rail-icon-button`. |
| `ui/VersionBadge.tsx` | Link a `/changelog` con la versión desde env var. |
| `ui/DonutChart.tsx` | Donut SVG puro, sin librería, usado en el dashboard admin. |
| `brand/Logo.tsx` / `LogoIcon` | Isotipo + wordmark "Emmalva". |

**Ausencias notables**: no hay componentes genéricos reusables de `Button`, `Input`, `Modal/Dialog`, `Toast` ni `EmptyState`. Cada pantalla que necesita un modal (drawer de `AppShell`, `CreateUserDialog`, `ApproveDialog` en `UsersTable.tsx`, el diálogo de rechazo en `AdminDocuments.tsx`) reimplementa el mismo patrón `fixed inset-0 z-50 grid place-items-center bg-black/60` a mano. Es funcional y visualmente consistente porque todos comparten `.panel`, pero es una duplicación que un componente `Modal` eliminaría.

## 3. Navegación

Modelo por rol, definido en `AppShell.tsx`: arrays separados `EMPLOYEE_NAV`/`ADMIN_NAV` (navegación completa) y `EMPLOYEE_MOBILE_PRIMARY`/`ADMIN_MOBILE_PRIMARY` (4 ítems para bottom-nav; el resto vive en el drawer bajo "Más").

- **Desktop (≥ md)**: sidebar fijo de 264px con logo, nav vertical con badges numéricos de pendientes, y pie con nombre/rol, toggle de tema y logout.
- **Mobile (< md)**: topbar sticky (logo + toggle tema + hamburguesa con badge total) y bottom-nav fijo `grid-cols-5` (4 accesos directos + botón "Más"). El botón "Más" abre un drawer full-screen (82% ancho, `role="dialog"`) que duplica la nav completa + logout.
- Badges de pendientes (`adminBadges`) sólo existen para ADMIN, calculados en `admin/layout.tsx` con 4 counts (usuarios, licencias, documentos, cambios de perfil) y propagados a sidebar, drawer, topbar (badge agregado) y bottom-nav.
- `isActive()` usa comparación exacta o `startsWith` — coherente, sin falsos positivos evidentes entre `/admin` y `/admin/x`.

## 4. Theming claro/oscuro

Implementación correcta y sin parpadeo (FOUC): `THEME_INIT_SCRIPT` (`ThemeProvider.tsx`) se inyecta inline en `<head>` de `layout.tsx:32` y aplica la clase `dark`/`light` a `<html>` antes del primer paint, leyendo `localStorage['emmalva.theme']` o `prefers-color-scheme` como fallback. El `ThemeProvider` de React sincroniza después y escucha cambios de esquema del SO sólo si el usuario no fijó una preferencia explícita. Casi todos los estilos condicionales por tema están en `globals.css` vía selector `.dark` / `.light` (no hay estilos de tema embebidos en componentes, salvo `CalendarClient.tsx` que usa colores HSL fijos hardcodeados para los estados del `DayPicker` — funcionan en ambos modos porque usan opacidad, pero no están tokenizados como el resto).

## 5. Cobertura de estados — loading / empty / error / feedback

No existen `loading.tsx`, `error.tsx` ni `not-found.tsx` en `src/app/**` (convención de Next.js App Router) — ningún segmento tiene skeleton, boundary de error ni página 404 dedicada. El feedback de "en progreso" se maneja 100% a mano cambiando el texto del botón (`"Guardando…"`, `"Enviando…"`, `"Subiendo…"`) más `disabled`; no hay spinners ni skeletons en ningún punto del código.

| Pantalla / componente | Loading | Empty | Error | Feedback positivo |
|---|---|---|---|---|
| Login (`LoginForm.tsx`) | Botón → "Ingresando…" | N/A | Banner rojo inline (`err`) | Ninguno explícito (redirige) |
| Setup biometría (`EnrollButton.tsx`) | Botón → "Registrando…" | N/A | Banner rojo inline | Banner verde "Dispositivo registrado. Redirigiendo…" |
| Reset password (`ResetPasswordForm.tsx`) | Botón → "Guardando…" | N/A | Banner rojo inline (incl. validación cliente) | Ninguno explícito (redirige) |
| Pending (`pending/page.tsx`) | N/A (server) | N/A | N/A | Banner informativo estático |
| Dashboard empleado (`dashboard/page.tsx`) | N/A (server-rendered) | Sí, por tarjeta ("Aún no hiciste check-in", "—") | N/A (no fetch cliente) | N/A |
| Check-in (`CheckinClient.tsx`) | Botón → "Registrando…" | N/A | Banner rojo inline | Banner verde con ícono ("Check-in/out registrado") |
| Calendario (`CalendarClient.tsx`) | **Ausente**: mientras `data` es `null` (fetch inicial) no se muestra skeleton ni mensaje, sólo se ocultan bloques condicionados a `data &&` — pantalla se ve "vacía" sin indicar carga | Sí ("Sin solicitudes.") | Banner inline (`msg.kind==="err"`) | Banner inline verde ("Solicitud enviada") |
| Documentación empleado (`DocumentsClient.tsx`) | Botón → "Subiendo…" | Sí ("Sin documentos cargados.") | Banner rojo inline | **Ausente** tras upload exitoso (sólo se limpia el form y refresca; no hay mensaje de éxito) |
| Vencimientos (`DocsVencimientos.tsx`) | Botón/slot → "Guardando…"/"Subiendo…" | N/A (siempre hay filas fijas) | Banner inline por fila | Banner inline verde por fila |
| Inbox (`inbox/page.tsx`) | N/A (server) | Sí, 2 variantes según filtro activo | N/A | N/A |
| Perfil (`ProfileForm.tsx`) | Botón → "Enviando…" | N/A | Banner inline + auto-scroll a la vista (`msgRef`) | Banner inline verde, con 3 variantes de texto según resultado (completed/pendingApproval/unchanged) |
| Firma (`SignaturePad.tsx`) | Botón → "Guardando…" | Estado "sin firma" = modo edición por defecto | `onError` delega al banner del padre (`ProfileForm`) | Delegado al padre |
| Admin dashboard (`admin/page.tsx`) | N/A (server) | Sí ("Sin vencimientos cargados.") | N/A | N/A |
| Usuarios (`UsersTable.tsx`) | Botón/`busy` por fila | Sí ("No hay usuarios todavía.") | **Toast flotante** (único caso en toda la app; distinto patrón al resto) | Toast flotante (éxito de creación/reset de password) |
| Licencias (`AdminLeavesTable.tsx`) | `busy` por fila (sin texto de botón cambiante) | Sí ("Sin solicitudes.") | Banner inline arriba de la tabla | **Ausente** (aprobar/rechazar no muestra confirmación, sólo refresca) |
| Documentos admin (`AdminDocuments.tsx`) | `busy` por fila | Sí ("Sin documentos.") | **Ausente**: `act()` no revisa `res.ok` ni captura errores de red | **Ausente** (mismo problema, siempre refresca en silencio) |
| Entregas (`DeliveriesClient.tsx`) | Botón → "Subiendo…" | Sí ("Sin entregas todavía.") | Banner inline | **Ausente** tras subir (sólo limpia título y refresca) |
| Cambios de perfil (`ProfileChangesClient.tsx`) | `busy` por card | Sí ("No hay cambios de perfil para revisar.") | Banner inline | **Ausente** |
| Jornadas (`AttendanceClient.tsx`) | N/A (navegación server-driven, sin estado busy en filtros) | Sí ("Sin registros en ese rango.") | N/A | N/A |
| Empleados — listado (`admin/employees/page.tsx`) | N/A (server) | Sí ("No se encontraron empleados.") | N/A | N/A |
| Ficha de empleado (`EmployeeDetailClient.tsx`) | Botón → estado busy | N/A | Banner inline (`msg.kind==="err"`) | Banner inline ("Ficha guardada") |

**Patrones detectados:**
- **Feedback dual e inconsistente**: la app usa mayormente un *banner inline* (div de color condicional debajo de la acción) pero `UsersTable.tsx` es el único lugar con un *toast flotante* con auto-dismiss (`setTimeout`). No hay una decisión de sistema sobre cuándo usar cada uno.
- **Éxito silencioso**: varias acciones administrativas de aprobar/rechazar (`AdminLeavesTable`, `AdminDocuments`, `ProfileChangesClient`, `DeliveriesClient`, `DocumentsClient` tras upload) no muestran confirmación positiva — el único indicio de que funcionó es que la fila desaparece/cambia tras el `router.refresh()`. Para acciones irreversibles (rechazar, aprobar cambios de perfil) esto puede generar dudas sobre si el clic "prendió".
- **`AdminDocuments.tsx` no maneja errores de red/servidor** en `act()` (ni `try/catch` ni chequeo de `res.ok`): si la API devuelve 4xx/5xx, la UI queda en silencio (sin busy, sin error) dando la falsa sensación de que no pasó nada, en lugar de mostrar un mensaje.
- **`CalendarClient.tsx`** no comunica el estado de carga inicial (fetch de disponibilidad): la sección de saldo de vacaciones y el picker de días deshabilitados aparecen "en blanco" hasta que resuelve, sin placeholder ni texto "Cargando disponibilidad…".
- Estados vacíos sí están cubiertos consistentemente en tablas (`colSpan` centrado con copy en español), es el área mejor cubierta del sistema.

## 6. Consistencia visual

- Fuerte consistencia en composición: casi toda pantalla de contenido usa `PageHeader` + `.panel` + tabla con `overflow-x-auto` + fila vacía centrada. Los badges de estado (`badge-success/-accent/-danger`) mapean siempre los mismos 3 colores a los mismos significados (aprobado=verde, pendiente=cian/ámbar, rechazado/bloqueado=rojo) en documentos, licencias, usuarios y entregas — buen sistema semántico.
- Inconsistencia menor: colores de estado en `CalendarClient.tsx` (verde/naranja/rojo vía HSL crudo para el `DayPicker`) no usan las mismas variables `--success/--destructive`, sino literales `hsl(142 72% 45% / ...)`, `hsl(19 95% 53% / ...)` — el naranja (19 95%) no tiene equivalente en ningún token del sistema (no hay `--warning`), así que "pendiente" se pinta ámbar aquí pero cian/accent (`badge-accent`) en el resto de la app. Es la única pantalla con una paleta de estado paralela.
- Los diálogos modales (creación de usuario, aprobación, rechazo) son visualmente idénticos entre sí (mismo backdrop, mismo `.panel`, mismos botones `.btn-ghost`/`.btn-primary`/`.btn-danger`) pero están duplicados en código en 3 archivos distintos — riesgo de que una futura actualización de estilo de modal se aplique a uno y se olvide en otro.
- Toda la iconografía usa `lucide-react` de forma consistente (tamaños `h-4 w-4` / `h-5 w-5`), sin mezclar con otra librería de íconos.
- El logo (`LogoIcon`) usa colores hardcodeados `#29ABE2` / `#2B8BB0` en vez de `hsl(var(--primary))`; es intencional (identidad de marca fija) pero significa que el isotipo no reacciona a ningún futuro cambio de tema de marca vía tokens.

## 7. Calidad de copy (español rioplatense)

El tono es informal y consistente con voseo genuino ("Firmá en el recuadro", "Elegí una fecha", "Contactate con RRHH", "no te queda saldo", "pedile al administrador") — no hay mezcla con "tú" en ningún archivo revisado. Los mensajes de error son específicos y orientados a la acción ("No pudimos conectar. Revisá tu conexión e intentá de nuevo.", "Registrá primero tu dispositivo.") en lugar de genéricos tipo "Ocurrió un error". Los estados vacíos usan variación natural en vez de repetir la misma frase ("Sin solicitudes.", "No tenés documentos para abrir.", "Aún no hiciste check-in", "No se encontraron empleados.").

Puntos a pulir:
- Mezcla de fallback genérico `"Error"` sin contexto en varios `catch`/`!res.ok` (`AdminLeavesTable.tsx`, `ProfileChangesClient.tsx`, `CalendarClient.tsx`, `CheckinClient.tsx` como último recurso) — conviven con mensajes mucho más cuidados en otras pantallas del mismo flujo, dando una experiencia dispar según qué endpoint falle.
- El texto de ayuda del selector de duración de vacaciones y el de "Duración" en `CalendarClient.tsx` no explica por qué desaparece la opción de 14 días cuando el saldo es insuficiente (queda implícito por `leftDays >= 14`), a diferencia de otros bloqueos que sí llevan explicación textual (ej. saldo de vacaciones insuficiente).
- Alguna etiqueta interna se filtra al usuario: "pwd temp" en `UsersTable.tsx` (badge) es jerga técnica abreviada en medio de un copy por lo demás cuidado ("aprobado", "pendiente", "deshabilitado").
