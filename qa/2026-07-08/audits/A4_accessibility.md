# A4 — Auditoría de accesibilidad (WCAG 2.2 AA) — Emmalva Checkin System

Fecha: 2026-07-08 · Tipo: **report-only**, análisis estático de código (no se ejecutó la app, no hay axe/Lighthouse en este entorno). No se modificó ningún archivo de la aplicación.

## 1. Método

Lectura completa de `src/components/**` y `src/app/**` (páginas + client components), más `src/app/globals.css` (design tokens) y el contenido MDX del manual (`src/content/**`). Para cada criterio se buscó evidencia concreta en el JSX/CSS — no se infiere nada que no esté en el código:

- **Estructura semántica**: jerarquía de `h1`/`h2`, landmarks (`header`/`nav`/`main`/`aside`), listas.
- **Teclado y foco**: `tabIndex`, `onKeyDown`, manejo de `Escape`, trampas de foco en modales, `outline`/`focus-visible`.
- **Contraste**: se convirtieron a RGB los tokens HSL de `globals.css` y se calculó la luminancia relativa y el ratio de contraste (fórmula WCAG estándar) para los pares texto/fondo realmente usados en el código (no son estimaciones visuales).
- **Alt text**: cada `<img>` del repo (5 en total) revisado uno por uno.
- **Labels de formulario**: cada `<label>` del repo (24 en total) revisado para ver si envuelve el control (asociación implícita, válida) o es hermano sin `htmlFor`/`id` (sin asociación).
- **ARIA**: cada atributo `aria-*`/`role` del repo revisado en contexto.
- **`prefers-reduced-motion`**: búsqueda de la media query y de animaciones (`@keyframes`/`animate-*`) en todo el proyecto.
- **Canvas de firma** (`SignaturePad.tsx`): revisado evento por evento (Pointer Events, guardado, alternativa).

## 2. Resumen por severidad

| Severidad | Cantidad |
|---|---|
| Crítica | 1 |
| Alta | 3 |
| Media | 3 |
| Baja | 3 |
| **Total hallazgos** | **10** |
| Correcto (buenas prácticas confirmadas) | 10 |

## 3. Hallazgos

### A11Y-1 · Crítica · Firma digital sin alternativa no táctil (`SignaturePad.tsx`)
**WCAG**: 2.1.1 Keyboard (A), 1.1.1 Non-text Content (A), 4.1.2 Name/Role/Value (A).

El `<canvas>` de `SignaturePad.tsx:118-125` sólo escucha `onPointerDown/Move/Up/Leave`. No tiene `tabIndex`, no responde a teclado, y no expone `aria-label`/`role` alguno — para un lector de pantalla es un elemento mudo e inoperable. No existe ningún método alternativo (firmar tecleando el nombre, subir una imagen de firma, etc.): un usuario que no pueda dibujar con el dedo o el mouse (motor, ciego) **no puede completar el flujo** de firma, que se usa automáticamente para abrir recibos y documentos internos (`ProfileForm.tsx:224-228`). El texto de ayuda ("Firmá con el dedo…", `SignaturePad.tsx:134`) está fuera del canvas y no vinculado con `aria-describedby`.

### A11Y-2 · Alta · Contraste insuficiente de los tokens de color en modo claro
**WCAG**: 1.4.3 Contrast (Minimum) (AA).

Cálculo de luminancia relativa (fórmula WCAG) sobre los tokens de `globals.css:39-69` (modo `:root`/light):

| Token | HSL | Uso | Contraste calculado | Resultado |
|---|---|---|---|---|
| `--primary` (texto) sobre blanco/card | `197 77% 53%` | `.badge-primary`, nav activo (`text-primary`), links `text-primary` (ej. "Olvidé mi contraseña" en `LoginForm.tsx:87`, `.prose-doc a`) | **≈2.5 : 1** | Falla (mín. 4.5:1) |
| `--accent` (texto) sobre blanco/card | `195 65% 45%` | `.badge-accent`, banner de `pending/page.tsx` (`text-accent`/`bg-accent/10`) | **≈3.3 : 1** | Falla |
| `--success` (texto) sobre blanco/card | `142 65% 38%` | `.badge-success`, `.btn-success` | **≈3.4 : 1** | Falla |
| `--destructive` (texto) sobre blanco/card | `0 75% 50%` | `.badge-danger`, `.btn-danger` | **≈4.6 : 1** | Pasa (al límite) |
| blanco (`--primary-foreground`) sobre `--primary` plano | — | contadores de pendientes (`AppShell.tsx:109,139,193,242`) | **≈2.5 : 1** | Falla |
| blanco sobre el tramo superior del degradé de `.btn-primary` (`hsl(--primary)` arriba, `hsl(--primary-dark)` abajo, `globals.css:242-246`) | — | todos los `btn-primary` | El extremo superior del degradé (`--primary`, luminancia ≈0.37) da **≈2.5:1**; el extremo inferior (`--primary-dark`, luminancia ≈0.14) da ≈5.6:1 → contraste **desparejo dentro del mismo botón** | Requiere verificación visual con herramienta real |

Es decir: **`--primary`, `--accent` y `--success` usados como color de texto (o como fondo con texto blanco) no llegan al mínimo de 4.5:1 en modo claro**, salvo `--destructive` que pasa por muy poco. En modo oscuro los mismos tokens sí superan 4.5:1 ampliamente (fondos oscuros → ratios >6:1) — es un problema específico del tema claro. `--muted-foreground` (texto secundario en casi toda la app) sí pasa cómodamente en ambos modos (~5.6:1 claro / ~7.8:1 oscuro).

Impacto: badges de estado (aprobado/pendiente/rechazado) en todas las tablas admin, ítem activo del nav, enlaces, contadores de notificaciones, "propuesto" en `ProfileChangesClient.tsx:105`.

### A11Y-3 · Alta · Labels de formulario sin asociación programática
**WCAG**: 1.3.1 Info and Relationships (A), 3.3.2 Labels or Instructions (A), 4.1.2 (A).

`grep -rn "htmlFor"` sobre todo `src/` devuelve **0 resultados**: no existe un solo `htmlFor`/`id` explícito en el repo. Hay dos patrones de `<label>`:

- **Correcto (implícito)**: `<label className="block"><span className="eyebrow">{label}</span>{children}</label>` — el input queda anidado dentro del `<label>`, lo que sí es una asociación válida en HTML. Usado en `ProfileForm.tsx:245-250`, `DocsVencimientos.tsx:67-70`, `DocumentsClient.tsx:54-57`, `AttendanceClient.tsx:59-73`, `EmployeeDetailClient.tsx:282-287`, `DeliveriesClient.tsx:45-63`.
- **Incorrecto (sin asociación)**: `<label className="eyebrow">Texto</label>` como **hermano** del `<input>`, no como contenedor — no hay vínculo programático alguno. Usado en:
  - `LoginForm.tsx:74,86` (Email, Contraseña — el formulario de login)
  - `ResetPasswordForm.tsx:41,45,49` (las 3 contraseñas)
  - `UsersTable.tsx:231,235,243,247,254,258` (`CreateUserDialog`) y `305,309` (`ApproveDialog`)
  - `AdminDocuments.tsx:81` (motivo de rechazo)

Un lector de pantalla que llega a estos inputs por Tab no anuncia ninguna etiqueta (o anuncia sólo `type="email"`/genérico); en mobile tampoco funciona el "tocar el label para enfocar el input". Afecta justo los flujos más críticos: login, cambio de contraseña obligatorio, alta de usuario y aprobación de empleados.

### A11Y-4 · Alta · Modales sin semántica de diálogo ni gestión de foco
**WCAG**: 2.4.3 Focus Order (A), 4.1.2 Name/Role/Value (A); prácticas de WAI-ARIA Authoring Practices para diálogos modales.

Tres modales están reimplementados a mano sin ningún atributo ARIA de diálogo:

- `CreateUserDialog` — `UsersTable.tsx:225` (`<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>`, sin `role`, sin `aria-modal`).
- `ApproveDialog` — `UsersTable.tsx:299` (idéntico).
- Modal de rechazo de documento — `AdminDocuments.tsx:77` (idéntico).

Ninguno mueve el foco al abrirse, ninguno lo atrapa dentro del panel, y ninguno se cierra con `Escape` (`grep -rn "Escape"` sobre todo `src/` → 0 resultados). Sólo se cierran con click en el backdrop (mouse) o clickeando/Tab-eando hasta el botón "Cancelar".

El drawer mobile de `AppShell.tsx:215` sí tiene `role="dialog" aria-modal="true"` — mejor que los anteriores — pero **tampoco** mueve el foco al abrir, no lo atrapa, y tampoco cierra con `Escape`. Como el contenido de fondo (bottom-nav, contenido de la página) no se marca `inert` ni se saca del orden de tabulación, un usuario de teclado puede Tab-ear "hacia atrás" del drawer y llegar a elementos visualmente tapados por el overlay.

### A11Y-5 · Media · Botones "toggle" sin estado expuesto a asistive tech
**WCAG**: 4.1.2 Name, Role, Value (A).

En `CalendarClient.tsx:96-97` (pestañas Vacaciones/Franco) y `146-148` (selector de duración 7/14 días) el estado seleccionado se comunica **sólo visualmente** (clase `btn-primary` vs `btn-ghost`), sin `aria-pressed`, `aria-selected` ni `role="tab"/"radiogroup"`. Un lector de pantalla no puede saber cuál opción está activa.

### A11Y-6 · Media · Gráficos donut sin nombre accesible
**WCAG**: 1.1.1 Non-text Content (A).

`DonutChart.tsx:19` usa `<svg role="img">` sin `aria-label`/`aria-labelledby`/`<title>` — las 3 tortas del dashboard admin (`admin/page.tsx:106-138`, "Check-in de hoy", "Check-out de hoy", "Ausentes de hoy") quedan como gráficos "sin nombre" para un lector de pantalla. Mitigado parcialmente: la leyenda en texto (`<ul>` dentro del mismo componente, líneas 49-57) sí expone los valores, así que el dato no se pierde del todo, pero el `<svg>` en sí no es identificable.

### A11Y-7 · Media · Encabezado `<h1>` duplicado en el manual para usuarios no logueados
**WCAG**: 1.3.1 Info and Relationships (A) / buena práctica de navegación por encabezados.

`AuthShell.tsx:23` renderiza `<h1>{title}</h1>` (ej. "Manual de usuario"). Cuando el visitante no está logueado, `help/layout.tsx:34-40` envuelve el contenido MDX en ese `AuthShell`, y el contenido mismo (`src/content/manual/intro.mdx`, `employee.mdx`, `admin.mdx`, `faq.mdx`, `changelog.mdx`) arranca siempre con `# Título` → se renderiza como un **segundo** `<h1>` (`.prose-doc h1`, `globals.css:264`) en la misma página. No ocurre para usuarios logueados (`AppShell` no agrega su propio `h1`). Confunde la navegación por encabezados de un lector de pantalla en las páginas públicas del manual.

### A11Y-8 · Baja · Sin soporte de `prefers-reduced-motion`
**WCAG**: no es un criterio de Nivel AA en sí (2.3.3 Animation from Interactions es AAA); se incluye por pedido explícito de alcance.

`grep -rn "prefers-reduced-motion"` sobre todo el proyecto → 0 resultados. `globals.css:104` fija `html { scroll-behavior: smooth; }` de forma incondicional. Impacto real bajo: no hay `@keyframes` ni clases `animate-*` en ningún componente (verificado), sólo transiciones CSS de color/hover de duración corta — no hay movimiento grande que dispare mareo/vestibular. Queda como mejora de buena práctica, no como incumplimiento de AA.

### A11Y-9 · Baja · `aria-label` en inglés dentro de una app en español
**WCAG**: no aplica un criterio directo; calidad de nombre accesible (3.1.1 Language of Page ya está correctamente en `es`).

`ThemeToggle.tsx:18` usa `aria-label="Toggle theme"` mientras el resto de los `aria-label` del proyecto están en español ("Abrir menú", "Cerrar menú", "Cerrar" — `AppShell.tsx:106,220`, `PushProvider.tsx:86`) y `<html lang="es">` (`layout.tsx:30`). Un lector de pantalla configurado en es-AR puede pronunciarlo mal o cambiar de motor de voz a mitad de frase.

### A11Y-10 · Baja · Pestañas de navegación sin `aria-current`
**WCAG**: 4.1.2 (A) / 2.4.8 Location (AAA, fuera de alcance AA pero relacionado).

Las pestañas de `inbox/page.tsx:54` (Todos/Recibos/Notificaciones, implementadas como `<Link>` con clase condicional `btn-primary`/`btn-ghost`) y el nav lateral de `help/layout.tsx:20-28` no marcan la sección activa con `aria-current="page"`. La distinción es sólo de color/clase.

## 4. Correcto (buenas prácticas confirmadas)

- **`<html lang="es">`** fijado en la raíz (`layout.tsx:30`) — un solo idioma, correctamente declarado.
- **Theme init script sin FOUC** (`ThemeProvider.tsx:57`, inyectado en `<head>` en `layout.tsx:32`) que respeta `prefers-color-scheme` como fallback y permite override persistente — ningún parpadeo de tema al cargar.
- **`--muted-foreground`** (el color de texto secundario más usado en toda la app) pasa contraste AA cómodamente en ambos temas (~5.6:1 claro, ~7.8:1 oscuro contra fondos de card/panel).
- **`--destructive`** como color de texto pasa AA en modo claro (~4.6:1).
- **Controles de formulario nativos** en toda la app (`<input>`, `<select>`, `<textarea>`) — ninguna reimplementación de dropdown/checkbox a mano que rompa semántica nativa de teclado/AT, ni siquiera en `.surface-select` (que sólo agrega flechas decorativas vía `background-image`, sigue siendo un `<select>` real).
- **Foco visible reimplementado correctamente**: `.surface-control`/`.surface-textarea` quitan el `outline` nativo (`outline-none`, `globals.css:192,216`) pero lo sustituyen por un anillo `:focus-visible` (`ring-2 ring-primary/25`, líneas 203/227) — cumple 2.4.7 vía indicador alternativo, no lo elimina sin reemplazo.
- **Patrón de `<label>` envolvente (asociación implícita) correcto** en `ProfileForm.tsx`, `DocsVencimientos.tsx`, `DocumentsClient.tsx`, `AttendanceClient.tsx`, `EmployeeDetailClient.tsx`, `DeliveriesClient.tsx` — el input queda anidado dentro del `<label>`.
- **Alt text significativo en imágenes funcionales**: `ImageSlot` en `ProfileForm.tsx:296`, `DocsVencimientos.tsx:114`, `EmployeeDetailClient.tsx:325` usan `alt={label}` (ej. "Libreta (frente)", "Carnet (dorso)"); `SignaturePad.tsx:107` usa `alt="firma"`. El único `alt=""` del repo (`admin/employees/page.tsx:60`, foto de perfil en el listado) está correctamente marcado como decorativo porque el nombre del empleado ya está en texto inmediatamente al lado.
- **Ícono de marca decorativo con alternativa textual**: `LogoIcon` lleva `aria-hidden` (`Logo.tsx:17`) y siempre aparece junto al wordmark "Emmalva" en texto — patrón correcto de ícono decorativo + nombre accesible visible.
- **Jerarquía de encabezados consistente `h1` → `h2`** en casi toda la app autenticada: `PageHeader` (un solo `h1` por página) seguido de `<h2>` por sección (`ProfileForm.tsx`, `EmployeeDetailClient.tsx`, `admin/page.tsx`, etc.), sin saltos de nivel — la única excepción es el `h1` duplicado del manual público (ver A11Y-7).
- **Diálogos nativos del navegador** (`window.confirm`/`window.prompt`) para confirmaciones destructivas y motivos de rechazo (`EmployeeDetailClient.tsx:120`, `ProfileChangesClient.tsx:49`) — a diferencia de los modales a mano (A11Y-4), estos son inherentemente accesibles y operables por teclado sin código adicional.
