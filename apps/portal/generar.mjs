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
const ALTO = { compramelafoto: 175, "cuanto-cobro": 191, fotoffice: 276, fotofluxx: 271, fotorank: 278, "muestras-fotograficas": 169 };

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

const documento = ({ titulo, descripcion, ruta, cuerpo, tema = "#172033" }) => `<!doctype html>
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
</head>
<body>
<a class="saltar" href="#contenido">Ir al contenido</a>
${cuerpo}
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
    <p>Cada herramienta tiene su propia cuenta: te registrás en la que vas a usar, desde su página. La única que comparte cuenta es ¿Cuánto Cobro?, que entra con la de ComprameLaFoto.</p>
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
  });
}

writeFileSync(join(salida, "index.html"), inicio());
for (const h of herramientas) writeFileSync(join(salida, `${h.slug}.html`), pagina(h));
console.log(`Generadas ${herramientas.length + 1} páginas en ${salida}`);
