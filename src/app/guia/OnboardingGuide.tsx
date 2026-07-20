"use client";

import { useEffect, useRef } from "react";

/* ── Estilos de la guía, acotados a .og-root ──────────────────────────────
   El HTML original inyectaba CSS global con clases genéricas (.card, .badge,
   .eyebrow, .field, .panel…) que colisionan con globals.css de la app. Cada
   selector va prefijado con `.og-root ` y las variables viven en .og-root en
   vez de :root. @keyframes blink → og-blink para no chocar. Se eliminó el
   "modo frame". Compromiso deliberado: tema único oscuro. ── */
const STYLES = `
.og-root{
  --ink:#070c11; --ink-2:#0a1017;
  --panel:#0f1922; --panel-2:#16232e; --raise:#1d2d3a;
  --line:rgba(122,162,178,.14); --line-2:rgba(122,162,178,.26);
  --fg:#eaf3f5; --muted:#8ba1ab; --faint:#5f757f;
  --accent:#24d3d4;               /* cian de marca Emmalva */
  --accent-soft:rgba(36,211,212,.14);
  --blue:#3b82f6;                 /* CTA primario */
  --blue-ink:#f2f7ff;
  --ok:#35d39a; --warn:#f6b545; --bad:#fb6f6f;
  --r:20px;
  --stage-max:1040px;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;
  --round:ui-rounded,"SF Pro Rounded","Segoe UI",Roboto,system-ui,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  min-height:100dvh;
  display:flex; flex-direction:column;
  background:var(--ink);
  color:var(--fg);
  font-family:var(--font);
  -webkit-font-smoothing:antialiased;
}
.og-root *{box-sizing:border-box}
.og-root .wrap{
  flex:1;
  background:
    radial-gradient(120% 90% at 18% -10%, rgba(36,211,212,.10), transparent 55%),
    radial-gradient(120% 90% at 100% 0%, rgba(59,130,246,.10), transparent 50%),
    var(--ink);
  color:var(--fg);
  font-family:var(--font);
  -webkit-font-smoothing:antialiased;
  padding:clamp(18px,4vw,44px) clamp(14px,4vw,40px) 30px;
  display:flex; flex-direction:column; align-items:center; gap:22px;
}

/* ── Cabecera del documento ── */
.og-root .masthead{width:100%; max-width:var(--stage-max); display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap}
.og-root .brand{display:flex; align-items:center; gap:11px}
.og-root .brand .logo{width:30px; height:30px; color:var(--accent); flex:none}
.og-root .brand b{font-family:var(--round); font-weight:700; font-size:19px; letter-spacing:.2px}
.og-root .brand small{display:block; color:var(--muted); font-size:11px; font-weight:500; letter-spacing:.02em; margin-top:1px}
.og-root .kicker{font-family:var(--mono); font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:var(--accent); border:1px solid var(--line-2); border-radius:999px; padding:7px 13px; background:var(--accent-soft)}

/* ── Escenario: teléfono + relato ── */
.og-root .stage{width:100%; max-width:var(--stage-max); display:grid; grid-template-columns:minmax(0,320px) minmax(0,1fr); gap:clamp(22px,4vw,52px); align-items:center}
@media (max-width:760px){ .og-root .stage{grid-template-columns:1fr; justify-items:center; gap:26px} }

/* ── Teléfono ── */
.og-root .phone{
  position:relative; width:300px; height:625px; flex:none;
  background:linear-gradient(#0c141c,#070c12);
  border:1px solid var(--line-2);
  border-radius:46px; padding:11px;
  box-shadow:0 40px 80px -30px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.05);
}
.og-root .screenport{position:relative; width:100%; height:100%; border-radius:36px; overflow:hidden; background:var(--ink-2)}
.og-root .island{position:absolute; top:12px; left:50%; transform:translateX(-50%); width:96px; height:26px; background:#05090d; border-radius:999px; z-index:6}
.og-root .statusbar{position:absolute; top:0; left:0; right:0; height:44px; display:flex; align-items:center; justify-content:space-between; padding:0 22px; font-size:12px; font-weight:600; color:var(--fg); z-index:5}
.og-root .statusbar .dots{display:flex; gap:5px; align-items:center; color:var(--muted)}
.og-root .statusbar .bat{width:22px; height:11px; border:1.4px solid var(--muted); border-radius:3px; position:relative}
.og-root .statusbar .bat::after{content:""; position:absolute; inset:1.6px; right:5px; background:var(--ok); border-radius:1px}
.og-root .statusbar .bat::before{content:""; position:absolute; right:-3px; top:3px; width:2px; height:5px; background:var(--muted); border-radius:0 1px 1px 0}

/* pantallas apiladas con crossfade */
.og-root .screens{position:absolute; inset:0}
.og-root .screen{position:absolute; inset:0; padding:52px 18px 18px; display:flex; flex-direction:column; opacity:0; transform:translateY(10px) scale(.99); transition:opacity .55s ease, transform .55s ease; pointer-events:none; overflow:hidden}
.og-root .screen.on{opacity:1; transform:none}
.og-root .screen::-webkit-scrollbar{display:none}

.og-root .apphead{display:flex; align-items:center; justify-content:space-between; margin-bottom:14px}
.og-root .apphead .l{display:flex; align-items:center; gap:8px}
.og-root .apphead .logo{width:22px; height:22px; color:var(--accent)}
.og-root .apphead b{font-family:var(--round); font-weight:700; font-size:15px}
.og-root .apphead .icn{color:var(--muted); display:flex; gap:12px}
.og-root .eyebrow{font-family:var(--mono); font-size:9.5px; letter-spacing:.2em; text-transform:uppercase; color:var(--faint)}
.og-root .h1{font-family:var(--round); font-weight:700; font-size:21px; line-height:1.15; margin:3px 0 12px; text-wrap:balance}
.og-root .lead{color:var(--muted); font-size:12.5px; line-height:1.45; margin:-6px 0 14px}

.og-root .card{background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:14px}
.og-root .lbl{font-family:var(--mono); font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:var(--faint); margin-bottom:6px}
.og-root .field{height:42px; background:var(--panel-2); border:1px solid var(--line); border-radius:12px; display:flex; align-items:center; padding:0 13px; font-size:13px; color:var(--fg); margin-bottom:12px}
.og-root .field.ph{color:var(--faint)}
.og-root .field.bad{border-color:var(--bad); box-shadow:0 0 0 3px rgba(251,111,111,.15)}
.og-root .field .caret{width:1.5px; height:17px; background:var(--accent); margin-left:1px; animation:og-blink 1.1s steps(1) infinite}
@keyframes og-blink{50%{opacity:0}}
.og-root .btn{height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:650; font-size:13.5px; font-family:var(--round)}
.og-root .btn.pri{background:var(--blue); color:var(--blue-ink); box-shadow:0 8px 22px -10px rgba(59,130,246,.9)}
.og-root .btn.cyan{background:var(--accent); color:#04211f}
.og-root .link{color:var(--accent); font-size:11.5px; text-align:center; margin-top:11px}
.og-root .badge{display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:600; padding:6px 10px; border-radius:999px; border:1px solid transparent}
.og-root .badge.warn{color:var(--warn); background:rgba(246,181,69,.12); border-color:rgba(246,181,69,.3)}
.og-root .badge.ok{color:var(--ok); background:rgba(53,211,154,.12); border-color:rgba(53,211,154,.3)}
.og-root .alert{font-size:11.5px; color:var(--bad); background:rgba(251,111,111,.1); border:1px solid rgba(251,111,111,.3); border-radius:11px; padding:9px 12px}
.og-root .spacer{flex:1}
.og-root .row2{display:grid; grid-template-columns:1fr 1fr; gap:10px}
.og-root .thumb{aspect-ratio:4/3; border-radius:10px; border:1px dashed var(--line-2); background:var(--panel-2); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; color:var(--faint); font-size:9.5px}
.og-root .thumb.done{border-style:solid; border-color:rgba(53,211,154,.4); color:var(--ok)}
.og-root .thumb svg{width:16px;height:16px}

/* pantalla de bienvenida (cover) */
.og-root .cover{align-items:flex-start; justify-content:center; text-align:left; background:
  radial-gradient(120% 80% at 20% 0%, rgba(36,211,212,.16), transparent 60%), var(--ink-2)}
.og-root .cover .big{width:56px;height:56px;color:var(--accent); margin-bottom:14px}
.og-root .cover h2{font-family:var(--round); font-weight:800; font-size:26px; line-height:1.1; margin:0 0 10px; text-wrap:balance}
.og-root .cover p{color:var(--muted); font-size:13px; line-height:1.5; margin:0}
.og-root .cover .pill{margin-top:18px; align-self:flex-start}

/* biometría / check-in / notificación centradas */
.og-root .center{align-items:center; justify-content:center; text-align:center; gap:2px}
.og-root .screen.vc{justify-content:center}  /* centra vertical el contenido (pantallas de auth, tipo tarjeta) */
.og-root .ring{width:96px;height:96px;border-radius:50%; display:grid; place-items:center; margin-bottom:16px; border:2px solid var(--line-2); background:radial-gradient(circle at 50% 35%, rgba(59,130,246,.22), transparent 70%)}
.og-root .ring.cy{background:radial-gradient(circle at 50% 35%, rgba(36,211,212,.22), transparent 70%)}
.og-root .ring svg{width:44px;height:44px}
.og-root .fichar{width:150px;height:150px;border-radius:50%; margin:6px auto 14px; display:grid; place-items:center; color:#fff; font-family:var(--round); font-weight:750; font-size:16px; background:radial-gradient(circle at 50% 30%, #4f97ff, #2f6bff); box-shadow:0 20px 50px -18px rgba(47,107,255,.9), inset 0 2px 0 rgba(255,255,255,.25)}
.og-root .toast{width:100%; background:var(--panel); border:1px solid var(--line-2); border-left:3px solid var(--ok); border-radius:14px; padding:13px; display:flex; gap:11px; align-items:flex-start; text-align:left}
.og-root .toast .ic{width:30px;height:30px;border-radius:9px; background:rgba(53,211,154,.14); color:var(--ok); display:grid;place-items:center; flex:none}
.og-root .toast b{font-size:13px; font-family:var(--round)}
.og-root .toast p{margin:3px 0 0; font-size:11.5px; color:var(--muted); line-height:1.4}

/* navegación inferior de la app (decorativa) */
.og-root .tabbar{position:absolute; bottom:0; left:0; right:0; height:52px; display:flex; align-items:center; justify-content:space-around; background:rgba(7,12,18,.85); border-top:1px solid var(--line); color:var(--faint); font-size:8px; z-index:4}
.og-root .tabbar .t{display:flex;flex-direction:column;align-items:center;gap:2px}
.og-root .tabbar .t svg{width:16px;height:16px}
.og-root .tabbar .t.act{color:var(--accent)}

/* ── Relato / caption ── */
.og-root .tell{max-width:420px}
.og-root .tell .step{font-family:var(--mono); font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); display:flex; align-items:center; gap:10px}
.og-root .tell .step .n{font-variant-numeric:tabular-nums}
.og-root .tell .step .of{color:var(--faint)}
.og-root .tell h3{font-family:var(--round); font-weight:750; font-size:clamp(24px,3.4vw,32px); line-height:1.1; margin:12px 0 12px; text-wrap:balance}
.og-root .tell p{color:var(--muted); font-size:15px; line-height:1.6; margin:0}
.og-root .tell p b{color:var(--fg); font-weight:650}
.og-root .tell .code{font-family:var(--mono); color:var(--accent); background:var(--accent-soft); padding:1px 7px; border-radius:6px; font-size:.92em}
.og-root .finish-cta{display:inline-flex; align-items:center; gap:8px; margin-top:20px; padding:12px 20px; border-radius:12px; background:var(--accent); color:#04211f; font-family:var(--round); font-weight:700; font-size:14px; text-decoration:none; box-shadow:0 10px 24px -12px rgba(36,211,212,.8)}
.og-root .finish-cta:hover{filter:brightness(1.06)}
.og-root .finish-cta:focus-visible{outline:2px solid var(--accent); outline-offset:3px}
@media (max-width:760px){ .og-root .tell{max-width:520px; text-align:center} .og-root .tell .step{justify-content:center} }

/* ── Controles tipo reproductor ── */
.og-root .controls{width:100%; max-width:var(--stage-max); margin-top:6px}
.og-root .track{height:5px; background:rgba(122,162,178,.16); border-radius:999px; overflow:hidden; display:flex; gap:4px}
.og-root .seg{flex:1; background:rgba(122,162,178,.10); border-radius:999px; position:relative; overflow:hidden; cursor:pointer}
.og-root .seg i{position:absolute; inset:0; width:0; background:var(--accent); border-radius:999px}
.og-root .seg.done i{width:100%}
.og-root .cbar{display:flex; align-items:center; justify-content:space-between; margin-top:14px; gap:14px}
.og-root .cluster{display:flex; align-items:center; gap:8px}
.og-root .ctl{width:40px;height:40px;border-radius:11px; border:1px solid var(--line-2); background:var(--panel); color:var(--fg); display:grid; place-items:center; cursor:pointer; transition:border-color .15s, background .15s}
.og-root .ctl:hover{border-color:var(--accent); background:var(--panel-2)}
.og-root .ctl:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
.og-root .ctl.play{width:52px;height:52px;border-radius:14px; background:var(--accent); color:#04211f; border:none}
.og-root .ctl svg{width:18px;height:18px} .og-root .ctl.play svg{width:22px;height:22px}
.og-root .now{font-size:12.5px; color:var(--muted)}
.og-root .now b{color:var(--fg); font-family:var(--round)}
.og-root .foot{width:100%; max-width:var(--stage-max); color:var(--faint); font-size:11.5px; text-align:center; margin-top:6px; line-height:1.5}

/* ── Prompts de permisos (biometría / notificaciones / ubicación) ── */
.og-root .prompt{width:100%; max-width:252px; margin:2px auto 0; background:#1b2733; border:1px solid var(--line-2); border-radius:16px; padding:16px 15px; text-align:center; box-shadow:0 24px 60px -22px rgba(0,0,0,.85)}
.og-root .prompt .pi{width:46px;height:46px;border-radius:13px; margin:0 auto 10px; display:grid;place-items:center; background:var(--accent-soft); color:var(--accent)}
.og-root .prompt .pi svg{width:24px;height:24px}
.og-root .prompt .pt{font-family:var(--round); font-weight:700; font-size:14px; margin-bottom:5px}
.og-root .prompt .pd{font-size:11.5px; color:var(--muted); line-height:1.4; margin-bottom:14px}
.og-root .prompt .pbtns{display:flex; flex-direction:column; gap:8px}
.og-root .pbtn{height:38px; border-radius:10px; display:flex;align-items:center;justify-content:center; font-weight:650; font-size:12.5px; font-family:var(--round)}
.og-root .pbtn.allow{background:var(--blue); color:var(--blue-ink); animation:og-pulse 1.9s ease-out infinite}
.og-root .pbtn.deny{background:transparent; color:var(--muted); border:1px solid var(--line-2)}
.og-root .hint{margin-top:13px; font-size:11px; color:var(--muted); line-height:1.4; max-width:252px; text-align:center}
.og-root .hint b{color:var(--fg)}
@keyframes og-pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.55)}70%{box-shadow:0 0 0 12px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}

@media (prefers-reduced-motion:reduce){ .og-root .screen{transition:none} .og-root .field .caret{animation:none} .og-root .pbtn.allow{animation:none} }
`;

/* ── Markup del recorrido, idéntico al HTML validado ──────────────────────
   Se mantiene tal cual vía dangerouslySetInnerHTML (SVG inline + clases) para
   máxima fidelidad; el JS se cablea por ref, sin document.getElementById. ── */
const MARKUP = `
<div class="wrap">
  <header class="masthead">
    <div class="brand">
      <svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><g fill="currentColor"><path d="M7 5h21l-4.4 5.2H2.6z"/><path d="M7 13.4h16.5l-4.4 5.2H2.6z"/><path d="M7 21.8h21l-4.4 5.2H2.6z"/></g></svg>
      <div><b>Emmalva</b><small>Guía de alta para empleados</small></div>
    </div>
    <span class="kicker">Instructivo · 9 pasos</span>
  </header>

  <div class="stage">
    <!-- ───────── Teléfono ───────── -->
    <div class="phone" aria-hidden="true">
      <div class="screenport">
        <div class="island"></div>
        <div class="statusbar"><span>07:25</span><span class="dots">📶 <span class="bat"></span></span></div>

        <div class="screens" id="screens">

          <!-- 0 · Portada -->
          <div class="screen cover on">
            <svg class="big" viewBox="0 0 32 32" aria-hidden="true"><g fill="currentColor"><path d="M7 5h21l-4.4 5.2H2.6z"/><path d="M7 13.4h16.5l-4.4 5.2H2.6z"/><path d="M7 21.8h21l-4.4 5.2H2.6z"/></g></svg>
            <h2>Tu alta en Emmalva, paso a paso</h2>
            <p>Todo desde tu teléfono, en unos minutos. Tocá reproducir y seguí el recorrido.</p>
            <span class="badge ok pill">▶ 9 pasos · ~1 min</span>
          </div>

          <!-- 1 · Cuenta creada -->
          <div class="screen vc">
            <div class="eyebrow">Tu cuenta</div>
            <div class="h1">Datos de acceso</div>
            <div class="card">
              <div class="lbl">Email</div>
              <div class="field ph" style="margin-bottom:16px">tu-email@empresa.com</div>
              <div class="lbl">Clave temporal</div>
              <div class="field" style="justify-content:center;font-family:var(--mono);letter-spacing:.14em;color:var(--accent);font-size:17px;background:var(--accent-soft);border-color:var(--line-2);margin-bottom:8px">Emmalva01</div>
              <p class="lead" style="margin:0">La cambiás por una tuya en el primer ingreso.</p>
            </div>
          </div>

          <!-- 2 · Iniciar sesión -->
          <div class="screen vc">
            <div class="eyebrow">Iniciar sesión</div>
            <div class="h1">Ingresá a tu cuenta</div>
            <div class="lbl">Email</div>
            <div class="field">tu-email@empresa.com</div>
            <div class="lbl">Contraseña</div>
            <div class="field">•••••••••<span class="caret"></span></div>
            <div class="btn pri">Ingresar</div>
            <div class="link">Olvidé mi contraseña</div>
          </div>

          <!-- 3 · Cambiar contraseña -->
          <div class="screen vc">
            <div class="eyebrow">Seguridad</div>
            <div class="h1">Elegí tu contraseña</div>
            <p class="lead">Cambiá la clave temporal por una tuya.</p>
            <div class="lbl">Nueva contraseña</div>
            <div class="field">••••••••••</div>
            <div class="lbl">Repetir contraseña</div>
            <div class="field">••••••••••<span class="caret"></span></div>
            <div class="btn pri">Guardar contraseña</div>
          </div>

          <!-- 4 · Permiso biometría -->
          <div class="screen center">
            <div class="eyebrow">Permiso · Biometría</div>
            <div class="h1" style="margin-bottom:12px">Registrá tu biometría</div>
            <div class="prompt">
              <div class="pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 11c0 3-.4 5.5-1.2 7.5"/><path d="M8.5 6.8A6 6 0 0 1 18 12c0 1.2 0 2.4-.2 3.5"/><path d="M6 9.5A6 6 0 0 0 6 12c0 2.5-.5 4.8-1.4 6.8"/><path d="M12 8a4 4 0 0 1 4 4c0 2.7-.3 5-1 7"/><path d="M9 18.5c.6-2 .9-4.2.9-6.5a2 2 0 0 1 4 0"/></svg></div>
              <div class="pt">Usar Face ID o tu huella</div>
              <div class="pd">El teléfono te lo pide para poder fichar tu entrada y salida.</div>
              <div class="pbtns">
                <div class="pbtn allow">Aceptar</div>
                <div class="pbtn deny">Ahora no</div>
              </div>
            </div>
            <div class="hint">Tocá <b>Aceptar</b>. Después el <b>administrador aprueba</b> tu dispositivo y te avisa.</div>
          </div>

          <!-- 5 · Permiso notificaciones -->
          <div class="screen center">
            <div class="eyebrow">Permiso · Notificaciones</div>
            <div class="h1" style="margin-bottom:12px">Activá las notificaciones</div>
            <div class="prompt">
              <div class="pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10.5 21a2 2 0 0 0 3 0"/></svg></div>
              <div class="pt">Emmalva quiere enviarte avisos</div>
              <div class="pd">Aprobaciones, documentos nuevos y recordatorios de vencimiento.</div>
              <div class="pbtns">
                <div class="pbtn allow">Permitir</div>
                <div class="pbtn deny">Bloquear</div>
              </div>
            </div>
            <div class="hint"><b>En iPhone:</b> primero agregá la app a inicio (Compartir → Agregar a inicio) y abrila desde ahí.</div>
          </div>

          <!-- 6 · Completar perfil -->
          <div class="screen">
            <div class="apphead"><div class="l"><svg class="logo" viewBox="0 0 32 32"><g fill="currentColor"><path d="M7 5h21l-4.4 5.2H2.6z"/><path d="M7 13.4h16.5l-4.4 5.2H2.6z"/><path d="M7 21.8h21l-4.4 5.2H2.6z"/></g></svg><b>Emmalva</b></div></div>
            <div class="eyebrow">Mi perfil</div>
            <div class="h1" style="margin-bottom:4px">Completá tus datos</div>
            <p class="lead">Todos los campos son obligatorios.</p>
            <div class="row2" style="margin-bottom:12px">
              <div><div class="lbl">Apellido</div><div class="field" style="margin:0">Klein</div></div>
              <div><div class="lbl">Nombre</div><div class="field" style="margin:0">Maximiliano</div></div>
            </div>
            <div class="lbl">Dirección</div>
            <div class="field bad ph">Completá este campo</div>
            <div class="row2" style="margin-bottom:12px">
              <div class="thumb done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16v12H4z"/><circle cx="9" cy="11" r="1.6"/><path d="m4 17 5-4 4 3 3-2 4 3"/></svg>Foto ✓</div>
              <div class="thumb done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 16c3-6 5-6 7-3s4 2 9-5"/></svg>Firma ✓</div>
            </div>
            <div class="alert">Faltan datos obligatorios: Dirección.</div>
            <div class="btn pri" style="margin-top:12px">Enviar</div>
          </div>

          <!-- 7 · Aprobación del admin -->
          <div class="screen center">
            <div class="ring cy"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10.5 21a2 2 0 0 0 3 0"/></svg></div>
            <div class="eyebrow">Notificación</div>
            <div class="h1" style="margin-bottom:12px">El admin te habilita</div>
            <div class="toast">
              <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg></div>
              <div><b>Dispositivo aprobado</b><p>Ya podés fichar tu entrada y salida desde el teléfono.</p></div>
            </div>
          </div>

          <!-- 8 · Permiso ubicación -->
          <div class="screen center">
            <div class="eyebrow">Permiso · Ubicación</div>
            <div class="h1" style="margin-bottom:12px">Permití la ubicación</div>
            <div class="prompt">
              <div class="pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></div>
              <div class="pt">Emmalva quiere tu ubicación</div>
              <div class="pd">Sólo al fichar, para registrar desde dónde marcás entrada y salida.</div>
              <div class="pbtns">
                <div class="pbtn allow">Permitir al usar la app</div>
                <div class="pbtn deny">No permitir</div>
              </div>
            </div>
            <div class="hint">La primera vez que fiches, tocá <b>Permitir</b>.</div>
          </div>

          <!-- 9 · Listo, a fichar -->
          <div class="screen center">
            <div class="eyebrow">Check-in</div>
            <div class="h1" style="margin-bottom:2px">¡Todo listo!</div>
            <div class="fichar">Fichar<br>entrada</div>
            <p class="lead" style="text-align:center;max-width:230px">Tocá para registrar tu jornada con ubicación y biometría. También pedís vacaciones y ves tus recibos.</p>
            <div class="tabbar">
              <div class="t act"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>Inicio</div>
              <div class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>Agenda</div>
              <div class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>Check-in</div>
              <div class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16v14H4z"/><path d="M4 9h16"/></svg>Recibidos</div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- ───────── Relato ───────── -->
    <div class="tell" id="tell" aria-live="polite">
      <!-- inyectado por JS -->
    </div>
  </div>

  <!-- ───────── Controles ───────── -->
  <div class="controls">
    <div class="track" id="track"></div>
    <div class="cbar">
      <div class="now"><b id="nowN">Portada</b></div>
      <div class="cluster">
        <button class="ctl" id="prev" aria-label="Paso anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
        <button class="ctl play" id="play" aria-label="Reproducir"><svg id="playIcon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
        <button class="ctl" id="next" aria-label="Paso siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
      </div>
    </div>
  </div>

  <p class="foot">Recorrido ilustrativo del alta de un empleado en Emmalva. Las pantallas son una recreación de la app; el flujo real es el mismo.</p>
</div>
`;

type Tell = { k: string; n: number; t: string; p: string };

const TELL: Tell[] = [
  { k: "Bienvenida", n: 0, t: "Cómo darte de alta", p: "Este recorrido muestra los <b>9 pasos</b> para empezar a usar Emmalva —incluidos los permisos que el teléfono te va a pedir. Reproducilo entero o avanzá con las flechas." },
  { k: "Paso 1 de 9", n: 1, t: "El administrador crea tu cuenta", p: "No te registrás solo: el administrador te da de alta y te pasa tu email y una clave temporal, <span class='code'>Emmalva01</span>." },
  { k: "Paso 2 de 9", n: 2, t: "Iniciá sesión", p: "Entrá con tu <b>email</b> y la clave temporal <span class='code'>Emmalva01</span>. El ingreso a la cuenta siempre es con email y contraseña." },
  { k: "Paso 3 de 9", n: 3, t: "Elegí tu contraseña", p: "En el primer ingreso, Emmalva te obliga a <b>cambiar la clave temporal</b> por una tuya. Guardala en un lugar seguro." },
  { k: "Paso 4 de 9", n: 4, t: "Permití tu biometría", p: "El teléfono te va a pedir <b>Face ID o tu huella</b>: tocá <b>Aceptar</b>. Es lo que después usás para fichar; el dispositivo queda pendiente de aprobación del admin." },
  { k: "Paso 5 de 9", n: 5, t: "Permití las notificaciones", p: "Cuando aparezca el aviso, tocá <b>Permitir</b> para recibir aprobaciones, documentos y recordatorios. <b>En iPhone</b> agregá antes la app a la pantalla de inicio." },
  { k: "Paso 6 de 9", n: 6, t: "Completá tu perfil", p: "Cargá <b>todos</b> tus datos: categoría, vencimientos con fotos, talles, domicilio, foto de frente y firma. Los campos que falten quedan <b style='color:var(--bad)'>en rojo</b>." },
  { k: "Paso 7 de 9", n: 7, t: "El administrador te habilita", p: "La primera carga se guarda directo; después, cada cambio lo aprueba el admin. Cuando <b>aprueba tu dispositivo</b>, te llega una notificación." },
  { k: "Paso 8 de 9", n: 8, t: "Permití la ubicación", p: "La primera vez que fiches, el teléfono te pide la <b>ubicación</b>: tocá <b>Permitir</b>. Sirve para registrar desde dónde marcás entrada y salida." },
  { k: "Paso 9 de 9", n: 9, t: "¡Listo! Ya podés fichar", p: "Hacé <b>check-in / check-out</b>, pedí vacaciones o francos y recibí tus recibos de sueldo firmados automáticamente." },
];

const STEP_MS = 6200;

export function OnboardingGuide() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const screens = Array.from(root.querySelectorAll<HTMLElement>("#screens .screen"));
    const N = screens.length;
    const tell = root.querySelector<HTMLElement>("#tell");
    const track = root.querySelector<HTMLElement>("#track");
    const nowN = root.querySelector<HTMLElement>("#nowN");
    const playBtn = root.querySelector<HTMLButtonElement>("#play");
    const playIcon = root.querySelector<SVGSVGElement>("#playIcon");
    const prevBtn = root.querySelector<HTMLButtonElement>("#prev");
    const nextBtn = root.querySelector<HTMLButtonElement>("#next");

    if (!tell || !track || !nowN || !playBtn || !playIcon || !prevBtn || !nextBtn || N === 0) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cur = -1;
    let playing = false;
    let raf = 0;
    let startTs = 0;
    let elapsed = 0;

    const segs: HTMLElement[] = [];

    function renderTell(i: number) {
      const d = TELL[i];
      let html =
        '<div class="step"><span class="n">' + d.k + "</span></div>" +
        "<h3>" + d.t + "</h3><p>" + d.p + "</p>";
      // En el último paso, CTA para ir a iniciar sesión (la guía es pública / pre-login).
      if (i === N - 1) html += '<a class="finish-cta" href="/login">Ir a iniciar sesión →</a>';
      tell!.innerHTML = html;
      nowN!.textContent = d.n === 0 ? "Portada" : "Paso " + d.n + " / 9";
    }

    function paintSegs(i: number, frac: number) {
      for (let j = 0; j < N; j++) {
        const fill = segs[j].firstChild as HTMLElement;
        if (j < i) {
          segs[j].classList.add("done");
          fill.style.width = "100%";
        } else if (j === i) {
          segs[j].classList.remove("done");
          // Reproduciendo: se llena de a poco (efecto video). Parado / último paso: lleno
          // (el paso actual ya fue "alcanzado"), para que la barra no quede a medias.
          fill.style.width = (playing ? frac * 100 : 100) + "%";
        } else {
          segs[j].classList.remove("done");
          fill.style.width = "0%";
        }
      }
    }

    function go(i: number, fromUser?: boolean) {
      if (i < 0) i = 0;
      if (i >= N) i = N - 1;
      if (i === cur) return;
      if (screens[cur]) screens[cur].classList.remove("on");
      cur = i;
      elapsed = 0;
      startTs = 0;
      screens[cur].classList.add("on");
      renderTell(cur);
      paintSegs(cur, 0);
      if (fromUser && playing) startTs = 0; // reinicia el cronómetro del paso
    }

    function tick(ts: number) {
      if (!playing) return;
      if (!startTs) startTs = ts;
      const e = elapsed + (ts - startTs);
      const frac = Math.min(e / STEP_MS, 1);
      paintSegs(cur, frac);
      if (frac >= 1) {
        if (cur >= N - 1) {
          setPlaying(false);
          paintSegs(cur, 1);
          return;
        }
        go(cur + 1);
        startTs = ts;
        elapsed = 0;
        raf = requestAnimationFrame(tick);
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    function setPlaying(p: boolean) {
      playing = p;
      playIcon!.innerHTML = p
        ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'
        : '<path d="M8 5v14l11-7z"/>';
      playBtn!.setAttribute("aria-label", p ? "Pausar" : "Reproducir");
      if (p) {
        if (cur >= N - 1) go(0, true);
        startTs = 0;
        elapsed = 0;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
        // congela el progreso actual acumulado
      }
    }

    // Estado idempotente (Strict Mode puede montar el effect dos veces).
    track.innerHTML = "";
    screens.forEach((s) => s.classList.remove("on"));

    const segListeners: Array<{ el: HTMLElement; type: string; fn: EventListener }> = [];
    for (let i = 0; i < N; i++) {
      const s = document.createElement("div");
      s.className = "seg";
      s.setAttribute("role", "button");
      s.setAttribute("aria-label", TELL[i].n === 0 ? "Portada" : "Paso " + TELL[i].n);
      s.tabIndex = 0;
      const fill = document.createElement("i");
      s.appendChild(fill);
      track.appendChild(s);
      segs.push(s);
      const idx = i;
      const onClick: EventListener = () => go(idx, true);
      const onKeydown: EventListener = (ev) => {
        const e = ev as KeyboardEvent;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go(idx, true);
        }
      };
      s.addEventListener("click", onClick);
      s.addEventListener("keydown", onKeydown);
      segListeners.push({ el: s, type: "click", fn: onClick });
      segListeners.push({ el: s, type: "keydown", fn: onKeydown });
    }

    const onPlay: EventListener = () => setPlaying(!playing);
    const onNext: EventListener = () => {
      setPlaying(false);
      go(cur + 1, true);
    };
    const onPrev: EventListener = () => {
      setPlaying(false);
      go(cur - 1, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setPlaying(false);
        go(cur + 1, true);
      } else if (e.key === "ArrowLeft") {
        setPlaying(false);
        go(cur - 1, true);
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying(!playing);
      }
    };

    playBtn.addEventListener("click", onPlay);
    nextBtn.addEventListener("click", onNext);
    prevBtn.addEventListener("click", onPrev);
    document.addEventListener("keydown", onKey);

    go(0);
    if (!reduce) setPlaying(true); // respeta prefers-reduced-motion: arranca en pausa

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      playBtn.removeEventListener("click", onPlay);
      nextBtn.removeEventListener("click", onNext);
      prevBtn.removeEventListener("click", onPrev);
      segListeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
      track.innerHTML = "";
    };
  }, []);

  return (
    <div
      className="og-root"
      ref={rootRef}
      dangerouslySetInnerHTML={{ __html: "<style>" + STYLES + "</style>" + MARKUP }}
    />
  );
}
