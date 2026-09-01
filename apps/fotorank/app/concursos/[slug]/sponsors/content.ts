/**
 * Propuesta de patrocinio de Santa Fe en Foco.
 *
 * Página estática, sin datos dinámicos y sin entrada de usuario: el contenido es
 * una cadena literal de este mismo archivo. Por eso se inyecta como HTML en vez
 * de reescribirse en JSX — no hay nada que escapar y el marcado queda legible.
 */

export const SFEF_SPONSORS_STYLES = `.sfef-sponsors{
  --ground:#f1f3f2; --surface:#ffffff; --surface-2:#e4e8e6;
  --ink:#13181a; --ink-2:#4b5559; --ink-3:#78848a;
  --rule:#d5dbd8; --rule-2:#b3bcb8;
  --accent:#0f6b68; --accent-soft:#dcecea;
  --gold:#8a6412; --gold-soft:#f2ead6;
  --slot-line:#0f6b68; --slot-fill:rgba(15,107,104,.07);
  --night:#101413;
}
.sfef-sponsors *{box-sizing:border-box}
.sfef-sponsors{margin:0;background:var(--ground);color:var(--ink);
  font-family:"Karla",system-ui,-apple-system,sans-serif;font-size:17px;line-height:1.6;
  -webkit-font-smoothing:antialiased}
.sfef-sponsors .wrap{max-width:1000px;margin:0 auto;padding:0 24px}
.sfef-sponsors h1, .sfef-sponsors h2, .sfef-sponsors h3{font-family:"Fraunces",Georgia,serif;margin:0;text-wrap:balance}
.sfef-sponsors h1{font-size:clamp(40px,7vw,74px);font-weight:700;line-height:.98;letter-spacing:-.02em}
.sfef-sponsors h2{font-size:clamp(26px,3.6vw,38px);font-weight:600;line-height:1.1}
.sfef-sponsors h3{font-size:20px;font-weight:600;line-height:1.2}
.sfef-sponsors p{margin:0}
.sfef-sponsors .mono{font-family:"DM Mono",ui-monospace,monospace}
.sfef-sponsors .eyebrow{font-family:"DM Mono",monospace;font-size:11.5px;font-weight:500;letter-spacing:.18em;
  text-transform:uppercase;color:var(--accent)}
.sfef-sponsors 
.hero{position:relative;background:var(--night);overflow:hidden}
.sfef-sponsors .hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5}
.sfef-sponsors .hero-shade{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(8,11,11,.55) 0%,rgba(8,11,11,.35) 40%,rgba(8,11,11,.94) 100%)}
.sfef-sponsors .hero-in{position:relative;max-width:1000px;margin:0 auto;padding:88px 24px 56px;color:#f4f7f6}
.sfef-sponsors .hero-in .eyebrow{color:#9fded8}
.sfef-sponsors .hero h1{margin:18px 0 0;color:#fff}
.sfef-sponsors .hero-sub{margin-top:20px;max-width:56ch;font-size:19px;color:#cfd9d7}
.sfef-sponsors .hero-facts{display:flex;flex-wrap:wrap;gap:10px 32px;margin-top:30px;
  font-family:"DM Mono",monospace;font-size:12px;letter-spacing:.05em;
  text-transform:uppercase;color:#9fada9}
.sfef-sponsors .hero-facts b{display:block;font-family:"Karla",sans-serif;font-size:17px;
  letter-spacing:0;text-transform:none;color:#f4f7f6;font-weight:600;margin-top:3px}
.sfef-sponsors section{padding:64px 0}
.sfef-sponsors .sec-title{display:flex;flex-direction:column;gap:10px;margin-bottom:30px}
.sfef-sponsors .stack{display:flex;flex-direction:column;gap:18px}
.sfef-sponsors .lede{font-size:19.5px;color:var(--ink-2);max-width:62ch}
.sfef-sponsors 
.mockups{display:flex;flex-direction:column;gap:34px}
.sfef-sponsors .mock{background:var(--surface);border:1px solid var(--rule);border-radius:6px;overflow:hidden}
.sfef-sponsors .mock-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px;
  padding:16px 20px;border-bottom:1px solid var(--rule)}
.sfef-sponsors .mock-head h3{flex:1 1 auto}
.sfef-sponsors .mock-kind{font-family:"DM Mono",monospace;font-size:10.5px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-3);white-space:nowrap}
.sfef-sponsors .mock-note{padding:0 20px 18px;font-size:15px;color:var(--ink-2)}
.sfef-sponsors .mock-stage{padding:20px;background:var(--surface-2)}
.sfef-sponsors 
.browser{background:var(--night);border-radius:5px;overflow:hidden;
  box-shadow:0 10px 30px rgba(0,0,0,.16)}
.sfef-sponsors .browser-bar{display:flex;align-items:center;gap:6px;padding:9px 12px;background:#1c2322}
.sfef-sponsors .dot{width:9px;height:9px;border-radius:50%;background:#3d4746}
.sfef-sponsors .browser-url{margin-left:8px;font-family:"DM Mono",monospace;font-size:10.5px;color:#7d8b88;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sfef-sponsors .page{position:relative;min-height:220px;background:var(--night);color:#e7edeb;overflow:hidden}
.sfef-sponsors .page-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.34}
.sfef-sponsors .page-body{position:relative;padding:22px 20px 24px}
.sfef-sponsors .page-eyebrow{font-family:"DM Mono",monospace;font-size:9.5px;letter-spacing:.16em;
  text-transform:uppercase;color:#8fc9c4}
.sfef-sponsors .page-title{font-family:"Fraunces",serif;font-size:27px;font-weight:700;margin-top:6px;color:#fff}
.sfef-sponsors .page-line{height:7px;border-radius:4px;background:rgba(231,237,235,.18);margin-top:11px}
.sfef-sponsors .page-line.short{width:52%}
.sfef-sponsors 
.slot{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
  border:2px dashed var(--slot-line);border-radius:5px;
  background:
    repeating-linear-gradient(135deg,var(--slot-fill) 0 9px,transparent 9px 18px),
    var(--surface);
  color:var(--accent);text-align:center;padding:14px 16px;
}
.sfef-sponsors .slot .label{font-family:"DM Mono",monospace;font-size:11.5px;font-weight:500;
  letter-spacing:.13em;text-transform:uppercase;line-height:1.35}
.sfef-sponsors .slot .size{font-family:"DM Mono",monospace;font-size:10px;color:var(--ink-3);letter-spacing:.06em}
.sfef-sponsors .slot.on-dark{background:
    repeating-linear-gradient(135deg,rgba(159,222,216,.13) 0 9px,transparent 9px 18px),
    rgba(8,11,11,.72);
  border-color:#7fd0c9;color:#a8e2dc}
.sfef-sponsors .slot.on-dark .size{color:#7e908d}
.sfef-sponsors .slot-modal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(6,9,9,.66);padding:22px}
.sfef-sponsors .slot-modal .slot{width:min(300px,80%);min-height:132px;background:
    repeating-linear-gradient(135deg,rgba(15,107,104,.09) 0 9px,transparent 9px 18px),#fbfdfc;
  border-color:#0f6b68;color:#0f6b68}
.sfef-sponsors .slot-modal .slot .size{color:#6d7b78}
.sfef-sponsors .strip{display:flex;gap:8px;align-items:center;padding:14px;background:rgba(8,11,11,.6);
  border-top:1px solid rgba(231,237,235,.12);position:relative}
.sfef-sponsors .strip .ghost{flex:1 1 0;height:34px;border-radius:4px;background:rgba(231,237,235,.13)}
.sfef-sponsors .strip .slot{flex:1.4 1 0;min-height:34px;padding:7px 8px}
.sfef-sponsors .strip .slot .label{font-size:9.5px;letter-spacing:.08em}
.sfef-sponsors .banner-slot{min-height:74px}
.sfef-sponsors .stagebox{width:100%;max-width:430px;display:flex;flex-direction:column;gap:10px}
.sfef-sponsors .stagebox .slot{min-height:96px}
.sfef-sponsors .stagebox .podium{height:34px;border-radius:4px 4px 0 0;background:#2b3433;
  display:flex;align-items:center;justify-content:center;
  font-family:"DM Mono",monospace;font-size:10px;color:#7e908d;letter-spacing:.14em;text-transform:uppercase}
.sfef-sponsors .badge-card{width:186px;background:#f7faf9;border-radius:9px;padding:14px;
  display:flex;flex-direction:column;gap:9px;box-shadow:0 8px 22px rgba(0,0,0,.24)}
.sfef-sponsors .badge-card .who{height:9px;border-radius:3px;background:#d2dbd8}
.sfef-sponsors .badge-card .who.short{width:58%}
.sfef-sponsors .badge-card .slot{min-height:38px;background:
    repeating-linear-gradient(135deg,rgba(15,107,104,.09) 0 9px,transparent 9px 18px),#fff;
  border-color:#0f6b68;color:#0f6b68;padding:8px}
.sfef-sponsors .badge-card .slot .label{font-size:9.5px;letter-spacing:.09em}
.sfef-sponsors 
.post{width:260px;background:#f7faf9;border-radius:8px;overflow:hidden;
  box-shadow:0 8px 22px rgba(0,0,0,.24)}
.sfef-sponsors .post-top{display:flex;align-items:center;gap:8px;padding:10px}
.sfef-sponsors .post-av{width:26px;height:26px;border-radius:50%;background:#0f6b68}
.sfef-sponsors .post-name{font-size:12px;font-weight:600;color:#13181a}
.sfef-sponsors .post-img{height:150px;position:relative}
.sfef-sponsors .post-img .slot{position:absolute;inset:10px;background:
    repeating-linear-gradient(135deg,rgba(15,107,104,.1) 0 9px,transparent 9px 18px),#eef3f1;
  border-color:#0f6b68;color:#0f6b68}
.sfef-sponsors .post-foot{padding:9px 10px 12px;font-size:11.5px;color:#4b5559}
.sfef-sponsors
.cmp-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;
  border:1px solid var(--rule);border-radius:6px;background:var(--surface)}
.sfef-sponsors .cmp{width:100%;min-width:800px;border-collapse:separate;border-spacing:0;
  font-size:14.5px;text-align:left}
.sfef-sponsors .cmp th, .sfef-sponsors .cmp td{padding:13px 16px;vertical-align:top;
  border-bottom:1px solid var(--rule);color:var(--ink-2);line-height:1.4}
.sfef-sponsors .cmp thead th{vertical-align:bottom;padding-top:20px;padding-bottom:15px;
  background:var(--surface);border-bottom:1px solid var(--rule-2)}
.sfef-sponsors .cmp .rowh{position:sticky;left:0;z-index:2;background:var(--surface);
  border-right:1px solid var(--rule);width:240px;min-width:240px;
  font-weight:600;color:var(--ink)}
.sfef-sponsors .cmp thead .rowh{z-index:3}
.sfef-sponsors .cmp .cat-name{display:block;font-family:"Fraunces",serif;font-size:19px;
  font-weight:700;line-height:1.15;color:var(--ink)}
.sfef-sponsors .cmp .cat-cupo{display:block;margin-top:5px;font-family:"DM Mono",monospace;
  font-size:10px;font-weight:400;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-3)}
.sfef-sponsors .cmp .lead-col{background:var(--gold-soft)}
.sfef-sponsors .cmp thead .lead-col{box-shadow:inset 0 3px 0 var(--gold)}
.sfef-sponsors .cmp thead .lead-col .cat-cupo{color:var(--gold)}
.sfef-sponsors .cmp .cmp-price td{font-family:"Fraunces",serif;font-size:25px;font-weight:700;
  color:var(--ink);padding-top:18px;padding-bottom:18px;white-space:nowrap}
.sfef-sponsors .cmp .cmp-price .lead-col{color:var(--gold)}
.sfef-sponsors .cmp .cmp-price small{display:block;margin-top:6px;white-space:normal;
  font-family:"DM Mono",monospace;font-size:10px;font-weight:400;letter-spacing:.09em;
  text-transform:uppercase;color:var(--ink-3)}
.sfef-sponsors .cmp .yes{color:var(--accent);font-weight:700}
.sfef-sponsors .cmp .no{color:var(--rule-2)}
.sfef-sponsors .cmp tbody tr:last-child th, .sfef-sponsors .cmp tbody tr:last-child td{border-bottom:0}
.sfef-sponsors .cmp-hint{display:none;font-family:"DM Mono",monospace;font-size:11px;
  letter-spacing:.05em;color:var(--ink-3)}
@media (max-width:880px){
  .sfef-sponsors .cmp-hint{display:block}
  .sfef-sponsors .cmp{min-width:660px}
  .sfef-sponsors .cmp th, .sfef-sponsors .cmp td{padding:11px 12px;font-size:13.5px}
  .sfef-sponsors .cmp .rowh{width:152px;min-width:152px;font-size:13px}
  .sfef-sponsors .cmp .cat-name{font-size:16px}
  .sfef-sponsors .cmp .cmp-price td{font-size:20px;padding-top:14px;padding-bottom:14px}
}
.sfef-sponsors 
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;
  background:var(--rule);border:1px solid var(--rule);border-radius:6px;overflow:hidden}
.sfef-sponsors .fact{background:var(--surface);padding:18px 20px;display:flex;flex-direction:column;gap:4px}
.sfef-sponsors .fact .k{font-family:"DM Mono",monospace;font-size:10.5px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink-3)}
.sfef-sponsors .fact .v{font-size:17px;font-weight:600}
.sfef-sponsors .fact .v.big{font-family:"Fraunces",serif;font-size:27px;font-weight:700;color:var(--gold)}
.sfef-sponsors .cats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.sfef-sponsors .cat{background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:18px 20px}
.sfef-sponsors .cat h3{font-size:17px;margin-bottom:5px}
.sfef-sponsors .cat p{font-size:14.5px;color:var(--ink-2)}
.sfef-sponsors .cta{background:var(--night);color:#f4f7f6;border-radius:8px;padding:40px 34px;
  display:flex;flex-direction:column;gap:16px;align-items:flex-start}
.sfef-sponsors .cta h2{color:#fff}
.sfef-sponsors .cta p{color:#c3cfcc;max-width:56ch}
.sfef-sponsors .cta a{display:inline-block;background:#f4f7f6;color:#101413;text-decoration:none;
  font-weight:700;padding:13px 26px;border-radius:5px;font-size:16px}
.sfef-sponsors .cta a:focus-visible{outline:3px solid #5fc4bd;outline-offset:3px}
.sfef-sponsors .note{border-left:3px solid var(--accent);background:var(--accent-soft);
  padding:16px 20px;border-radius:0 5px 5px 0;font-size:15.5px}
.sfef-sponsors .foot{padding:30px 0 90px;border-top:1px solid var(--rule);margin-top:56px;
  font-family:"DM Mono",monospace;font-size:11.5px;color:var(--ink-3);letter-spacing:.04em}
@media (max-width:640px){.sfef-sponsors .hero-in{padding:60px 20px 40px}
}
.sfef-sponsors .orgs{display:flex;flex-wrap:wrap;gap:14px}
.sfef-sponsors .org-card{flex:1 1 240px;background:var(--surface);border:1px solid var(--rule);
  border-radius:6px;padding:20px;display:flex;flex-direction:column;gap:13px;align-items:flex-start}
.sfef-sponsors .org-plate{background:#fff;border-radius:5px;padding:12px 14px;display:flex;align-items:center;
  justify-content:center;width:100%;min-height:92px;border:1px solid rgba(0,0,0,.06)}
.sfef-sponsors .org-plate img{max-width:100%;max-height:72px;width:auto;height:auto;display:block}
.sfef-sponsors .org-card .k{font-family:"DM Mono",monospace;font-size:10px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--ink-3)}
.sfef-sponsors .org-card .n{font-size:15px;font-weight:600;line-height:1.3}
.sfef-sponsors 
.orgs{display:flex;flex-wrap:wrap;align-items:center;gap:18px 30px;
  background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:22px 24px}
.sfef-sponsors .org{display:flex;align-items:center;gap:14px}
.sfef-sponsors .org img{height:56px;width:auto;border-radius:4px}
.sfef-sponsors .org .txt{display:flex;flex-direction:column;gap:2px}
.sfef-sponsors .org .k{font-family:"DM Mono",monospace;font-size:10px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--ink-3)}
.sfef-sponsors .org .n{font-size:15.5px;font-weight:600;line-height:1.25;max-width:26ch}
.sfef-sponsors .org .crest{height:56px;width:56px;border-radius:4px;border:1.5px solid var(--rule-2);
  display:flex;align-items:center;justify-content:center;
  font-family:"Fraunces",serif;font-size:20px;font-weight:700;color:var(--ink-2);flex:0 0 auto}
.sfef-sponsors 
.reach{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
.sfef-sponsors .reach-card{background:var(--surface);border:1px solid var(--rule);border-radius:6px;
  overflow:hidden;display:flex;flex-direction:column}
.sfef-sponsors .reach-card .body{padding:18px 20px;display:flex;flex-direction:column;gap:7px}
.sfef-sponsors .reach-card h3{font-size:18px}
.sfef-sponsors .reach-card p{font-size:14.5px;color:var(--ink-2)}
.sfef-sponsors .reach-num{display:flex;flex-wrap:wrap;gap:6px 22px;margin-top:4px}
.sfef-sponsors .reach-num span{font-family:"DM Mono",monospace;font-size:10.5px;letter-spacing:.09em;
  text-transform:uppercase;color:var(--ink-3)}
.sfef-sponsors .reach-num b{display:block;font-family:"Fraunces",serif;font-size:22px;font-weight:700;
  color:var(--accent);letter-spacing:0;text-transform:none;margin-top:2px}
.sfef-sponsors 
.podio{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.sfef-sponsors .podio-item{background:var(--surface);border:1px solid var(--rule);border-radius:6px;
  padding:20px;display:flex;flex-direction:column;gap:5px}
.sfef-sponsors .podio-item.first{border-color:var(--gold);background:var(--gold-soft)}
.sfef-sponsors .podio-pos{font-family:"DM Mono",monospace;font-size:10.5px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-3)}
.sfef-sponsors .podio-item.first .podio-pos{color:var(--gold)}
.sfef-sponsors .podio-monto{font-family:"Fraunces",serif;font-size:31px;font-weight:700;line-height:1}
.sfef-sponsors .podio-item.first .podio-monto{color:var(--gold)}
.sfef-sponsors .podio-det{font-size:14px;color:var(--ink-2)}
.sfef-sponsors 
.merch{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.sfef-sponsors .merch-item{background:var(--surface);border:1px solid var(--rule);border-radius:6px;
  padding:18px 20px;display:flex;flex-direction:column;gap:6px}
.sfef-sponsors .merch-item .k{font-family:"DM Mono",monospace;font-size:10px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--accent)}
.sfef-sponsors .merch-item .n{font-size:16px;font-weight:600}
.sfef-sponsors .merch-item p{font-size:14px;color:var(--ink-2)}`;

export const SFEF_SPONSORS_HTML = `<header class="hero">
  <img class="hero-img" src="/contest-assets/santa-fe-en-foco/hero/hero-desktop.jpg" alt="Fotografía de la portada oficial de Santa Fe en Foco">
  <div class="hero-shade"></div>
  <div class="hero-in">
    <div class="eyebrow">Propuesta de patrocinio · Edición 2026</div>
    <h1>Santa Fe en Foco</h1>
    <p class="hero-sub">En el marco de los Juegos Suramericanos, con miles de visitantes de todo el país y del continente en la provincia.</p>
    <div class="hero-facts">
      <span>En premios<b>$4.800.000</b></span>
      <span>Categorías<b>Cuatro</b></span>
      <span>Cierre de inscripción<b>30 de septiembre</b></span>
      <span>Resultados<b>14 de octubre</b></span>
    </div>
  </div>
</header>

<div class="wrap">

<section>
  <div class="orgs">
    <div class="org-card">
      <div class="org-plate"><img src="/contest-assets/santa-fe-en-foco/identity/logos-secondary/sfpr.png" alt="Sociedad de Fotógrafos Profesionales de Rosario"></div>
      <div><div class="k">Organiza</div><div class="n">Sociedad de Fotógrafos Profesionales de Rosario</div></div>
    </div>
    <div class="org-card">
      <div class="org-plate"><img src="/contest-assets/santa-fe-en-foco/identity/logos-secondary/senado-santa-fe.png" alt="Senado de Santa Fe"></div>
      <div><div class="k">Entidad organizadora</div><div class="n">Cámara de Senadores de la Provincia de Santa Fe</div></div>
    </div>
    <div class="org-card">
      <div class="org-plate"><img src="/contest-assets/santa-fe-en-foco/identity/logos-secondary/juegos-suramericanos.png" alt="Juegos Suramericanos"></div>
      <div><div class="k">En el marco de</div><div class="n">Juegos Suramericanos</div></div>
    </div>
  </div>
</section>

<section style="padding-top:34px">
  <div class="sec-title"><span class="eyebrow">La invitación</span><h2>Su marca, donde mira toda la provincia</h2></div>
  <div class="stack">
    <p class="lede">Santa Fe en Foco convoca a fotógrafos de todo el país a retratar el territorio santafesino, <strong>en el entorno de los Juegos Suramericanos</strong>: miles de personas llegando a la provincia desde toda la Argentina y desde el continente, y una agenda de eventos que se cubre día a día.</p>
    <p>Acompañar el concurso no es poner un logo en un afiche. Es estar en la pantalla donde el fotógrafo se inscribe, en el recorrido del evento, y en los portales que van a publicar todo lo que pase durante los Juegos.</p>
    <p>En las páginas que siguen está cada uno de esos lugares, dibujado tal cual se vería. Donde dice <strong>«tu logo aquí»</strong> va la marca de su empresa.</p>
  </div>
</section>

<section>
  <div class="sec-title"><span class="eyebrow">Dónde se ve</span><h2>Los espacios, uno por uno</h2></div>
  <div class="mockups">

    <article class="mock">
      <div class="mock-head"><h3>Placa de bienvenida</h3><span class="mock-kind">Digital · Página del concurso</span></div>
      <div class="mock-stage">
        <div class="browser">
          <div class="browser-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
            <span class="browser-url">fotorank.dnxsuite.com/concursos/santa-fe-en-foco</span></div>
          <div class="page">
            <img class="page-img" src="/contest-assets/santa-fe-en-foco/hero/hero-desktop.jpg" alt="">
            <div class="page-body">
              <div class="page-eyebrow">Inscripciones abiertas</div>
              <div class="page-title">Santa Fe en Foco</div>
              <div class="page-line"></div><div class="page-line short"></div>
            </div>
            <div class="slot-modal">
              <div class="slot"><span class="label">Tu logo aquí</span><span class="size">Placa de bienvenida · una sola marca</span></div>
            </div>
          </div>
        </div>
      </div>
      <p class="mock-note">Aparece al entrar a la página del concurso, una vez por visitante cada 24 horas. Es el espacio de mayor impacto y admite <strong>una sola marca</strong>.</p>
    </article>

    <article class="mock">
      <div class="mock-head"><h3>Franja de logos</h3><span class="mock-kind">Digital · Página del concurso</span></div>
      <div class="mock-stage">
        <div class="browser">
          <div class="browser-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
            <span class="browser-url">fotorank.dnxsuite.com/concursos/santa-fe-en-foco</span></div>
          <div class="page" style="min-height:180px">
            <img class="page-img" src="/contest-assets/santa-fe-en-foco/hero/hero-desktop.jpg" alt="">
            <div class="page-body">
              <div class="page-eyebrow">Acompañan el concurso</div>
              <div class="page-line"></div><div class="page-line short"></div>
            </div>
            <div class="strip">
              <span class="ghost"></span>
              <div class="slot on-dark"><span class="label">Tu logo aquí</span></div>
              <span class="ghost"></span><span class="ghost"></span>
            </div>
          </div>
        </div>
      </div>
      <p class="mock-note">Su logo junto al de las demás marcas que acompañan, en la página del concurso y con enlace a su sitio. Es la entrada más accesible.</p>
    </article>

    <article class="mock">
      <div class="mock-head"><h3>Banner en la página</h3><span class="mock-kind">Digital · Página del concurso</span></div>
      <div class="mock-stage">
        <div class="browser">
          <div class="browser-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
            <span class="browser-url">fotorank.dnxsuite.com/concursos/santa-fe-en-foco</span></div>
          <div class="page" style="min-height:auto">
            <div class="page-body">
              <div class="page-eyebrow">Categorías</div>
              <div class="page-line"></div><div class="page-line short"></div>
              <div style="margin-top:16px">
                <div class="slot on-dark banner-slot"><span class="label">Tu banner aquí</span><span class="size">Pieza horizontal</span></div>
              </div>
              <div class="page-line" style="margin-top:16px"></div><div class="page-line short"></div>
            </div>
          </div>
        </div>
      </div>
      <p class="mock-note">Una pieza gráfica propia, intercalada en el contenido de la página. Se ve mientras el fotógrafo lee las bases y las categorías.</p>
    </article>

  </div>
</section>

<section>
  <div class="sec-title"><span class="eyebrow">Más allá del concurso</span><h2>Los portales que cubren los Juegos</h2></div>
  <div class="stack">
    <p class="lede">Durante los Juegos Suramericanos, dos portales de la red publican los eventos que van ocurriendo. Su marca puede acompañar también ahí, no solo en la página del concurso.</p>

    <div class="reach">
      <div class="reach-card">
        <div class="mock-stage" style="padding:14px">
          <div class="browser">
            <div class="browser-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
              <span class="browser-url">infospot · noticias y eventos</span></div>
            <div class="page" style="min-height:150px">
              <div class="page-body">
                <div class="page-eyebrow">Cobertura de los Juegos</div>
                <div class="page-line"></div><div class="page-line short"></div>
                <div style="margin-top:12px">
                  <div class="slot on-dark" style="min-height:52px"><span class="label">Tu banner aquí</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="body">
          <h3>InfoSpot</h3>
          <p>El medio donde se publican las noticias y los eventos de cada jornada. Placa de bienvenida, banner de portada y franja de logos.</p>
          <div class="reach-num"><span>Usuarios<b>Miles por mes</b></span></div>
        </div>
      </div>

      <div class="reach-card">
        <div class="mock-stage" style="padding:14px">
          <div class="browser">
            <div class="browser-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
              <span class="browser-url">compramelafoto · fotos de cada evento</span></div>
            <div class="page" style="min-height:150px">
              <div class="page-body">
                <div class="page-eyebrow">Álbum del evento</div>
                <div class="page-line"></div><div class="page-line short"></div>
                <div style="margin-top:12px">
                  <div class="slot on-dark" style="min-height:52px"><span class="label">Tu logo aquí</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="body">
          <h3>ComprameLaFoto</h3>
          <p>Donde los protagonistas buscan y compran sus fotos de cada evento. Su marca aparece en el álbum, justo cuando la persona se busca a sí misma.</p>
          <div class="reach-num"><span>Fotógrafos registrados<b>+700</b></span></div>
        </div>
      </div>
    </div>

    <div class="note">La presencia en estos portales se suma como extensión al patrocinio del concurso. Se contrata aparte y se define por período.</div>
  </div>
</section>

<section>
  <div class="sec-title"><span class="eyebrow">Segunda etapa</span><h2>Merchandising con las fotos ganadoras</h2></div>
  <div class="stack">
    <p class="lede">Terminado el concurso, las fotografías seleccionadas se convierten en piezas que circulan todo el año. Las marcas que acompañaron pueden sumarse a esta etapa, de manera opcional.</p>
    <div class="merch">
      <div class="merch-item"><span class="k">Pieza</span><span class="n">Calendarios</span><p>Doce meses colgados en una pared, con las fotos premiadas.</p></div>
      <div class="merch-item"><span class="k">Pieza</span><span class="n">Agendas</span><p>Uso diario durante todo el año siguiente.</p></div>
      <div class="merch-item"><span class="k">Pieza</span><span class="n">Cuadernos</span><p>Tapas con las fotografías seleccionadas.</p></div>
      <div class="merch-item"><span class="k">Opcional</span><span class="n">Otros espacios</span><p>Se definen junto con las marcas interesadas en esta segunda etapa.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="sec-title"><span class="eyebrow">Cómo se acompaña</span><h2>Cuatro formas de estar</h2></div>
  <div class="stack">
    <p class="lede">Cada categoría combina esos espacios de manera distinta. Estos son los valores de esta edición; la combinación se ajusta a lo que su empresa busque.</p>
    <p class="cmp-hint">Deslizá la tabla para ver las cuatro categorías.</p>
    <div class="cmp-wrap">
      <table class="cmp">
        <thead>
          <tr>
            <th scope="col" class="rowh"><span class="cat-cupo">Qué incluye</span></th>
            <th scope="col" class="lead-col"><span class="cat-name">Main Sponsor</span><span class="cat-cupo">Una sola marca</span></th>
            <th scope="col"><span class="cat-name">Sponsor Principal</span><span class="cat-cupo">Tres a cuatro marcas</span></th>
            <th scope="col"><span class="cat-name">Sponsor Oficial</span><span class="cat-cupo">Hasta diez marcas</span></th>
            <th scope="col"><span class="cat-name">Sponsor Técnico</span><span class="cat-cupo">Según necesidad</span></th>
          </tr>
        </thead>
        <tbody>
          <tr class="cmp-price">
            <th scope="row" class="rowh">Valor del patrocinio</th>
            <td class="lead-col">$450.000</td>
            <td>$250.000</td>
            <td>$150.000</td>
            <td>A convenir<small>Aporte en productos o servicios</small></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Naming del concurso</th>
            <td class="lead-col">«Santa Fe en Foco presentado por…»</td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Exclusividad de rubro</th>
            <td class="lead-col"><span class="yes" aria-label="Incluido">✓</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Placa de bienvenida en la página</th>
            <td class="lead-col"><span class="yes" aria-label="Incluido">✓</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Logo en la página del concurso</th>
            <td class="lead-col">Máxima jerarquía</td>
            <td>Destacado</td>
            <td><span class="yes" aria-label="Incluido">✓</span></td>
            <td>En el bloque de sponsors técnicos</td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Publicaciones en redes</th>
            <td class="lead-col"><span class="yes" aria-label="Incluido">✓</span></td>
            <td><span class="yes" aria-label="Incluido">✓</span></td>
            <td>Dos publicaciones</td>
            <td>Historia y mención por su aporte</td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Mailing a inscriptos</th>
            <td class="lead-col">Exclusivo</td>
            <td><span class="yes" aria-label="Incluido">✓</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Video o contenido de marca</th>
            <td class="lead-col">Video, entrevista y prensa</td>
            <td><span class="yes" aria-label="Incluido">✓</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Menciones en streaming</th>
            <td class="lead-col"><span class="yes" aria-label="Incluido">✓</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Presencia en el recorrido del evento</th>
            <td class="lead-col"><span class="yes" aria-label="Incluido">✓</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Espacio de encuentro con los participantes</th>
            <td class="lead-col"><span class="yes" aria-label="Incluido">✓</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Presencia en la premiación</th>
            <td class="lead-col"><span class="yes" aria-label="Incluido">✓</span></td>
            <td><span class="yes" aria-label="Incluido">✓</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Enlace a su sitio con seguimiento</th>
            <td class="lead-col"><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="yes" aria-label="Incluido">✓</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Reconocimiento como Proveedor Técnico Oficial</th>
            <td class="lead-col"><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="no" aria-label="No incluido">—</span></td>
            <td><span class="yes" aria-label="Incluido">✓</span></td>
          </tr>
          <tr>
            <th scope="row" class="rowh">Forma del aporte</th>
            <td class="lead-col">Económico</td>
            <td>Económico</td>
            <td>Económico</td>
            <td>Productos, servicios, equipamiento o logística</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p style="font-size:14.5px;color:var(--ink-2)">El Main Sponsor incluye, además, los espacios de las categorías siguientes. Los valores corresponden a esta edición y no incluyen la presencia en InfoSpot y ComprameLaFoto, que se contrata aparte.</p>
  </div>
</section>

<section>
  <div class="sec-title"><span class="eyebrow">El concurso</span><h2>A qué se suma su marca</h2></div>
  <div class="stack">
    <h3>Los premios</h3>
    <div class="podio">
      <div class="podio-item first">
        <span class="podio-pos">Primeros premios</span>
        <span class="podio-monto">$500.000</span>
        <span class="podio-det">Uno por cada categoría · cuatro en total</span>
      </div>
      <div class="podio-item">
        <span class="podio-pos">Segundos premios</span>
        <span class="podio-monto">$400.000</span>
        <span class="podio-det">Uno por cada categoría · cuatro en total</span>
      </div>
      <div class="podio-item">
        <span class="podio-pos">Terceros premios</span>
        <span class="podio-monto">$300.000</span>
        <span class="podio-det">Uno por cada categoría · cuatro en total</span>
      </div>
      <div class="podio-item">
        <span class="podio-pos">Total</span>
        <span class="podio-monto">$4.800.000</span>
        <span class="podio-det">Doce premios en dinero</span>
      </div>
    </div>
    <div class="note">El fondo de premios ya está cubierto por la Cámara de Senadores de la Provincia de Santa Fe y la Sociedad de Fotógrafos Profesionales de Rosario. Se detalla acá para que se vea la escala del concurso al que se suma su marca: <strong>el patrocinio no financia los premios</strong>, acompaña la producción, la difusión y la presencia de marca.</div>

    <h3 style="margin-top:14px">Las cuatro categorías</h3>
    <div class="cats">
      <div class="cat"><h3>Fotógrafo Profesional</h3><p>Para quienes participan como profesionales. La fotografía debe estar tomada con cámara.</p></div>
      <div class="cat"><h3>Fotógrafo Amateur</h3><p>Para aficionados. Se admiten fotografías tomadas con celular o con cámara.</p></div>
      <div class="cat"><h3>Reportero Gráfico</h3><p>Para reporteros gráficos, con número de socio de ARGRA verificado por la organización.</p></div>
      <div class="cat"><h3>Fotografía Aérea</h3><p>Para fotografías realizadas con dron, con la documentación técnica que corresponda.</p></div>
    </div>

    <h3 style="margin-top:14px">Fechas</h3>
    <div class="facts">
      <div class="fact"><span class="k">Apertura</span><span class="v">1 de agosto de 2026</span></div>
      <div class="fact"><span class="k">Cierre de inscripción</span><span class="v">30 de septiembre de 2026</span></div>
      <div class="fact"><span class="k">Evaluación</span><span class="v">1 al 10 de octubre</span></div>
      <div class="fact"><span class="k">Resultados</span><span class="v">14 de octubre de 2026</span></div>
    </div>

    <p style="margin-top:6px;color:var(--ink-2)">La participación es abierta a todo el país. La fotografía debe haber sido tomada dentro del territorio provincial y durante el período oficial del concurso.</p>
  </div>
</section>

<section>
  <div class="cta">
    <h2>Conversemos qué lugar le queda mejor</h2>
    <p>Contamos cuáles de estos espacios están disponibles para esta edición y armamos la combinación que se ajuste a lo que su empresa busca.</p>
    <a href="mailto:sfprosario@gmail.com?subject=Patrocinio%20Santa%20Fe%20en%20Foco%202026">Escribir a sfprosario@gmail.com</a>
  </div>
</section>

<p class="foot">Sociedad de Fotógrafos Profesionales de Rosario · Rosario, Argentina · Las imágenes de los espacios son maquetas ilustrativas</p>

</div>`;
