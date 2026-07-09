# Changelog

Cada release sube la versión en `+0.01`. El número visible abajo a la izquierda en la app coincide con este archivo.

## v0.25 — 2026-07-09

**Auditoría de calidad y seguridad: la app quedó más segura y estable.**

- **Sesiones más seguras**: si el administrador te deshabilita o cambia tu rol, ahora tiene efecto al instante (antes podía tardar en aplicarse). Mientras tengas que cambiar la clave temporaria, no podés usar el resto de la app hasta hacerlo.
- **Archivos privados**: las fotos y documentos (DNI, carnet, libreta, firma) ya no se sirven por un enlace público adivinable; se entregan sólo a usuarios con sesión iniciada.
- **Check-in más robusto**: se evita el doble fichaje simultáneo, y el check-in vuelve a funcionar cuando abrís el link desde WhatsApp u otras apps. Los administradores pueden **cerrar una jornada** que quedó abierta.
- **Vacaciones y francos**: el cupo y el saldo se vuelven a validar en el momento de **aprobar** (no sólo al pedir), evitando aprobar de más por pedidos hechos al mismo tiempo.
- **Fechas**: los reportes y el "hoy" del panel usan la hora de Argentina de forma consistente (el export ya no recorta el último día).
- **Más avisos claros**: las acciones sensibles piden confirmación, no se pueden apretar dos veces, y hay pantallas de carga/error cuando algo falla.
- **Mejoras internas** (no se ven pero importan): validación real del tipo de archivo subido, encabezados de seguridad, registro de auditoría del export, límites de intentos en contraseña/biometría, índices y migraciones versionadas de la base, y arreglos de accesibilidad y de tamaño de botones en el celular.

## v0.24 — 2026-07-08

**Fix: al enviar el perfil siempre aparece un aviso.**

- Antes, si faltaba un dato obligatorio, el navegador bloqueaba el envío **en silencio** (el aviso quedaba en un campo fuera de pantalla) y parecía que el botón no hacía nada. Ahora, al tocar **"Enviar cambios para aprobación"** siempre aparece un mensaje: si faltan datos, dice **cuáles** (ej. "Faltan datos obligatorios: Dirección, Contacto de emergencia"); si está todo, confirma el envío o avisa que no hay cambios. El mensaje se trae a la vista automáticamente.
- La **foto** y la **firma** ahora confirman "guardada" apenas se cargan (se guardan solas, sin depender del botón).

## v0.23 — 2026-07-08

**Documentación editable desde perfil y documentos + talles de pantalón.**

- **Libreta y carnet editables desde dos lugares**: además de Mi perfil, ahora en **Documentación** el empleado carga/renueva la fecha de vencimiento y las **dos imágenes (frente y dorso)** de cada documento. Es el mismo dato en ambos lados.
- El **carnet profesional** solo aparece para la categoría **chofer** (los ayudantes no lo ven).
- La sección "Subir documento" pasó a llamarse **"Otros documentos"** (para adjuntar cualquier otro archivo); libreta y carnet se gestionan en el bloque de Vencimientos.
- **Talles de pantalón**: ahora van de **36 a 56 de a 2** (36, 38, … 56), separados de los talles de remera/buzo/campera (XS a XXXL).

## v0.22 — 2026-07-07

**Ajustes de feedback: firma dibujada, foto completa, vencimientos y calendario.**

- **Firma digital**: ahora se **firma con el dedo en la pantalla** (ya no se sube una foto) y queda guardada como firma digital.
- **Foto de frente**: se muestra completa (antes se veía recortada).
- **Documentación del empleado**: se agregó el panel **"Vencimientos de tu perfil"** con la libreta sanitaria y el carnet (fecha + acceso a las imágenes) que el empleado ya cargó en su perfil.
- **Calendario del panel admin**: ahora muestra las vacaciones y francos aprobados de **otros meses** al navegar (antes sólo el mes actual).
- **Vacaciones**: si al empleado no le alcanza el saldo para 14 días, ya **no aparece la opción de 14 días**; si no tiene saldo, se avisa y no puede solicitar.
- Recordatorio: los talles de calzado van de 36 a 48 (ya estaba así).

## v0.21 — 2026-07-07

**Ícono correcto de la app + el empleado carga todos sus datos.**

- **Ícono de la PWA**: se reemplazó el asset equivocado (aparecía el logo de otra app al agregar a inicio) por el isotipo de Emmalva. Ahora al "Agregar a inicio" el ícono es el logo de la empresa. *(En iPhone, si ya la tenías agregada, borrala de inicio y volvé a agregarla para refrescar el ícono.)*
- **Perfil del empleado**: ahora carga también **apellido, nombre y foto de frente de cara**. El único dato reservado al administrador es el **CUIL** (además de legajo, fecha de ingreso y email). Así se evita el ida y vuelta pidiendo datos.

## v0.20 — 2026-07-07

**Perfil del empleado: más campos a su cargo (feedback de prueba).**

- **Fecha de nacimiento, categoría (chofer/ayudante) y firma digital** ahora las carga el propio empleado (antes eran solo del admin). Al elegir **Chofer** se habilita el vencimiento del carnet profesional y sus imágenes.
- **Imágenes de documentos en Vencimientos**: al cargar la fecha, el empleado adjunta fotos de ambos lados de la **libreta sanitaria** y del **carnet** (si es chofer). Se guardan al instante.
- **Talles como listas**: remera/buzo/campera/pantalón (XS a XXXL) y calzado (36 a 48), en vez de texto libre — también en la ficha del admin.
- Los cambios del empleado siguen la misma regla: la primera carga se guarda directa; las ediciones posteriores pasan por aprobación del admin (la firma y las imágenes se guardan directo).

## v0.19 — 2026-07-07

**Correcciones sobre feedback de prueba.**

- **Fechas del calendario corridas un día**: las vacaciones y francos se mostraban un día antes (una semana lunes→domingo se veía domingo→sábado, y algún franco figuraba en el mes anterior). Era un problema de zona horaria: las fechas se guardan a medianoche UTC y se renderizaban en hora local. Ahora todas las fechas-calendario (vacaciones, francos, vencimientos, nacimiento) se manejan y muestran de forma consistente, sin correrse. Los timestamps (check-in/out, envíos) se muestran siempre en hora de Argentina.
- **Zoom en el celular al tocar un campo**: en iOS, al enfocar un input la pantalla hacía zoom y quedaba "muy ancha" (recortada). Se corrigió forzando 16px en los campos en mobile, que evita el zoom automático.
- **Usuario nuevo va directo a completar su perfil**: al ingresar por primera vez, si todavía no cargó sus datos personales, la app lo lleva directo a **Mi perfil**. Esa primera carga se guarda directo (sin esperar aprobación); las ediciones posteriores sí pasan por el administrador.

## v0.18 — 2026-07-06

**Fix: los crons ahora corren de verdad.**

- El middleware redirigía `/api/cron/*` a `/login` (sin sesión), así que los crons de vencimientos y de recordatorio de check-out nunca llegaban a ejecutarse — probablemente desde v0.01. Ahora `/api/cron` está exento del middleware y se autentica con su propio `CRON_SECRET`.
- Runbook: corregida la URL de producción (`checkin-system-beta.vercel.app`).

## v0.17 — 2026-07-06

**Recibidos con filtros + cierre del paquete de mejoras.**

- **Recibidos**: tabs para separar **Recibos** y **Notificaciones**, y filtro por **período mensual**. Los documentos internos pasan a llamarse "Notificación" (llamados de atención / suspensiones), alineado con el pedido del cliente.
- Cierre del paquete v0.08 → v0.17: alta con clave fija, push, ficha de empleados, aprobación de cambios de perfil, dashboard con gráficos, reglas de calendario, recordatorio de check-out, bloqueo automático por vencimiento y aprobación de dispositivos.

## v0.16 — 2026-07-06

**Aprobación de dispositivos por el administrador.**

- Cuando un empleado registra su biometría (primer dispositivo o tras un reset), el dispositivo queda **pendiente de aprobación**: puede usar la app pero **no puede fichar** hasta que el admin lo apruebe. El admin recibe un email y ve el estado en **Usuarios** (aprobar / rechazar).
- Al aprobar o rechazar, el empleado recibe **email + push**. Rechazar equivale a un reset: borra la credencial para que registre el dispositivo correcto.
- Los dispositivos de administradores se auto-aprueban.
- El check-out queda a propósito **sin bloquear**, para que una jornada abierta siempre pueda cerrarse.

**Deploy (crítico)**: correr `pnpm db:push` y después `node scripts/backfill-device-approval.mjs` — aprueba retroactivamente los dispositivos ya registrados; sin esto, los usuarios existentes quedan sin poder fichar.

## v0.15 — 2026-07-06

**Bloqueo automático por documentación vencida.**

- Los recordatorios diarios de vencimiento (30 días antes, con días restantes) ahora también salen por **push**, además del email.
- **Bloqueo automático**: al día siguiente del vencimiento del carnet profesional (choferes) o la libreta sanitaria, el cron bloquea la cuenta (`DISABLED` con motivo). El empleado recibe email + push explicando el motivo, y los administradores un aviso. **Sólo el admin puede desbloquear** (el desbloqueo limpia el motivo).
- Los administradores y los perfiles sin fecha cargada quedan excluidos del bloqueo automático.
- El bloqueo manual del admin queda registrado con motivo `MANUAL` para distinguirlo.

**Requiere `pnpm db:push`** (campo `disabledReason`).

## v0.14 — 2026-07-06

**Recordatorio de check-out a las 7 h 45 m.**

- Cron cada 15 minutos (`/api/cron/checkout-reminder`): si pasaron 7 h 45 m del check-in y la jornada sigue abierta, el empleado recibe **email + push** preguntando si sigue prestando servicio, con recordatorio de hacer check-out.
- Un solo aviso por jornada (`checkoutReminderSentAt`).

**Atención (deploy)**: los crons cada 15 minutos requieren **Vercel Pro**. En plan Hobby, configurar un scheduler externo gratuito (ej. cron-job.org) que llame `GET /api/cron/checkout-reminder?key=<CRON_SECRET>` cada 15 minutos — el endpoint es el mismo. También correr `pnpm db:push`.

## v0.13 — 2026-07-06

**Reglas nuevas de vacaciones y francos.**

- **Saldo anual de vacaciones**: cada empleado tiene "semanas de vacaciones por año" (lo asigna el admin en la ficha, default 2). El sistema valida que lo solicitado no exceda el saldo y lo muestra en el calendario.
- **Cupo por categoría**: máximo **un chofer y un ayudante** de vacaciones por semana. Las semanas ya tomadas por un compañero de la misma categoría aparecen deshabilitadas.
- **Franco mensual**: máximo **un franco por mes** por empleado (además de la regla existente de un solo empleado con franco por día). Los meses ya usados aparecen deshabilitados.
- Paneles informativos en el calendario del empleado con el saldo y las reglas.

## v0.12 — 2026-07-06

**Dashboard del administrador con gráficos.**

- **Tres gráficos torta del día**: empleados con check-in, con check-out y ausentes (activos sin fichar y sin vacaciones/franco aprobado hoy).
- **Próximos 5 vencimientos** de carnet profesional y libreta sanitaria de toda la plantilla, con días restantes, alerta de vencidos y link directo a la ficha del empleado.
- **Calendario del mes** con las vacaciones y francos aprobados (semana comenzando domingo), con el detalle de quién y cuándo.
- Los KPIs pendientes y accesos rápidos siguen abajo; se suma el contador de cambios de perfil.

## v0.11 — 2026-07-06

**Cambios de perfil con aprobación del administrador.**

- El empleado ya no edita su perfil directo: al guardar, los cambios quedan **pendientes de aprobación** y el admin los revisa en la nueva sección **Cambios de perfil** (diff campo por campo: actual → propuesto).
- Al aprobar o rechazar, el empleado recibe **notificación por email + push** (con motivo opcional en el rechazo).
- **Campos bloqueados para el empleado** (sólo los edita el admin desde la ficha): legajo, apellidos, nombres, fecha de nacimiento, DNI, CUIL, fecha de ingreso, categoría, email, foto de cara y firma digital.
- Una sola solicitud pendiente por empleado; el form muestra un banner y bloquea reenvíos hasta que el admin resuelva.
- La **carga inicial** del perfil (empleado nuevo sin datos) sigue siendo directa para no trabar el onboarding; el admin la revisa desde la ficha.
- Badge con pendientes en la nav del admin.

**Requiere `pnpm db:push`** (tabla `ProfileChangeRequest`).

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
