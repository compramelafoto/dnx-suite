"""Arma master.html: intro + pantalla real + escenas animadas + subtítulos, todo en una sola pieza."""
import base64, json, sys, pathlib
D = pathlib.Path(sys.argv[1])
plan = json.load(open(D/'plan.json')); tv = json.load(open(D/'tiempos-voz.json'))
mp = json.load(open(D/'marcas-producto.json'))
OFF = plan['vozOffset']
# Isotipo: por defecto el de CLF; se puede cambiar con la clave "isotipo" del guion.
RAIZ = pathlib.Path(__file__).resolve().parents[3]
iso_rel = json.load(open(D/'guion.json')).get('isotipo', 'apps/compramelafoto/public/images/landescolar/compramelafoto-logo.png')
ISO = base64.b64encode(open(RAIZ/iso_rel, 'rb').read()).decode()

# --- subtítulos: bloques cortos, cortando en la puntuación ---
guion = json.load(open(D/'guion.json'))
DISPLAY = guion.get('display', {})          # cómo se escribe cada palabra en pantalla
SIN_SUB = set(guion.get('sinSubtitulo', []))  # escenas que no llevan subtítulo
mudo = [(x['inicio'], x['fin']) for x in tv['frases'] if x['escena'] in SIN_SUB]
def callada(t): return any(a - 0.05 <= t <= b + 0.05 for a, b in mudo)

CORTE = tuple('.,:;?!')
bloques, actual = [], []
for p in tv['palabras']:
    if callada(p['t']):
        if actual: bloques.append(actual); actual = []
        continue
    actual.append(p)
    if p['w'].endswith(CORTE) or len(actual) >= 4 or sum(len(x['w']) + 1 for x in actual) - 1 >= 24:
        bloques.append(actual); actual = []
if actual: bloques.append(actual)
subs = []
for i, b in enumerate(bloques):
    sig = OFF + bloques[i+1][0]['t'] - 0.10 if i + 1 < len(bloques) else OFF + b[-1]['f'] + 0.5
    subs.append({"ini": round(OFF + b[0]['t'] - 0.10, 3),
                 "fin": round(min(sig, OFF + b[-1]['f'] + 0.9), 3),
                 "p": [{"w": DISPLAY.get(x['w'].strip('.,:;?!'), x['w']) if x['w'].strip('.,:;?!') in DISPLAY else x['w'],
                        "t": round(OFF + x['t'], 3)} for x in b]})

CSS = """
:root{--crema:#f7f4ef;--tinta:#1f1c19;--naranja:#c27b3d;--naranja-claro:#e8a56d;--verde:#4fa85f;--verde-suave:#e8f4e6;
      --gris:#6f6a63;--linea:#e6e0d7;--plata:#cfc7bb}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:var(--crema);
  font-family:'Helvetica Neue',system-ui,-apple-system,sans-serif;color:var(--tinta);-webkit-font-smoothing:antialiased}
.escena{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:110px 90px 430px;opacity:0;transition:opacity .4s ease}
.escena.on{opacity:1}
.kicker{position:relative;z-index:3;font-size:29px;letter-spacing:.22em;text-transform:uppercase;color:var(--naranja);font-weight:700;margin-bottom:28px}
h2{font-size:76px;line-height:1.08;font-weight:800;text-align:center;letter-spacing:-.02em;position:relative;z-index:3}
h2 em{font-style:normal;color:var(--naranja)}
h2 .verde{color:var(--verde)}
.sub{font-size:37px;line-height:1.4;color:var(--gris);text-align:center;margin-top:26px;max-width:820px;position:relative;z-index:3}
.aparece{opacity:0;transform:translateY(26px);transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.3,1)}
.on .aparece{opacity:1;transform:none}
.on .d1{transition-delay:.15s}.on .d2{transition-delay:.55s}.on .d3{transition-delay:1.1s}
.on .d4{transition-delay:1.8s}.on .d5{transition-delay:2.6s}.on .d6{transition-delay:3.6s}
.on .d7{transition-delay:4.8s}.on .d8{transition-delay:6s}

#intro{padding-bottom:110px}
.iso{width:580px;height:580px;opacity:0;transform:scale(.82);filter:blur(8px);
  transition:opacity .7s ease,transform .95s cubic-bezier(.2,.85,.25,1),filter .7s ease}
.iso.on{opacity:1;transform:none;filter:none}
.destello{position:absolute;width:1300px;height:1300px;border-radius:50%;
  background:radial-gradient(circle,rgba(194,123,61,.20) 0%,rgba(194,123,61,0) 62%);
  opacity:0;transform:scale(.6);transition:opacity .8s ease,transform 1.1s ease}
.destello.on{opacity:1;transform:scale(1)}
.iso-cierre{width:300px;margin-bottom:40px}

#producto{padding:0}
#vid{width:1080px;height:1920px;object-fit:cover;display:block}

/* monedas */
.monedas{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0}
.moneda{position:absolute;width:96px;height:96px;border-radius:50%;background:linear-gradient(150deg,#f0c987,#d99b45);
  border:5px solid #c8862f;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:800;
  color:#8a5a1c;box-shadow:0 10px 26px rgba(0,0,0,.16);opacity:0;top:-140px}
.moneda.cae{animation:caer 1.5s cubic-bezier(.35,.05,.3,1) forwards}
@keyframes caer{0%{opacity:0;transform:translateY(0) rotate(-25deg)}
  12%{opacity:1}70%{opacity:1}100%{opacity:1;transform:translateY(var(--h)) rotate(12deg)}}

/* barra de reparto */
.barra{width:860px;height:132px;border-radius:26px;background:var(--plata);overflow:hidden;display:flex;
  margin-top:50px;box-shadow:0 16px 40px rgba(0,0,0,.08)}
.barra > div{display:flex;align-items:center;justify-content:center;font-size:37px;font-weight:700;color:#fff;
  width:0;transition:width .9s cubic-bezier(.2,.8,.25,1);white-space:nowrap;overflow:hidden}
.barra .vos{background:var(--naranja)}
.barra .plata{background:#a8a096}
.barra.parte .vos,.barra.parte .plata{width:50%}
.etiqueta{margin-top:34px;font-size:34px;color:var(--gris);text-align:center}
.pastilla{display:inline-block;margin-top:34px;padding:20px 38px;border-radius:999px;background:var(--verde-suave);
  color:#2f7a3c;font-size:38px;font-weight:800}

/* perfiles */
.perfiles{display:flex;gap:30px;margin-top:46px}
.perfil{background:#fff;border:2px solid var(--linea);border-radius:32px;padding:44px 30px;width:340px;text-align:center;
  box-shadow:0 18px 46px rgba(0,0,0,.06)}
.perfil .ic{font-size:88px;line-height:1}
.perfil .tt{font-size:38px;font-weight:800;margin-top:18px;line-height:1.2}
.nota{margin-top:40px;font-size:31px;color:var(--gris);background:#fff;border:2px dashed var(--linea);
  border-radius:22px;padding:22px 32px;text-align:center;max-width:820px}

/* tres partes */
.filas{width:880px;margin-top:44px;display:flex;flex-direction:column;gap:24px}
.fila{background:#fff;border:2px solid var(--linea);border-radius:26px;padding:28px 34px;
  box-shadow:0 12px 30px rgba(0,0,0,.05)}
.fila .top{display:flex;justify-content:space-between;align-items:baseline;font-size:35px;font-weight:700}
.fila .val{font-size:33px;color:var(--gris);font-weight:600}
.fila .pista{height:20px;border-radius:10px;background:#efe9e0;margin-top:18px;overflow:hidden}
.fila .relleno{height:100%;width:0;border-radius:10px;transition:width .9s cubic-bezier(.2,.8,.25,1)}
.fila.on .relleno{width:var(--w)}

/* cobro */
.tarjetaMP{width:840px;background:#fff;border:2px solid var(--linea);border-radius:36px;padding:46px 50px;margin-top:46px;
  box-shadow:0 24px 60px rgba(0,0,0,.08)}
.mpLogo{display:flex;align-items:center;gap:20px;padding-bottom:28px;border-bottom:2px solid var(--linea)}
.mpLogo .marca{font-size:40px;font-weight:800;color:#0b7fc4;letter-spacing:-.01em}
.mpLogo .cuenta{margin-left:auto;font-size:29px;color:var(--gris)}
.saldoRot{font-size:31px;color:var(--gris);margin-top:30px}
.saldo{font-size:104px;font-weight:800;letter-spacing:-.03em;color:var(--verde);line-height:1.05}
.movs{margin-top:26px;display:flex;flex-direction:column;gap:12px}
.mov{display:flex;justify-content:space-between;font-size:30px;color:var(--gris);opacity:0;transform:translateX(-14px);
  transition:opacity .3s ease,transform .3s ease}
.mov.on{opacity:1;transform:none}
.mov b{color:var(--verde);font-weight:700}

/* aviso */
.alerta{width:860px;background:#fff8ec;border:3px solid #e6b45e;border-radius:34px;padding:48px 52px;margin-top:44px;
  text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.07)}
.alerta .ic{font-size:80px}
.alerta .tt{font-size:44px;font-weight:800;margin-top:16px}
.alerta .tx{font-size:34px;color:var(--gris);margin-top:18px;line-height:1.4}
.dominio{font-size:44px;font-weight:800;color:var(--naranja);margin-top:30px}
.legal{font-size:25px;color:var(--gris);text-align:center;margin-top:34px;line-height:1.5;max-width:740px}

/* subtítulos */
#subs{position:absolute;left:0;right:0;bottom:180px;display:flex;justify-content:center;pointer-events:none;z-index:50}
.bloque{background:rgba(26,23,20,.94);border-radius:28px;padding:24px 40px;max-width:900px;text-align:center;
  box-shadow:0 18px 46px rgba(0,0,0,.28);opacity:0;transform:scale(.93) translateY(14px);
  transition:opacity .16s ease,transform .18s cubic-bezier(.2,.9,.3,1)}
.bloque.on{opacity:1;transform:none}
.bloque span{font-size:62px;font-weight:800;color:#fff;letter-spacing:-.01em;line-height:1.24;
  transition:color .12s ease;white-space:pre-wrap}
.bloque span.dicha{color:var(--naranja-claro)}
"""

HTML = """<title>CLF — Programa de referidos</title><style>__CSS__</style>
<div class="escena" id="intro">
  <div class="destello" id="destello"></div>
  <img class="iso" id="iso" src="data:image/png;base64,__ISO__" alt="">
</div>

<div class="escena" id="hook">
  <div class="monedas" id="monedas"></div>
  <h2 class="aparece d1">Cobrás por las ventas<br>de <em>tus colegas</em></h2>
  <div class="sub aparece d3">Y a ellos no les cuesta nada</div>
</div>

<div class="escena" id="reparto">
  <div class="kicker aparece d1">Cómo funciona</div>
  <h2 class="aparece d1">La comisión<br>se parte <em>al medio</em></h2>
  <div class="barra" id="barra"><div class="vos">Para vos 50%</div><div class="plata">Plataforma 50%</div></div>
  <div class="etiqueta aparece d5">De cada venta que hace tu recomendado</div>
  <div class="pastilla aparece d6">Durante 12 meses</div>
</div>

<div class="escena" id="producto"><video id="vid" src="producto.webm" muted playsinline preload="auto"></video></div>

<div class="escena" id="perfiles">
  <h2 class="aparece d1">¿A quién<br>podés <em>recomendar</em>?</h2>
  <div class="perfiles">
    <div class="perfil aparece d2"><div class="ic">📷</div><div class="tt">Fotógrafos</div></div>
    <div class="perfil aparece d3"><div class="ic">🎪</div><div class="tt">Organizadores<br>de eventos</div></div>
  </div>
  <div class="pastilla aparece d5">Quedan asociados a vos por 12 meses</div>
  <div class="nota aparece d7">Hoy la comisión corre para fotógrafos referidos</div>
</div>

<div class="escena" id="tresPartes">
  <h2 class="aparece d1">Tu colega cobra<br><span class="verde">lo mismo de siempre</span></h2>
  <div class="filas">
    <div class="fila aparece d2" id="f1"><div class="top"><span>Tu colega</span><span class="val">Su venta, intacta</span></div>
      <div class="pista"><div class="relleno" style="--w:100%;background:var(--verde)"></div></div></div>
    <div class="fila aparece d4" id="f2"><div class="top"><span>Vos</span><span class="val">Mitad de la comisión</span></div>
      <div class="pista"><div class="relleno" style="--w:50%;background:var(--naranja)"></div></div></div>
    <div class="fila aparece d6" id="f3"><div class="top"><span>ComprameLaFoto</span><span class="val">La otra mitad</span></div>
      <div class="pista"><div class="relleno" style="--w:50%;background:#a8a096"></div></div></div>
  </div>
</div>

<div class="escena" id="cobro">
  <h2 class="aparece d1">Se acredita solo<br>en tu <em>cuenta</em></h2>
  <div class="tarjetaMP aparece d2">
    <div class="mpLogo"><span class="marca">Mercado Pago</span><span class="cuenta">Tu cuenta</span></div>
    <div class="saldoRot">Comisiones acreditadas</div>
    <div class="saldo" id="saldo">$ 0</div>
    <div class="movs">
      <div class="mov" id="mov1"><span>Venta de un referido</span><b>+ $ 2.400</b></div>
      <div class="mov" id="mov2"><span>Venta de un referido</span><b>+ $ 5.150</b></div>
      <div class="mov" id="mov3"><span>Venta de un referido</span><b>+ $ 3.900</b></div>
    </div>
  </div>
</div>

<div class="escena" id="aviso">
  <div class="alerta">
    <div class="ic aparece d1">⚠️</div>
    <div class="tt aparece d1">Conectá tu Mercado Pago</div>
    <div class="tx aparece d3">Si tu referido vende y vos no lo tenés conectado,<br>esa comisión se pierde: no se acumula.</div>
  </div>
</div>

<div class="escena" id="cierre">
  <img class="iso-cierre aparece d1" src="data:image/png;base64,__ISO__" alt="">
  <h2 class="aparece d2">Pedí tu link<br><em>y empezá</em></h2>
  <div class="dominio aparece d3">compramelafoto.com/recomendanos</div>
  <div class="legal aparece d4">Programa vigente para fotógrafos referidos. Requiere Mercado Pago conectado.</div>
</div>

<div id="subs"></div>
<script>
const PLAN = __PLAN__, SUBS = __SUBS__, INTRO = __INTRO__, PROD = __PROD__;
const cajaSubs = document.getElementById('subs');
window.__marcas = [];
window.__listo = () => new Promise(r => { const v = document.getElementById('vid');
  if (v.readyState >= 3) return r(true);
  v.addEventListener('canplaythrough', () => r(true), { once: true }); setTimeout(() => r(false), 8000); });

const monedas = document.getElementById('monedas');
[[120, 830], [330, 980], [560, 880], [800, 1020], [930, 780]].forEach(([x, h], i) => {
  const d = document.createElement('div'); d.className = 'moneda'; d.textContent = '$';
  d.style.left = x + 'px'; d.style.setProperty('--h', (h + 380) + 'px'); monedas.appendChild(d);
});

window.__start = () => {
  const cero = performance.now();
  const anotar = (id) => window.__marcas.push({ id, t: (performance.now() - cero) / 1000 });
  const mostrar = (id) => { document.querySelectorAll('.escena').forEach(x => x.classList.remove('on'));
                            document.getElementById(id).classList.add('on'); anotar(id); };
  mostrar('intro');
  document.getElementById('destello').classList.add('on');
  document.getElementById('iso').classList.add('on');

  let t = INTRO;
  PLAN.forEach((e) => {
    setTimeout(() => {
      mostrar(e.id);
      if (e.id === 'producto') { const v = document.getElementById('vid'); v.currentTime = 0; v.play(); }
      if (e.id === 'hook') {
        [...document.querySelectorAll('.moneda')].forEach((m, k) =>
          setTimeout(() => { m.classList.add('cae'); anotar('moneda'); }, 500 + k * 420));
      }
      if (e.id === 'reparto') setTimeout(() => { document.getElementById('barra').classList.add('parte'); anotar('split'); }, 1600);
      if (e.id === 'perfiles') { setTimeout(() => anotar('toc'), 700); setTimeout(() => anotar('toc'), 1250); }
      if (e.id === 'tresPartes') ['f1','f2','f3'].forEach((id, k) =>
        setTimeout(() => { document.getElementById(id).classList.add('on'); anotar('toc'); }, 900 + k * 1300));
      if (e.id === 'cobro') {
        setTimeout(() => anotar('contador'), 1300);
        const fmt = (n) => '$ ' + Math.round(n).toLocaleString('es-AR');
        const el = document.getElementById('saldo'), fin = 11450, ini = performance.now() + 1300;
        const subir = () => { const p = Math.min(1, Math.max(0, (performance.now() - ini) / 2600));
          el.textContent = fmt(fin * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(subir); };
        setTimeout(subir, 1300);
        ['mov1','mov2','mov3'].forEach((id, k) => setTimeout(() => document.getElementById(id).classList.add('on'), 1600 + k * 700));
        setTimeout(() => anotar('acredita'), 3900);
      }
      if (e.id === 'aviso') setTimeout(() => anotar('aviso'), 400);
      if (e.id === 'cierre') setTimeout(() => anotar('outro'), 1400);
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

html = (HTML.replace('__CSS__', CSS).replace('__ISO__', ISO)
            .replace('__PLAN__', json.dumps(plan['escenas'])).replace('__SUBS__', json.dumps(subs))
            .replace('__INTRO__', str(plan['intro'])).replace('__PROD__', str(plan['producto'])))
(D/'master.html').write_text(html)
print(f"master.html listo | {len(subs)} bloques de subtítulo | clip del producto: copiar {mp['copiar']}s, whatsapp {mp['whatsapp']}s")
