# D4 — Discovery de plataforma (QA, report-only)

Fecha: 2026-07-08
Alcance revisado: `src/app/layout.tsx`, `public/manifest.webmanifest`, `public/sw.js`, `src/app/globals.css`, `src/components/layout/AppShell.tsx`, `src/components/providers/PushProvider.tsx`, WebAuthn (`EnrollButton.tsx`, `LoginForm.tsx`, `CheckinClient.tsx`), `tailwind.config.ts`, íconos en `public/`.

No se modificó código (report-only).

## 1. Plataformas objetivo (declaradas por el negocio)

- Empleados: mobile — iOS Safari + navegador in-app de WhatsApp.
- Admin: desktop.
- No hay ningún branch explícito por User-Agent en el código (`grep` de `userAgent|navigator\.|isIOS|isMobile|isSafari|standalone` sólo encuentra: lectura de header `user-agent` para logging en `src/app/api/push/subscribe/route.ts:25`, sin lógica condicional). Toda la adaptación de plataforma es vía CSS responsive (breakpoint `md`) y feature-detection en runtime (`"PushManager" in window`, `navigator.geolocation`, WebAuthn), no vía sniffing de UA.

## 2. Breakpoints / media queries (lista completa)

- `tailwind.config.ts` no define `screens` custom → se usan los breakpoints default de Tailwind: `sm=640px`, `md=768px`, `lg=1024px`, `xl=1280px`, `2xl=1536px`.
- Uso real en el código: solo se usa `md:` (768px) como quiebre mobile/desktop. No hay uso de `sm:`, `lg:`, `xl:`, `2xl:` en `AppShell.tsx` (verificado por grep, 5 matches de `md:` en ese archivo).
- `globals.css` tiene un único `@media` explícito: `@media (max-width: 640px)` (línea 287) que:
  - ajusta el date-picker (`react-day-picker`) para mobile,
  - fuerza `font-size: 16px` en `.surface-control, .surface-select, .surface-textarea, input, select, textarea` — comentario explícito en el propio CSS reconociendo el bug de zoom automático de iOS en inputs con `font-size < 16px` "y no lo restaura en el navegador in-app de WhatsApp".
- No hay `@media (prefers-color-scheme)` en CSS (el theming claro/oscuro se resuelve por clase `.light`/`.dark` + script de init, no por media query), aunque sí hay `themeColor` con `prefers-color-scheme` en `viewport` (meta tags, no CSS).
- No hay ninguna media query de `hover`, `pointer` ni `any-hover`/`any-pointer` en todo el CSS (0 matches).

## 3. Viewport & safe areas

- `src/app/layout.tsx` exporta `viewport`: `width: device-width`, `initialScale: 1`, `maximumScale: 5`, `viewportFit: "cover"`.
  - `maximumScale: 5` permite zoom manual del usuario (bien para accesibilidad), pero por sí solo no evita el zoom automático al foco de input — eso lo resuelve el `font-size: 16px` de `globals.css`.
  - `viewportFit: "cover"` habilita el uso de `env(safe-area-inset-*)`.
- Safe areas usadas consistentemente en `AppShell.tsx`: top bar (`paddingTop: calc(env(safe-area-inset-top) + 0.75rem)`), bottom nav (`paddingBottom: env(safe-area-inset-bottom)`), drawer (`paddingTop`/`paddingBottom` con `env(safe-area-inset-*)`), y clase utilitaria `.modal-safe` en `globals.css` (línea 297) para modales full-height.
- No se encontró ningún `touch-action` explícito en `globals.css` ni en componentes (0 matches) — se depende del comportamiento default del navegador; puede ser relevante si en algún momento se agregan gestos (swipe en calendario, drag, etc.).

## 4. PWA / manifest

`public/manifest.webmanifest`:
- `start_url: "/"`, `display: "standalone"`, `background_color`/`theme_color` definidos.
- `icons`: solo 2 entradas — `apple-touch-icon.png` (180×180, `purpose: any`) e `icon-512.png` (512×512, `purpose: "any maskable"`). Verificado con `file`: ambos PNG existen y con las dimensiones declaradas.
  - Falta un ícono intermedio típico de Android (192×192) — no bloqueante pero es un gap frente a las recomendaciones estándar de instalabilidad en Chrome/Android.
  - El 512×512 se reutiliza como maskable; no hay ícono maskable dedicado con "safe zone" propia, riesgo menor de recorte visual en algunos launchers Android.
- `layout.tsx` metadata: `manifest: "/manifest.webmanifest"`, `appleWebApp: { capable: true, statusBarStyle: "black-translucent" }`, `icons.apple: "/apple-touch-icon.png"` — correcto para instalación en iOS (Add to Home Screen).
- No hay `<meta name="apple-mobile-web-app-capable">` explícito fuera del objeto `appleWebApp` de Next (Next lo genera), no se detectaron duplicados ni conflictos.

## 5. Service worker / push (con requisitos iOS)

`public/sw.js`: SW mínimo dedicado a push — `install`/`activate` con `skipWaiting`/`clients.claim`, listener `push` (parseo JSON con fallback a texto) y `notificationclick` (focus/navigate o `openWindow`). No cachea assets (no es un SW offline-first), por lo que no hay riesgo de contenido stale, pero tampoco hay soporte offline.

`PushProvider.tsx` (registro/suscripción):
- Feature-detection correcta: aborta si falta `serviceWorker`, `PushManager` o `Notification` en `window` — esto es clave porque en iOS Safari (no instalado como PWA) y en el navegador in-app de WhatsApp estas APIs no existen, así que el flujo falla silenciosamente (no rompe la app) pero tampoco informa al usuario **por qué** no ve el banner de activar notificaciones.
- **No hay detección de modo standalone ni mensaje específico para iOS** indicando "instalá la app a la pantalla de inicio para recibir notificaciones" — el usuario iOS que nunca instaló la PWA simplemente nunca ve el banner, sin explicación.

Requisitos iOS conocidos que el código no verifica ni comunica:
- Push (Web Push API / `PushManager`) en iOS Safari solo funciona si la PWA fue **agregada a la pantalla de inicio** (modo standalone) y con iOS ≥ 16.4. En Safari normal (pestaña de navegador) o en cualquier in-app browser, `PushManager` no existe.
- El flujo de "Agregar a inicio" en iOS **no está disponible dentro del navegador in-app de WhatsApp** — WhatsApp usa un WKWebView limitado que no expone el botón de compartir/agregar-a-inicio de Safari. El usuario debe explícitamente abrir el link en Safari ("Abrir en el navegador") antes de poder instalar. No hay ningún banner/mensaje en la app que guíe este paso.
- Los permisos de notificación en iOS se piden por app instalada (identidad separada de la pestaña de Safari); si el usuario reinstala la PWA, la suscripción anterior se invalida — no se detectó lógica de manejo de suscripciones huérfanas más allá del re-subscribe silencioso ya existente.

## 6. Input modes

- Touch: es el modo primario implícito (bottom nav con targets de 44px+ via `h-11`/`py-2.5`, drawer deslizable). No hay soporte de gestos custom (swipe) ni `touch-action` restrictions.
- Puntero/mouse: estilos `hover:` existen (6 matches en `globals.css`, ej. `.btn-ghost:hover`, `.rail-icon-button:hover`, `.surface-card-hover:hover`) pero **sin guardas `@media (hover: hover)`** — en touch devices estos estilos `:hover` pueden quedar "pegados" tras un tap (comportamiento normal de WebKit/Blink en touch, generalmente inofensivo pero no es un hover intencional).
- Teclado: no se detectaron atajos de teclado ni manejo especial de foco más allá del CSS `:focus-visible` en `.surface-control`/`.surface-textarea`.
- Biometría (WebAuthn) es un input mode **obligatorio** para check-in/check-out (`CheckinClient.tsx`: "Biometría obligatoria", llama `startAuthentication` de `@simplewebauthn/browser` sin fallback) y para enrolamiento (`EnrollButton.tsx` con `startRegistration`). Ninguno de los dos hace `browserSupportsWebAuthn()` / feature-detection antes de invocar — si el navegador no soporta `navigator.credentials` (el caso del in-app browser de WhatsApp), la llamada explota con una excepción de la librería, capturada genéricamente por el `catch` (`e.message`) y mostrada como error, pero no como un mensaje claro de "este navegador no soporta biometría, abrí en Safari".
- Geolocation (`navigator.geolocation.getCurrentPosition`) en `CheckinClient.tsx` con `enableHighAccuracy: true, timeout: 15000` — feature-detection presente (`if (!navigator.geolocation)`), pero sin manejo diferenciado de permiso denegado vs. no soportado vs. timeout salvo el mensaje crudo de `GeolocationPositionError`.

## 7. Matriz declarado vs. real

| Ítem | Declarado / esperado | Real (código) | Gap |
|---|---|---|---|
| Breakpoint mobile/desktop | Responsive mobile-first | Un solo breakpoint `md` (768px), sin `sm`/`lg`/`xl` en layout | Bajo — funciona pero es "binario", sin ajuste fino para tablets |
| Zoom en inputs iOS/WhatsApp | Debe evitarse | Mitigado explícitamente con `font-size:16px` bajo `max-width:640px` + comentario que documenta el motivo | Cubierto |
| Safe areas (notch/home indicator) | Requerido en iOS | `env(safe-area-inset-*)` aplicado en header, bottom nav, drawer y `.modal-safe` | Cubierto |
| PWA instalable en iOS | Requerido para push | `manifest` + `appleWebApp` + iconos correctos → instalable | Cubierto en teoría, pero **no accesible desde el in-app browser de WhatsApp** sin salir a Safari, y la app no lo comunica |
| Push notifications | "Push activo" (según memoria del proyecto) | Requiere PWA instalada en iOS ≥16.4; sin detección de standalone ni mensaje guía para iOS/WhatsApp | Gap real — usuarios iOS/WhatsApp que no instalaron la PWA no reciben push y no saben por qué |
| WebAuthn/biometría para check-in | "depende de plataforma" | Obligatorio, sin feature-detection previa (`browserSupportsWebAuthn`), sin mensaje específico para navegadores sin soporte | Gap — en WhatsApp in-app browser el check-in biométrico probablemente falla con error genérico, bloqueando el flujo crítico de negocio |
| touch-action / gestos | No declarado explícitamente | 0 usos de `touch-action` en todo el proyecto | Neutral, sin gestos custom que lo requieran hoy |
| hover-only affordances | Debe evitarse en touch | `hover:` usado sin guard `(hover: hover)`, pero solo estético (no oculta funcionalidad detrás de hover) | Bajo riesgo |
| Manifest icons | Set completo recomendado | Solo 2 tamaños (180, 512), falta 192 típico de Android, maskable reutiliza el mismo asset sin safe zone | Bajo — instalable pero no óptimo en Android |
| Service worker | Push + posible offline | Solo push, sin cache/offline (alcance intencional, no es un gap si no se esperaba soporte offline) | Cubre el alcance declarado |
| Branching por User-Agent | Implícito en la narrativa ("distinto por plataforma") | No existe ningún UA-sniffing; todo es feature-detection + CSS responsive | Consistente con buenas prácticas, pero significa que no hay ningún warning proactivo dirigido a WhatsApp/iOS Safari específicamente |

## 8. Riesgos por plataforma

**iOS Safari (no instalada como PWA):**
- Push no funciona (`PushManager` ausente) sin mensaje explicativo — el usuario simplemente nunca ve el banner de activación.
- WebAuthn con Face ID/Touch ID debería funcionar (Safari soporta WebAuthn de plataforma) — riesgo bajo aquí, salvo versiones muy viejas de iOS.

**In-app browser de WhatsApp (WKWebView restringido):**
- Riesgo alto/crítico: `navigator.credentials` (WebAuthn) muy probablemente no está disponible o se comporta de forma inconsistente en este contexto — y el check-in/check-out es "biometría obligatoria" sin fallback ni detección previa. Esto puede bloquear completamente el flujo core de negocio para empleados que abren el link de check-in desde un chat de WhatsApp sin darse cuenta de que están en el in-app browser.
- No hay forma de "Agregar a pantalla de inicio" desde dentro de WhatsApp — el usuario debe saber tocar "Abrir en el navegador" manualmente; la app no detecta este contexto ni lo sugiere.
- Push tampoco funcionará ahí (mismo problema que Safari no instalado, agravado).
- El fix de zoom en inputs (`font-size:16px`) está explícitamente pensado para este caso ("no lo restaura en el navegador in-app de WhatsApp") — es la única mitigación específica para WhatsApp que existe en el código.

**Android Chrome (fuera del foco declarado pero relevante para admin/otros):**
- Push y WebAuthn funcionan de forma más estándar; principal gap es el ícono 192×192 ausente (cosmético).

**Desktop (admin):**
- Sidebar fijo vía `md:flex`, sin problemas de safe-area ni zoom; WebAuthn depende de si la máquina tiene autenticador de plataforma (Windows Hello/Touch ID) — no hay fallback a llave de seguridad USB visible en el flujo, pero está fuera del foco mobile de este discovery.

---
Archivo generado como parte de Discovery D4 (report-only). No se realizaron cambios de código.
