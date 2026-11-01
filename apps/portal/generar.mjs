// Genera las páginas estáticas del portal en public/.
// Uso: node apps/portal/generar.mjs  (las páginas generadas se suben al repo;
// Vercel sólo sirve public/, sin compilar nada).

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { herramientas, otras, necesidades } from "./herramientas.mjs";

const salida = join(dirname(fileURLToPath(import.meta.url)), "public");
const SITIO = "https://www.dnx-suite.com";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Alto de cada logo a 900 px de ancho (los originales no tienen la misma proporción).
const ALTO = { compramelafoto: 175, "cuanto-cobro": 191, fotoffice: 276, fotofluxx: 271, fotorank: 278, "muestras-fotograficas": 169, camofduty: 180 };

const porSlug = Object.fromEntries(herramientas.map((h) => [h.slug, h]));

// Fila de íconos de la portada: el diafragma de cada herramienta, con su nombre.
const iconos = () => `<ul class="iconos" aria-label="Las herramientas principales">${herramientas
  .map(
    (h) =>
      `<li><a href="/${h.slug}"><img src="/logos/${h.slug}-icono.webp" alt="" width="64" height="64"><span>${esc(h.nombre)}</span></a></li>`,
  )
  .join("")}</ul>`;

const cabecera = (actual) => `<header class="cabecera">
  <a class="marca" href="/" aria-label="DNX Suite, inicio">DNX Suite</a>
  <nav aria-label="Principal">
    <a href="/#herramientas"${actual === "herramientas" ? ' aria-current="page"' : ""}>Herramientas</a>
    <a href="/#empezar">¿Por dónde empiezo?</a>
  </nav>
</header>`;

const pie = `<footer class="pie">
  <p class="marca">DNX Suite</p>
  <p>Herramientas para fotógrafos e instituciones fotográficas, hechas en Rosario, Argentina.</p>
  <ul>${herramientas.map((h) => `<li><a href="/${h.slug}">${esc(h.nombre)}</a></li>`).join("")}${otras
    .map((o) => `<li><a href="${o.url}">${esc(o.nombre)}</a></li>`)
    .join("")}</ul>
</footer>`;

// Globo de WhatsApp: el mensaje arranca con un saludo que dice que viene del portal
// (y de qué página), para que Dani sepa de dónde llega la consulta.
const WHATSAPP = "5493413748324";
const globoWhatsapp = (pagina) => {
  const mensaje = `¡Hola Dani! Te escribo desde la web de DNX Suite (dnx-suite.com)${
    pagina ? `, estaba mirando ${pagina}` : ""
  }. Tengo una consulta: `;
  return `<a class="whatsapp" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}" target="_blank" rel="noopener">
  <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M16.04 3C8.86 3 3.03 8.82 3.03 16c0 2.3.6 4.53 1.74 6.5L3 29l6.68-1.75A12.96 12.96 0 0 0 16.04 29C23.2 29 29 23.18 29 16S23.2 3 16.04 3Zm0 23.68c-2 0-3.95-.54-5.65-1.55l-.4-.24-3.97 1.04 1.06-3.86-.26-.4A10.63 10.63 0 0 1 5.36 16c0-5.9 4.8-10.68 10.68-10.68 5.88 0 10.66 4.79 10.66 10.68 0 5.9-4.79 10.68-10.66 10.68Zm5.86-8c-.32-.16-1.9-.94-2.2-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.58-1.6-.95-.85-1.6-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.1-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66 0 1.57 1.14 3.09 1.3 3.3.16.21 2.25 3.43 5.45 4.81.76.33 1.35.53 1.82.67.76.24 1.46.21 2 .13.61-.09 1.9-.78 2.16-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37Z"/></svg>
  <span>¿Necesitás ayuda?</span>
</a>`;
};

const documento = ({ titulo, descripcion, ruta, cuerpo, tema = "#172033", pagina = null }) => `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${SITIO}${ruta}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="${SITIO}${ruta}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_AR">
<meta name="theme-color" content="${tema}">
<link rel="preload" href="/fuentes/league-spartan-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/estilos.css">
<script src="/referidos.js" defer></script>
</head>
<body>
<a class="saltar" href="#contenido">Ir al contenido</a>
${cuerpo}
${globoWhatsapp(pagina)}
</body>
</html>
`;

function filaHerramienta(h) {
  const acciones = h.registro
    ? `<a class="boton boton-chico" style="--c:${h.tinta}" href="${h.registro.url}">${esc(h.registro.texto)}</a>`
    : `<span class="estado">${esc(h.estado)}</span>`;
  return `<li class="fila" style="--c:${h.color};--t:${h.tinta};--alto:${h.altoLogo}px">
  <a class="fila-logo" href="/${h.slug}"><img src="/logos/${h.slug}-claro.webp" alt="${esc(h.nombre)}" width="900" height="${ALTO[h.slug]}" loading="lazy"></a>
  <div class="fila-texto">
    <p class="fila-frase">${esc(h.frase)}</p>
    <p class="fila-para">${esc(h.para)}</p>
  </div>
  <div class="fila-acciones">
    <a class="enlace" href="/${h.slug}">Conocer ${esc(h.nombre)}</a>
    ${acciones}
  </div>
</li>`;
}

function inicio() {
  const destino = (slug) => {
    const h = porSlug[slug];
    if (h) return { url: `/${h.slug}`, nombre: h.nombre, tinta: h.tinta };
    const o = otras.find((x) => x.url.includes(slug));
    return { url: o.url, nombre: o.nombre, tinta: "#172033" };
  };
  const cuerpo = `${cabecera()}
<main id="contenido">
  <section class="portada">
    <div class="portada-texto">
      <h1>Todo lo que tu fotografía necesita fuera de la cámara.</h1>
      <p class="bajada">Vender las fotos, saber cuánto cobrar, ordenar el estudio, organizar un concurso, colgar una muestra. Cada cosa tiene su herramienta, y todas son parte de DNX Suite.</p>
      <p class="portada-acciones">
        <a class="boton" href="#herramientas">Ver las herramientas</a>
        <a class="enlace" href="#empezar">¿Por dónde empiezo?</a>
      </p>
    </div>
    ${iconos()}
  </section>

  <section id="herramientas" class="bloque">
    <h2>Las herramientas</h2>
    <p class="bloque-bajada">Tocá cualquiera para ver qué hace, para quién es y cómo empezar.</p>
    <ul class="filas">${herramientas.map(filaHerramienta).join("")}</ul>
  </section>

  <section id="empezar" class="bloque">
    <h2>¿Por dónde empiezo?</h2>
    <p class="bloque-bajada">Elegí lo que querés hacer.</p>
    <ul class="necesidades">${necesidades
      .map(([texto, slug]) => {
        const d = destino(slug);
        return `<li><a href="${d.url}" style="--t:${d.tinta}"><span>${esc(texto)}</span><span class="necesidad-destino">${esc(d.nombre)}</span></a></li>`;
      })
      .join("")}</ul>
  </section>

  <section class="bloque">
    <h2>También en DNX Suite</h2>
    <ul class="otras">${otras
      .map(
        (o) => `<li><h3><a href="${o.url}">${esc(o.nombre)}</a></h3><p>${esc(o.texto)}</p><p class="dominio">${esc(o.dominio)}</p></li>`,
      )
      .join("")}</ul>
  </section>

  <section class="bloque cuentas">
    <h2>¿Cómo me registro?</h2>
    <p>Cada herramienta tiene su propia cuenta: te registrás en la que vas a usar, desde su página. ¿Cuánto Cobro? y Cam Of Duty entran con la cuenta de ComprameLaFoto.</p>
  </section>
</main>
${pie}`;
  return documento({
    titulo: "DNX Suite | Herramientas para fotógrafos",
    descripcion:
      "ComprameLaFoto, ¿Cuánto Cobro?, FOTOFFICE, FotoFluxx, FotoRank y Muestras Fotográficas: las herramientas de DNX Suite para vender, cobrar, organizar y mostrar fotografía.",
    ruta: "/",
    cuerpo,
  });
}

function pagina(h) {
  const acciones = h.registro
    ? `<a class="boton" style="--c:${h.tinta}" href="${h.registro.url}">${esc(h.registro.texto)}</a>
       ${h.secundario ? `<a class="enlace" style="--t:${h.tinta}" href="${h.secundario.url}">${esc(h.secundario.texto)}</a>` : ""}`
    : `<span class="estado estado-grande">${esc(h.estado)}</span>`;
  const resto = herramientas.filter((x) => x.slug !== h.slug);
  const cuerpo = `${cabecera("herramientas")}
<main id="contenido" class="producto" style="--c:${h.color};--t:${h.tinta}">
  <section class="producto-portada">
    <img class="producto-logo" src="/logos/${h.slug}-claro.webp" alt="${esc(h.nombre)}" width="900" height="${ALTO[h.slug]}">
    <h1>${esc(h.frase)}</h1>
    <p class="bajada">${esc(h.resumen)}</p>
    <p class="portada-acciones">${acciones}</p>
    ${h.url ? `<p class="dominio">En <a href="${h.url}">${esc(h.dominio)}</a></p>` : ""}
  </section>

  <section class="bloque producto-grilla">
    <div>
      <h2>Para quién es</h2>
      <ul class="lista">${h.paraQuien.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
    </div>
    <div>
      <h2>Cómo empezar</h2>
      <ol class="pasos">${h.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
      <p class="nota">${esc(h.cuenta)}</p>
    </div>
  </section>

  <section class="bloque">
    <h2>Qué podés hacer</h2>
    <div class="funciones">${h.funciones
      .map((f) => `<div><h3>${esc(f.titulo)}</h3><ul class="lista">${f.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`)
      .join("")}</div>
  </section>

  <section class="bloque cierre">
    <h2>${h.registro ? `Empezá con ${esc(h.nombre)}` : `${esc(h.nombre)} abre pronto`}</h2>
    <p class="portada-acciones">${acciones}</p>
  </section>

  <nav class="bloque vecinas" aria-label="Otras herramientas">
    <h2>Otras herramientas de DNX Suite</h2>
    <ul>${resto
      .map(
        (x) => `<li><a href="/${x.slug}"><img src="/logos/${x.slug}-icono.webp" alt="" width="56" height="56" loading="lazy"><span>${esc(x.nombre)}</span></a></li>`,
      )
      .join("")}</ul>
  </nav>
</main>
${pie}`;
  return documento({
    titulo: `${h.nombre} | DNX Suite`,
    descripcion: `${h.frase} ${h.resumen}`.slice(0, 300),
    ruta: `/${h.slug}`,
    cuerpo,
    tema: h.tinta,
    pagina: h.nombre,
  });
}

writeFileSync(join(salida, "index.html"), inicio());
for (const h of herramientas) writeFileSync(join(salida, `${h.slug}.html`), pagina(h));
console.log(`Generadas ${herramientas.length + 1} páginas en ${salida}`);
