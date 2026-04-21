# Changelog

Cada release sube la versión en `+0.01`. El número visible abajo a la izquierda en la app coincide con este archivo.

## v0.04 — 2026-04-21

**Optimización mobile.**

- **Navegación mobile**: en pantallas menores a 768px aparece una top bar con logo + tema + menú, y una bottom nav con los 4 tabs principales + "Más". El resto de las secciones vive en un drawer que se abre desde "Más" o el botón de menú. En desktop sigue viéndose el sidebar completo.
- **Tablas responsive**: todas las tablas (usuarios, solicitudes, documentos, jornadas, entregas, recibidos) ahora scrollan horizontalmente en mobile sin romper el layout del panel.
- **Calendario responsive**: react-day-picker toma el 100% del ancho con celdas más grandes táctiles (mínimo 36px de alto).
- **PWA**: manifest con nombre, icono y colores. Podés "Agregar a inicio" desde iOS/Android y la app abre en modo standalone.
- **Viewport + safe areas**: meta viewport correcto con `viewport-fit=cover`, `theme-color` según modo claro/oscuro, padding con `env(safe-area-inset-*)` en top bar, bottom nav y drawer para respetar el notch y la barra inferior.
- **AuthShell responsive**: padding reducido en pantallas chicas y respeto de safe areas.

## v0.03 — 2026-04-21

**Modo claro / oscuro + tipografía Gotham Rounded.**

- **Light y Dark mode**: por defecto la app sigue la preferencia del sistema (`prefers-color-scheme`). El ícono sol/luna en el rail lateral (o junto al logo en login y manual) permite cambiarlo manualmente; la preferencia queda guardada en `localStorage`.
- Un script inline aplica el tema antes de que React hidrate, así no hay "flash" al cargar.
- Todos los paneles, tablas, inputs, botones y badges se adaptan automáticamente al tema via tokens CSS.
- **Gotham Rounded** (Light, Book, Medium, Bold) self-hosted en `/public/fonts/gotham-rounded/`, reemplazando a Nunito. Coincide con la fuente indicada en el Manual de Marca Emmalva.

## v0.02 — 2026-04-21

**Rebrand a Emmalva.**

- Nueva identidad visual: isotipo cian (#29ABE2) + tipografía Nunito (alternativa libre a Gotham Rounded del manual de marca).
- Paleta primaria cambia de naranja a cian Emmalva en toda la app (botones, badges, focos, panels, aurora del fondo).
- Se reemplaza "Checkin System" por "Emmalva" en login, metadata, emails, PDF de firma, export de Excel y manual.
- Logo horizontal y vertical disponibles en `/public/emmalva-*.svg` y `.png` (tomados del Manual de Marca).
- Nuevo admin inicial: `emmalvasas@gmail.com` (Maximiliano Klein).

## v0.01 — 2026-04-21

**Primera versión del MVP.** Todo construido sobre el look & feel del Protofire Suite.

- **Autenticación**: registro de empleados + validación del administrador, login con email/contraseña y biometría (WebAuthn — Face ID / Touch ID / Windows Hello).
- **Device binding**: cada cuenta queda atada a un único dispositivo. El administrador puede resetearlo cuando haga falta.
- **Reset de contraseña**: el administrador genera una contraseña temporal; el empleado la cambia la primera vez que ingresa.
- **Perfil del empleado**: todos los campos del legajo (datos personales, CUIL, domicilio, talles, contacto de emergencia, firma digital PNG). Legajo y fecha de ingreso los carga el admin.
- **Calendario**: solicitudes de vacaciones (empiezan siempre un lunes, 7 o 14 días) y de franco diario (un solo empleado por día). Validación por el admin.
- **Documentación**: carga de carnet profesional y libreta sanitaria (PDF o foto), con campo de vencimiento y validación del admin.
- **Alertas de vencimiento**: cron diario que envía email (vía Resend) 30 días antes del vencimiento de cada documento.
- **Check-in / Check-out**: geolocalización + biometría. El admin ve la duración de cada jornada y puede exportar a Excel filtrando por fecha y empleado.
- **Entregas con firma automática**: el admin sube recibos o documentos internos (PDF); cuando el empleado los abre, se firman automáticamente con su firma digital, nombre, CUIL, timestamp y hash SHA-256.
- **Manual de usuario in-app** accesible desde cualquier pantalla.
- **Badge de versión** visible en todas las pantallas, lincado al changelog.
