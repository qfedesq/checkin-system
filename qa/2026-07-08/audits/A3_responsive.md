# A3 — Auditoría responsive & device QA (report-only)

Fecha: 2026-07-08
Método: **análisis estático** de código (no hay Playwright ni datos de prueba para correr la app; no se ejecutó en dispositivos reales). Toda observación de comportamiento en runtime (WKWebView de WhatsApp, iOS Safari real, Android real) está marcada `confidence: low` porque se infiere de la plataforma/librería, no de una ejecución observada. Las observaciones que son lectura directa de código/CSS/JSON están marcadas `confidence: high`.

No se modificó código de la app. Este documento y su JSON hermano (`A3_responsive.findings.json`) son el único output.

## Alcance revisado

- `src/app/globals.css`
- `src/components/layout/AppShell.tsx`
- `src/app/layout.tsx`, `public/manifest.webmanifest`, `public/sw.js`
- Páginas/clientes: `checkin/CheckinClient.tsx`, `login/LoginForm.tsx`, `setup-biometrics/EnrollButton.tsx`, `profile/ProfileForm.tsx`, `profile/SignaturePad.tsx`, `documents/DocumentsClient.tsx`, `documents/DocsVencimientos.tsx`, `calendar/CalendarClient.tsx`, `admin/AdminMiniCalendar.tsx`, `inbox/page.tsx`, y las tablas admin (`UsersTable`, `AdminLeavesTable`, `AttendanceClient`, `AdminDocuments`, `DeliveriesClient`, `ProfileChangesClient`)
- `tailwind.config.ts`, `providers/PushProvider.tsx`
- Librería `@simplewebauthn/browser@13.3.0` (código fuente en `node_modules`, para verificar comportamiento real de `startAuthentication`/`startRegistration` sin guarda explícita)

## Matriz de plataformas evaluada

| Plataforma | Rol primario | Método |
|---|---|---|
| Desktop (Chrome/Edge/Safari desktop) | Admin | Estático — sidebar `md:flex`, sin breakpoints intermedios |
| iOS Safari, PWA instalada (standalone) | Empleado | Estático — safe-areas, zoom fix, manifest/appleWebApp |
| iOS Safari, no instalada (tab normal) | Empleado | Estático — mismo código, sin `PushManager`, sin standalone |
| Navegador in-app de WhatsApp (WKWebView restringido) | Empleado | Estático + inferencia de comportamiento WebKit/WKWebView (no ejecutado) |
| Android Chrome | Empleado (secundario) / Admin ocasional | Estático |

---

## 1. Layout / breakpoints

Único breakpoint real en uso es `md:` (768px, default Tailwind); no hay `sm:`/`lg:`/`xl:`/`2xl:` en `AppShell.tsx` (5 matches de `md:`, 0 del resto). El patrón es binario: bottom-nav + drawer (`<768px`) vs. sidebar fijo (`≥768px`). Para el negocio declarado (empleado = teléfono, admin = desktop) esto es suficiente — no hay tablets en el flujo declarado, así que la ausencia de `lg:`/`xl:` no es un gap funcional, sólo significa que un admin en una ventana angosta (~800px) ve el layout "desktop" completo sin ajuste fino. **Confidence: high** (lectura directa de grep + Tailwind defaults).

Los formularios (`ProfileForm.tsx`, `DocumentsClient.tsx`, `DocsVencimientos.tsx`) usan `grid-cols-1 md:grid-cols-2` / `grid-cols-2 md:grid-cols-5` de forma consistente — en mobile colapsan a 1 o 2 columnas legibles, sin overflow. **Confidence: high.**

## 2. Tablas anchas en mobile

Las 8 tablas del proyecto (`inbox`, `documents/DocumentsClient`, `admin/leaves/AdminLeavesTable`, `admin/users/UsersTable`, `admin/attendance/AttendanceClient`, `admin/profile-changes/ProfileChangesClient`, `admin/documents/AdminDocuments`, `admin/deliveries/DeliveriesClient`) están **todas** envueltas en `<div className="overflow-x-auto"><table className="w-full min-w-[Npx]">` (620–900px según la tabla). Es el patrón correcto: en mobile la tabla scrollea horizontalmente dentro de su contenedor en vez de romper el layout de la página. No hay overflow horizontal a nivel de página (`body`/`main`) detectado en ningún archivo. **Confidence: high** (patrón idéntico y consistente, verificado por grep en las 8 ocurrencias).

La única tabla relevante para el empleado en mobile es `inbox/page.tsx` y `documents/DocumentsClient.tsx`; el resto son admin/desktop. Correcto y sin gap.

## 3. Touch targets (mínimo 44px)

- `rail-icon-button` (botones de ícono: menú, cerrar drawer, logout, cerrar banner push): `h-11 w-11` = 44×44px exacto. Cumple.
- `.surface-control` (inputs/selects): `h-11` = 44px de alto. Cumple.
- Bottom-nav items: `py-2.5` + ícono `h-5 w-5` + label → alto renderizado estimado ~52-56px (no medido en dispositivo real). Cumple con margen.
- **`.btn` (base de `btn-primary`/`btn-ghost`/`btn-danger`/`btn-success`, usado en casi todos los CTA: "Hacer check-in", "Guardar", "Solicitar vacaciones", login, etc.): `h-10` = **40px**, por debajo de la recomendación estándar de 44×44px (WCAG 2.5.5 / Apple HIG / Material). No es un gap severo (40px es razonablemente cercano y el padding horizontal `px-4` da área extra), pero es sistemático porque toda la app comparte la clase `.btn`. **Confidence: high** para el valor CSS; **low** para el impacto real en usabilidad (no se midió con usuarios ni en dispositivo).
- No se encontraron botones de ícono aislado por debajo de 44px fuera de logos (`Logo.tsx`/`AppShell` usan `h-7 w-7`/`h-9 w-9` pero son elementos decorativos, no interactivos).

## 4. Safe areas (notch / home indicator)

Uso consistente de `env(safe-area-inset-*)`: header mobile (`paddingTop: calc(env(safe-area-inset-top) + 0.75rem)`), bottom-nav (`paddingBottom: env(safe-area-inset-bottom)`), drawer (`paddingTop`/`paddingBottom` con ambos insets), y clase utilitaria `.modal-safe` en `globals.css` para modales full-height. `viewport.viewportFit: "cover"` en `layout.tsx` habilita estos insets correctamente. Los modales admin (`UsersTable.tsx`, `AdminDocuments.tsx`) son centrados con `p-4` y no full-height, por lo que no necesitan `.modal-safe` — correcto, sin gap ahí (y son de uso desktop-primario). **Confidence: high.**

## 5. Zoom automático en inputs (iOS/WhatsApp)

Mitigado explícitamente: `@media (max-width: 640px) { .surface-control, .surface-select, .surface-textarea, input, select, textarea { font-size: 16px; } }`, con comentario en el propio CSS que documenta el motivo, incluyendo mención explícita al navegador in-app de WhatsApp. `viewport.maximumScale: 5` permite zoom manual del usuario sin bloquear accesibilidad. **Cubierto. Confidence: high.**

## 6. Hover-only affordances

6 reglas `:hover` en `globals.css` (`.btn-ghost`, `.btn-danger`, `.btn-success`, `.surface-card-hover`), ninguna con guarda `@media (hover: hover)`. Ninguna oculta funcionalidad crítica detrás de hover — son cambios cosméticos de color/fondo sobre elementos que ya son accionables por click/tap. En touch devices el estado `:hover` puede quedar "pegado" tras un tap (comportamiento normal WebKit/Blink), pero es puramente visual. **Bajo riesgo. Confidence: medium** (el mecanismo CSS es cierto; el "sticky hover" real en WebKit no se verificó en dispositivo).

## 7. Canvas de firma (`SignaturePad.tsx`)

Implementación correcta para multi-input: usa **Pointer Events** (`onPointerDown/Move/Up/Leave` + `setPointerCapture`), que unifican touch/mouse/stylus en un solo código (mejor que Touch Events + Mouse Events separados). El canvas tiene `className="touch-none"` (Tailwind → `touch-action: none`), lo que evita que el navegador interprete el gesto de dibujo como scroll/pan — exactamente lo necesario para firmar con el dedo sin que la página se desplace. Escala por `devicePixelRatio` para nitidez en pantallas retina. **Correcto. Confidence: high** para el código; **low** para el comportamiento real medido en WKWebView de WhatsApp (no se probó ahí, aunque WKWebView comparte el motor WebKit de Safari por lo que Pointer Events debería comportarse igual).

Gap menor: el `useEffect` que redimensiona el canvas corre sólo al montar/cambiar `editing`, no en `resize`/`orientationchange`. Si el usuario rota el dispositivo mientras el pad está abierto, el canvas no se re-escala (posible distorsión de trazo). Bajo impacto — el flujo de firma es corto y normalmente en orientación vertical. **Confidence: low** (no observado, es una inferencia de lectura de código).

## 8. WebAuthn obligatorio sin feature-detection explícita — foco especial

`CheckinClient.tsx` (línea 34) y `LoginForm.tsx` (línea 46) llaman `startAuthentication({ optionsJSON })` de `@simplewebauthn/browser` directamente, sin llamar antes a `browserSupportsWebAuthn()` (0 matches del import en todo `src/`). `EnrollButton.tsx` hace lo mismo con `startRegistration`.

**Verificación de la librería (v13.3.0, código fuente leído en `node_modules/.pnpm/@simplewebauthn+browser@13.3.0/.../esm/methods/startAuthentication.js`):** la propia librería **sí** llama `browserSupportsWebAuthn()` internamente antes de operar, y si no hay soporte lanza `throw new Error('WebAuthn is not supported in this browser')`. Esto matiza el gap: la app no "explota" con un error opaco de runtime sin manejar — la excepción es capturada por los `catch` existentes en los tres componentes. Pero el resultado sigue siendo un problema de UX/negocio:

- En `LoginForm.tsx`, el `catch` sobreescribe el mensaje con uno genérico en español: *"No pudimos verificar tu biometría en este dispositivo."* — no dice *por qué*, ni sugiere abrir en Safari.
- En `CheckinClient.tsx`, el `catch` usa `e.message` directamente, por lo que el usuario vería literalmente el string en inglés de la librería: *"WebAuthn is not supported in this browser"*, mezclado en una UI en español — mensaje técnico, no accionable.
- Ninguno de los tres detecta el contexto **antes** de intentar la acción (no hay banner proactivo "este navegador no soporta biometría, abrí este link en Safari"), así que el empleado ya perdió tiempo dando permiso de geolocalización (en `CheckinClient`) o ingresando credenciales (en `LoginForm`) antes de enterarse de que el flujo no puede continuar.
- El check-in/check-out es "biometría obligatoria" sin fallback (confirmado: no hay rama de código alternativa), así que si `navigator.credentials` no existe o es inconsistente en el WKWebView de WhatsApp, el flujo de fichaje queda **bloqueado por diseño** para ese contexto — la pregunta de negocio no es "¿se rompe con un error feo?" sino "¿el empleado que abre el link de WhatsApp puede fichar alguna vez sin salir a Safari?", y la respuesta actual es no, sin guía en la UI para resolverlo.

**Confidence: medium** para el mecanismo de error (verificado en el código fuente de la librería instalada); **low** para el comportamiento real de `navigator.credentials` dentro del WKWebView de WhatsApp específico (no se ejecutó ahí — es sabido en general que los in-app browsers de WhatsApp en iOS restringen WebAuthn/Credential Management, pero no se confirmó con una prueba en dispositivo en esta auditoría).

## 9. Push — falta detección de standalone en iOS

`PushProvider.tsx` hace feature-detection correcta (`"serviceWorker" in navigator && "PushManager" in window && "Notification" in window`) antes de registrar el service worker, así que no rompe nada en iOS Safari no instalado ni en WhatsApp — simplemente no muestra el banner. Pero no hay ninguna lógica que detecte `window.matchMedia('(display-mode: standalone)')` ni `navigator.standalone` (Safari-specific) para diferenciar "iOS sin instalar como PWA" de "otro problema", ni mensaje que explique al usuario iOS que debe agregar la app a inicio primero. El usuario iOS que nunca instaló la PWA simplemente nunca ve el banner de activación, sin ninguna pista de por qué. **Confidence: high** (ausencia confirmada por grep: 0 matches de `standalone`/`display-mode` en todo `src/`).

## 10. Manifest — iconos incompletos

`public/manifest.webmanifest` sólo declara 2 iconos: `apple-touch-icon.png` (180×180, `purpose: any`, confirmado con `file`) y `icon-512.png` (512×512, `purpose: "any maskable"`, confirmado con `file`). Falta el tamaño intermedio de 192×192 recomendado para Android/Chrome (usado en varios contextos de instalación y en el splash screen de algunos launchers). Además, el mismo asset de 512×512 se reutiliza como `maskable` sin una "safe zone" dedicada (los iconos maskable deberían diseñarse con ~20% de margen interno para que el recorte circular/squircle de algunos launchers Android no corte el logo). **No bloqueante** — la PWA es instalable en iOS y Android igual — pero es un gap frente a las recomendaciones estándar de instalabilidad. **Confidence: high** (lectura directa del JSON + verificación de dimensiones de archivo).

## 11. Service worker

`public/sw.js` es un SW mínimo dedicado exclusivamente a push (`install`/`activate` con `skipWaiting`/`clients.claim`, `push` con parseo JSON y fallback a texto, `notificationclick` con focus/navigate u `openWindow`). No cachea assets — no es offline-first. Esto es consistente con el alcance declarado (push, no soporte offline) y no representa un gap frente a lo esperado. **Correcto. Confidence: high.**

## 12. `touch-action` / gestos

0 usos de `touch-action` explícito en todo el proyecto fuera del canvas de firma (`touch-none` vía Tailwind). No hay gestos custom (swipe en calendario, drag-to-reorder, etc.) que lo requieran hoy — el `react-day-picker` usa su propia interacción por tap/click estándar, sin gestos de swipe entre meses. Neutral, sin gap. **Confidence: high.**

## 13. Calendario (`react-day-picker`)

`globals.css` tiene reglas específicas para mobile (`@media max-width:640px`): `.rdp-day_button { width:100%; height: 2.25rem (36px); font-size: 0.82rem }`. **Nota:** 36px de alto para el botón de día está por debajo del umbral de 44px recomendado para touch targets — mismo patrón de "un poco corto" que `.btn` (sección 3), pero aquí es más notorio porque es una grilla densa de 7 columnas y el usuario debe tocar un día específico dentro de una semana con vecinos muy próximos. El ancho es `100%` de la celda (variable, generalmente >36px en una grilla de 7 columnas en una pantalla de 375-428px de ancho), así que el ancho no es el problema, es el alto de 36px. **Confidence: medium** (valor CSS confirmado; el impacto real de "mistap" en una grilla de calendario no se probó en dispositivo).

`CalendarClient.tsx` y `AdminMiniCalendar.tsx` usan el mismo componente `DayPicker` con `width:100%, max-width:100%` en `.rdp-root`, por lo que no hay overflow horizontal del calendario en ningún ancho de viewport. **Correcto. Confidence: high.**

## 14. Branching por plataforma / User-Agent

No existe ningún sniffing de user-agent en el código (confirmado por D4 y re-verificado aquí); toda adaptación es CSS responsive + feature-detection en runtime. Esto es buena práctica en general, pero significa que no hay ningún mecanismo para mostrar proactivamente un aviso dirigido específicamente a "estás en WhatsApp, abrí en Safari" — cualquier mensaje de ese tipo tendría que agregarse mediante feature-detection (`!browserSupportsWebAuthn()`, ausencia de `PushManager`, etc.) en vez de UA-sniffing, lo cual es factible pero no está implementado. **Confidence: high** (ausencia confirmada por grep).

---

## Resumen por plataforma

- **Desktop (admin):** sin problemas de layout, safe-area no aplica, sidebar fijo estable. Bajo riesgo.
- **iOS Safari, PWA instalada:** cubre zoom fix + safe areas + push (si iOS ≥16.4). Bajo riesgo.
- **iOS Safari, no instalada:** layout y zoom fix funcionan igual; push no funciona y no se explica por qué (gap de comunicación, no de layout).
- **WhatsApp in-app (WKWebView):** layout/zoom/safe-areas funcionan igual que Safari (es el mismo motor WebKit) — **no es un problema de "responsive" en el sentido de layout roto**. El riesgo real y más severo es funcional: WebAuthn obligatorio sin guarda previa ni mensaje claro puede bloquear el flujo de check-in/out para el empleado que abre el link desde un chat sin saber que está en un navegador restringido. Este es el hallazgo de mayor severidad de la auditoría.
- **Android Chrome:** bajo riesgo; gap cosmético de icono 192×192 ausente.

---
Archivo generado como parte de Auditoría A3 (report-only). No se modificó código de la app.
