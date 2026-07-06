# Changelog

Cada release sube la versión en `+0.01`. El número visible abajo a la izquierda en la app coincide con este archivo.

## v0.10 — 2026-07-06

**Sección Empleados: ficha completa editable por el administrador.**

- Nueva sección **Empleados** en el panel admin: listado alfabético por apellido con búsqueda (apellido, nombre, legajo o email) y foto.
- **Ficha de detalle** por empleado con todos los campos del legajo, editables por el admin (incluidos los que el empleado no puede tocar: legajo, nombres, fecha de nacimiento, CUIL, fecha de ingreso, categoría, email).
- **Campos nuevos del legajo**: DNI, imágenes de ambos lados del DNI, del carnet profesional (choferes) y de la libreta sanitaria, foto de frente de cara y **semanas de vacaciones por año** (usadas por las reglas de calendario que vienen).
- Desde la ficha: **resetear contraseña**, **bloquear/desbloquear**, **resetear dispositivo**, ver los documentos enviados al empleado (con estado de firma) y enviarle uno nuevo con el destinatario ya preseleccionado.

**Requiere `pnpm db:push`** (campos nuevos en `EmployeeProfile`).

## v0.09 — 2026-07-06

**Notificaciones push + avisos al empleado.**

- **Web Push (PWA)**: la app ahora puede enviar notificaciones al teléfono aunque esté cerrada. Al entrar, un banner ofrece "Activá las notificaciones"; en iOS requiere tener la app agregada a inicio (iOS 16.4+). El email sigue saliendo siempre como canal de respaldo.
- **El empleado ahora recibe aviso (email + push) cuando:**
  - el admin **aprueba o rechaza** su solicitud de vacaciones/franco;
  - el admin le sube un **documento nuevo** (recibo de sueldo o notificación) a Recibidos.
- Infraestructura: service worker `sw.js`, suscripciones guardadas por usuario (`PushSubscription`), envío vía `web-push` con claves VAPID, y `notifyUser()` unificando email + push para los próximos eventos (vencimientos, recordatorio de check-out, dispositivos).

**Requiere configurar en Vercel**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (ver runbook). También correr `pnpm db:push` para crear la tabla de suscripciones.

## v0.08 — 2026-07-06

**Alineación con el pedido del cliente: alta simplificada y calendario domingo-primero.**

- **Clave temporaria fija "Emmalva01"**: al crear un usuario o resetear su contraseña, el admin ya no recibe una clave aleatoria — siempre es `Emmalva01` (pedido del cliente). El usuario sigue obligado a cambiarla en el primer ingreso (`mustChangePassword`).
- **Registro autoservicio deshabilitado**: `/register` redirige a `/login` y `POST /api/register` responde 410. Las cuentas se crean únicamente desde `/admin/users`.
- **Calendario con semana comenzando domingo** en la vista del empleado (las vacaciones siguen iniciando lunes, como pide el cliente).
- **Sección Horas**: atajos "Este mes" / "Mes anterior" para completar el rango de fechas de una, junto al filtro por empleado ya existente.

## v0.07 — 2026-04-21

**Fix: la duración de la jornada es visible sólo al administrador.**

- Dashboard del empleado: la tarjeta "Última jornada" ya no muestra la duración en hh:mm, sólo el estado (abierta/cerrada).
- Pantalla de check-in: mientras la jornada está en curso ya no corre un contador grande con hh:mm; en su lugar aparece el check verde + "Desde [fecha y hora de inicio]".
- `POST /api/attendance/checkout` ya no devuelve `durationMin` en el response — queda guardada en DB para que el admin la vea en `/admin/attendance` y en el export a Excel.
- La duración sigue calculándose y guardándose en `Attendance.durationMin` igual que antes.

## v0.06 — 2026-04-21

**Emails reales desde el admin + notificaciones in-app.**

- **Envío de emails por Gmail SMTP**: `src/lib/email.ts` ahora tiene nodemailer como driver primario (Gmail SMTP via App Password), con fallback a Resend si no hay credenciales Gmail. Los emails salen literalmente `Emmalva <emmalvasas@gmail.com>` desde la cuenta de Maximiliano Klein, con `reply_to` a la misma.
- **Cron de vencimientos funcional end-to-end**: el cron diario sigue disparando la alerta 30 días antes, ahora los emails efectivamente llegan a los empleados en vez de loguearse.
- **Emails al admin** en tres eventos: nuevo empleado registrado, nueva solicitud de vacaciones/franco, documento cargado. Cada email tiene botón "Revisar" que lleva directo al tab correspondiente.
- **Badges in-app** en la nav del admin:
  - Desktop: contador al lado del item (Usuarios, Vacaciones / Francos, Documentación).
  - Mobile: badge en bottom nav y contador grande en el botón del menú (top bar).
- Las cuentas se calculan en cada navegación (Server Component en `admin/layout.tsx`), así que siempre son tiempo-real.

**Requiere configurar en Vercel**: `GMAIL_USER=emmalvasas@gmail.com` y `GMAIL_APP_PASSWORD=<app password de Maximiliano>`. Sin estos, email.ts hace fallback a Resend y, si no hay key ahí, loguea a consola. Ver `docs/runbook.md` para la guía de cómo generar el App Password.

## v0.05 — 2026-04-21

**Alta de usuarios por el admin.**

- Nuevo botón **"Nuevo usuario"** en `/admin/users`. Permite crear un usuario (Empleado o Administrador) sin esperar que se autoregistre, opcionalmente con nombre, apellido, legajo y fecha de ingreso pre-cargados.
- La cuenta se crea **activa** y con contraseña temporal generada automáticamente. Al cerrarse el diálogo, el admin ve la contraseña en un toast y queda copiada al portapapeles para enviarla al usuario.
- El flag `mustChangePassword` queda en true → la primera vez que el usuario ingresa, el sistema lo fuerza a elegir una contraseña propia (igual que el reset).
- El admin también puede crear otros administradores desde este flujo.

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
