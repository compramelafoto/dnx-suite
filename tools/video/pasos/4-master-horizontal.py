"""master.html horizontal (1920x1080): intro + escenas explicativas + pantalla real + subtítulos."""
import base64, json, sys, pathlib
D = pathlib.Path(sys.argv[1])
plan = json.load(open(D/'plan.json')); tv = json.load(open(D/'tiempos-voz.json'))
guion = json.load(open(D/'guion.json'))
OFF = plan['vozOffset']
RAIZ = pathlib.Path('/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite')
ISO = base64.b64encode(open(RAIZ/'apps/compramelafoto/public/images/landescolar/compramelafoto-logo.png','rb').read()).decode()

DISPLAY = guion.get('display', {}); SIN_SUB = set(guion.get('sinSubtitulo', []))
mudo = [(x['inicio'], x['fin']) for x in tv['frases'] if x['escena'] in SIN_SUB]
def callada(t): return any(a - 0.05 <= t <= b + 0.05 for a, b in mudo)
CORTE = tuple('.,:;?!')
bloques, actual = [], []
for p in tv['palabras']:
    if callada(p['t']):
        if actual: bloques.append(actual); actual = []
        continue
    actual.append(p)
    if p['w'].endswith(CORTE) or len(actual) >= 5 or sum(len(x['w']) + 1 for x in actual) - 1 >= 34:
        bloques.append(actual); actual = []
if actual: bloques.append(actual)
subs = []
for i, b in enumerate(bloques):
    sig = OFF + bloques[i+1][0]['t'] - 0.10 if i + 1 < len(bloques) else OFF + b[-1]['f'] + 0.5
    subs.append({"ini": round(OFF + b[0]['t'] - 0.10, 3), "fin": round(min(sig, OFF + b[-1]['f'] + 0.9), 3),
                 "p": [{"w": DISPLAY.get(x['w'].strip('.,:;?!'), x['w']), "t": round(OFF + x['t'], 3)} for x in b]})

CSS = """
:root{--crema:#f7f4ef;--tinta:#1f1c19;--naranja:#c27b3d;--naranja-claro:#e8a56d;--verde:#4fa85f;
      --verde-suave:#e8f4e6;--gris:#6f6a63;--linea:#e6e0d7;--plata:#cfc7bb}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;background:var(--crema);
  font-family:'Helvetica Neue',system-ui,-apple-system,sans-serif;color:var(--tinta);-webkit-font-smoothing:antialiased}
.escena{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:70px 120px 250px;opacity:0;transition:opacity .4s ease}
.escena.on{opacity:1}
.kicker{position:relative;z-index:3;font-size:26px;letter-spacing:.24em;text-transform:uppercase;
  color:var(--naranja);font-weight:700;margin-bottom:22px}
h2{position:relative;z-index:3;font-size:66px;line-height:1.08;font-weight:800;text-align:center;letter-spacing:-.02em}
h2 em{font-style:normal;color:var(--naranja)}
h2 .verde{color:var(--verde)}
.sub{position:relative;z-index:3;font-size:32px;line-height:1.4;color:var(--gris);text-align:center;
  margin-top:22px;max-width:1100px}
.aparece{opacity:0;transform:translateY(24px);transition:opacity .45s ease,transform .45s cubic-bezier(.2,.7,.3,1)}
.on .aparece{opacity:1;transform:none}
.on .d1{transition-delay:.15s}.on .d2{transition-delay:.6s}.on .d3{transition-delay:1.2s}
.on .d4{transition-delay:2s}.on .d5{transition-delay:3s}.on .d6{transition-delay:4.2s}
.on .d7{transition-delay:5.6s}.on .d8{transition-delay:7.4s}.on .d9{transition-delay:9.4s}

#intro{padding-bottom:70px}
.iso{width:300px;height:300px;opacity:0;transform:scale(.84);filter:blur(8px);
  transition:opacity .7s ease,transform .95s cubic-bezier(.2,.85,.25,1),filter .7s ease}
.iso.on{opacity:1;transform:none;filter:none}
.destello{position:absolute;width:1100px;height:1100px;border-radius:50%;
  background:radial-gradient(circle,rgba(194,123,61,.18) 0%,rgba(194,123,61,0) 62%);
  opacity:0;transform:scale(.6);transition:opacity .8s ease,transform 1.1s ease}
.destello.on{opacity:1;transform:scale(1)}
.iso-chico{width:150px;margin-bottom:26px}
#pantalla{padding:0}
#vid{width:1920px;height:1080px;object-fit:cover;display:block}

.pastilla{display:inline-block;margin-top:28px;padding:16px 34px;border-radius:999px;background:var(--verde-suave);
  color:#2f7a3c;font-size:32px;font-weight:800}
.fila{display:flex;gap:26px;margin-top:40px;align-items:stretch;justify-content:center;flex-wrap:wrap}
.tarjeta{background:#fff;border:2px solid var(--linea);border-radius:26px;padding:30px 32px;
  box-shadow:0 16px 40px rgba(0,0,0,.06);text-align:center;min-width:250px}
.tarjeta.destacada{border-color:var(--naranja);box-shadow:0 20px 48px rgba(194,123,61,.22);transform:translateY(-8px)}
.tarjeta .ic{font-size:56px;line-height:1}
.tarjeta .tt{font-size:30px;font-weight:800;margin-top:12px;line-height:1.2}
.tarjeta .tx{font-size:22px;color:var(--gris);margin-top:10px;line-height:1.35;max-width:260px}
.bullets{margin-top:34px;display:flex;flex-direction:column;gap:16px;align-items:flex-start}
.bullet{display:flex;gap:18px;align-items:center;font-size:30px}
.tick{flex:0 0 auto;width:42px;height:42px;border-radius:50%;background:var(--verde-suave);color:var(--verde);
  display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800}

/* botones falsos */
.botones{display:flex;gap:24px;margin-top:46px;align-items:center}
.btn{border-radius:999px;padding:24px 40px;font-size:30px;font-weight:700}
.btn.primario{background:var(--naranja);color:#fff;box-shadow:0 12px 30px rgba(194,123,61,.35)}
.btn.secundario{background:#fdfcfb;color:#6b4423;border:2px solid rgba(194,123,61,.35)}
.btn.primario.late{animation:latir 1.6s ease-in-out infinite}
@keyframes latir{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}

/* formulario falso */
.form{width:900px;margin-top:36px;display:flex;flex-direction:column;gap:22px}
.campo{background:#fff;border:2px solid var(--linea);border-radius:18px;padding:20px 26px;text-align:left}
.campo .et{font-size:22px;color:var(--gris);font-weight:600}
.campo .va{font-size:32px;font-weight:700;margin-top:6px}
.campo.foco{border-color:var(--naranja);box-shadow:0 0 0 6px rgba(194,123,61,.12)}

/* simulador */
.simu{display:flex;gap:40px;margin-top:40px;align-items:center}
.simu .izq{background:#fff;border:2px solid var(--naranja);border-radius:26px;padding:34px 44px;text-align:center;
  box-shadow:0 18px 44px rgba(194,123,61,.18)}
.simu .izq .et{font-size:24px;color:var(--gris)}
.simu .izq .va{font-size:76px;font-weight:800;color:var(--naranja);line-height:1.1}
.simu .der{display:flex;flex-direction:column;gap:16px;min-width:640px}
.linea-simu{display:flex;justify-content:space-between;align-items:center;background:#fff;border:2px solid var(--linea);
  border-radius:18px;padding:20px 28px;font-size:29px}
.linea-simu b{font-weight:800}
.linea-simu.fuerte{border-color:var(--verde);background:var(--verde-suave)}
.linea-simu.fuerte b{color:#2f7a3c;font-size:34px}
.nota{margin-top:26px;font-size:24px;color:var(--gris);background:#fff;border:2px dashed var(--linea);
  border-radius:18px;padding:16px 26px}
.chips{display:flex;gap:20px;margin-top:40px;flex-wrap:wrap;justify-content:center}
.chip{background:#fff;border:2px solid var(--linea);border-radius:999px;padding:22px 34px;font-size:29px;font-weight:700}
.dominio{font-size:36px;font-weight:800;color:var(--naranja);margin-top:24px}

#marca{position:fixed;right:0;bottom:0;width:30px;height:30px;background:#000;z-index:99999}
#subs{position:absolute;left:0;right:0;bottom:62px;display:flex;justify-content:center;pointer-events:none;z-index:50}
.bloque{background:rgba(26,23,20,.94);border-radius:22px;padding:18px 32px;max-width:1480px;text-align:center;
  box-shadow:0 16px 40px rgba(0,0,0,.28);opacity:0;transform:scale(.94) translateY(12px);
  transition:opacity .16s ease,transform .18s cubic-bezier(.2,.9,.3,1)}
.bloque.on{opacity:1;transform:none}
.bloque span{font-size:48px;font-weight:800;color:#fff;letter-spacing:-.01em;line-height:1.26;
  transition:color .12s ease;white-space:pre-wrap}
.bloque span.dicha{color:var(--naranja-claro)}
"""

HTML = """<title>CLF — Crear un álbum paso a paso</title><style>__CSS__</style>
<div class="escena" id="intro">
  <div class="destello" id="destello"></div>
  <img class="iso" id="iso" src="data:image/png;base64,__ISO__" alt="">
</div>

<div class="escena" id="apertura">
  <h2 class="aparece d1">Crear un álbum<br><em>paso a paso</em></h2>
  <div class="pastilla aparece d3">6 pasos · unos minutos</div>
</div>

<div class="escena" id="requisito">
  <div class="kicker aparece d1">Antes de empezar</div>
  <h2 class="aparece d1">Mercado Pago<br><em>vinculado</em></h2>
  <div class="sub aparece d3">Sin eso la plataforma no te deja crear álbumes</div>
</div>

<div class="escena" id="entrada">
  <h2 class="aparece d1">En <em>Álbumes</em>,<br>tocá el botón naranja</h2>
  <div class="botones">
    <div class="btn primario late aparece d2">✨ Crear álbum con asistente paso a paso</div>
    <div class="btn secundario aparece d3">⚙️ Configuración avanzada</div>
  </div>
</div>

<div class="escena" id="tipo">
  <div class="kicker aparece d1">Paso 1 · Tipo</div>
  <h2 class="aparece d1">¿Qué clase<br>de álbum es?</h2>
  <div class="fila">
    <div class="tarjeta destacada aparece d2"><div class="ic">⚽</div><div class="tt">Evento / deporte</div></div>
    <div class="tarjeta aparece d3"><div class="ic">🏫</div><div class="tt">Escolar</div></div>
    <div class="tarjeta aparece d3"><div class="ic">📷</div><div class="tt">Álbum simple</div></div>
    <div class="tarjeta aparece d4"><div class="ic">🤝</div><div class="tt">Colaborativo</div></div>
  </div>
  <div class="bullets">
    <div class="bullet aparece d6"><div class="tick">✓</div><div>Vender fotos digitales después del evento</div></div>
    <div class="bullet aparece d7"><div class="tick">✓</div><div>Packs digitales de 5 o 10 fotos</div></div>
  </div>
</div>

<div class="escena" id="datos">
  <div class="kicker aparece d1">Paso 2 · Datos</div>
  <h2 class="aparece d1">Título, lugar<br>y fecha</h2>
  <div class="form">
    <div class="campo aparece d2"><div class="et">Título</div><div class="va">Copa Santa Fe · Semifinal</div></div>
    <div class="campo foco aparece d4"><div class="et">📍 Lugar · georeferenciado</div><div class="va">Club Atlético, Tostado</div></div>
    <div class="campo aparece d6"><div class="et">Fecha del evento</div><div class="va">14 / 09 / 2026</div></div>
  </div>
  <div class="nota aparece d7">De esto depende que tu álbum aparezca en “eventos cerca mío”</div>
</div>

<div class="escena" id="ventas">
  <div class="kicker aparece d1">Paso 3 · Ventas digitales</div>
  <h2 class="aparece d1">El <em>simulador</em> te muestra<br>cuánto te queda</h2>
  <div class="simu">
    <div class="izq aparece d2"><div class="et">Precio que cargás</div><div class="va" id="precio">$ 3.000</div></div>
    <div class="der">
      <div class="linea-simu aparece d4"><span>Comisión de la plataforma</span><b>$ 450</b></div>
      <div class="linea-simu aparece d5"><span>El cliente pagaría</span><b>$ 3.450</b></div>
      <div class="linea-simu fuerte aparece d7"><span>Vos recibís</span><b>$ 3.000</b></div>
    </div>
  </div>
  <div class="nota aparece d8">Números de ejemplo · la comisión se suma sobre tu precio</div>
</div>

<div class="escena" id="impresiones">
  <div class="kicker aparece d1">Paso 4 · Impresiones</div>
  <h2 class="aparece d1">¿Vendés fotos<br><em>impresas</em>?</h2>
  <div class="fila">
    <div class="tarjeta aparece d3"><div class="ic">📋</div><div class="tt">Mi lista</div><div class="tx">Tus propios precios de impresión</div></div>
    <div class="tarjeta aparece d4"><div class="ic">🖨️</div><div class="tt">Laboratorio</div><div class="tx">Los precios del lab que elijas</div></div>
  </div>
  <div class="nota aparece d6">Si todavía no lo tenés resuelto, dejalo apagado y activalo después</div>
</div>

<div class="escena" id="seguridad">
  <div class="kicker aparece d1">Paso 5 · Seguridad y privacidad</div>
  <h2 class="aparece d1">¿Quién puede<br>ver las fotos?</h2>
  <div class="fila">
    <div class="tarjeta aparece d2"><div class="ic">🌐</div><div class="tt">Público</div><div class="tx">Cualquiera con el link ve todas las fotos</div></div>
    <div class="tarjeta aparece d4"><div class="ic">🔒</div><div class="tt">Privado</div><div class="tx">Solo las personas invitadas</div></div>
    <div class="tarjeta destacada aparece d6"><div class="ic">🧑‍🦱</div><div class="tt">Privado con identificación</div><div class="tx">Cada uno ve únicamente sus propias fotos</div></div>
  </div>
  <div class="nota aparece d8">La tercera es la de los actos escolares, cuando hay menores</div>
</div>

<div class="escena" id="listo">
  <div class="kicker aparece d1">Paso 6 · Listo</div>
  <h2 class="aparece d1">Revisás<br>y <em>creás el álbum</em></h2>
</div>

<div class="escena" id="pantalla"><video id="vid" src="pantalla.webm" muted playsinline preload="auto"></video></div>

<div class="escena" id="fotos">
  <h2 class="aparece d1">Subí las fotos<br>en la pestaña <em>Fotos</em></h2>
  <div class="chips">
    <div class="chip aparece d3">💧 Marca de agua automática</div>
    <div class="chip aparece d4">🔒 Nadie descarga sin comprar</div>
  </div>
</div>

<div class="escena" id="publicacion">
  <h2 class="aparece d1">Y por último,<br><em>Publicación</em></h2>
  <div class="chips">
    <div class="chip aparece d2">👁️ Visibilidad</div>
    <div class="chip aparece d3">🛡️ Protección visual</div>
    <div class="chip aparece d4">🖼️ Portada para compartir</div>
  </div>
</div>

<div class="escena" id="cierre">
  <img class="iso-chico aparece d1" src="data:image/png;base64,__ISO__" alt="">
  <h2 class="aparece d2">Copiás el link<br>y <em>ya está vendiendo</em></h2>
  <div class="dominio aparece d3">compramelafoto.com</div>
</div>

<div id="subs"></div>
<div id="marca"></div>
<script>
const PLAN = __PLAN__, SUBS = __SUBS__, INTRO = __INTRO__;
const cajaSubs = document.getElementById('subs');
window.__marcas = [];
window.__listo = () => new Promise(r => { const v = document.getElementById('vid');
  if (v.readyState >= 3) return r(true);
  v.addEventListener('canplaythrough', () => r(true), { once: true }); setTimeout(() => r(false), 10000); });
const PASOS = ['tipo','datos','ventas','impresiones','seguridad','listo'];
window.__start = () => {
  const cero = performance.now();
  const anotar = (id) => window.__marcas.push({ id, t: (performance.now() - cero) / 1000 });
  let tono = 0;
  const marca = document.getElementById('marca');
  const mostrar = (id) => { document.querySelectorAll('.escena').forEach(x => x.classList.remove('on'));
                            document.getElementById(id).classList.add('on'); anotar(id);
                            tono = 1 - tono; marca.style.background = tono ? '#fff' : '#000'; };
  mostrar('intro');
  document.getElementById('destello').classList.add('on');
  document.getElementById('iso').classList.add('on');
  let t = INTRO;
  PLAN.forEach((e) => {
    setTimeout(() => {
      mostrar(e.id);
      if (PASOS.includes(e.id)) setTimeout(() => anotar('paso'), 120);
      if (e.id === 'pantalla') { const v = document.getElementById('vid'); v.currentTime = 0; v.play(); }
      if (e.id === 'ventas') setTimeout(() => anotar('resultado'), 5700);
      if (e.id === 'listo') setTimeout(() => anotar('creado'), 900);
      if (e.id === 'cierre') setTimeout(() => anotar('outro'), 1200);
    }, t * 1000);
    t += e.dur;
  });
  let iAct = -1, nodo = null;
  const paso = () => {
    const ahora = (performance.now() - cero) / 1000;
    const i = SUBS.findIndex(s => ahora >= s.ini && ahora < s.fin);
    if (i !== iAct) {
      iAct = i; cajaSubs.innerHTML = '';
      if (i >= 0) {
        nodo = document.createElement('div'); nodo.className = 'bloque';
        SUBS[i].p.forEach((p, k) => { const s = document.createElement('span');
          s.textContent = (k ? ' ' : '') + p.w; s.dataset.t = p.t; nodo.appendChild(s); });
        cajaSubs.appendChild(nodo);
        requestAnimationFrame(() => nodo.classList.add('on'));
      }
    }
    if (nodo && iAct >= 0) nodo.querySelectorAll('span').forEach(s =>
      s.classList.toggle('dicha', ahora >= parseFloat(s.dataset.t)));
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
  window.__fin = () => (performance.now() - cero) / 1000;
};
</script>"""

esc = [{"id": ("pantalla" if e['id'] == plan.get('pantallaEscena') else e['id']), "dur": e['dur']}
       for e in plan['escenas']]
html = (HTML.replace('__CSS__', CSS).replace('__ISO__', ISO)
            .replace('__PLAN__', json.dumps(esc)).replace('__SUBS__', json.dumps(subs))
            .replace('__INTRO__', str(plan['intro'])))
(D/'master.html').write_text(html)
print(f"master.html horizontal listo | {len(subs)} bloques de subtítulo | {len(esc)} escenas")
