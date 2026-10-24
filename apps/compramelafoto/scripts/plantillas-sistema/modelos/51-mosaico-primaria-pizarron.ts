import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, agrandar, centrado } from "../lienzo";
import { azar, estrella, filtroCrayon, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Pizarrón: pizarra gris oscura con dibujos de tiza de colores (como las
 * viñetas rusas «школьная доска»). Tapa con el retrato grande en marco blanco; adentro, el
 * mosaico en recuadros blancos con el nombre en tiza.
 */

const TIZA = "#f6f3e8";
const AMARILLO = "#ffe066";
const CELESTE = "#8fd3ff";
const ROSA = "#ff9fbf";
const VERDE = "#a7e08a";

const RETRATO = centrado(CENTRO_DER, 430, 1100, 1380);
const GRUPAL = centrado(CENTRO_IZQ, 420, 1420, 950);
const MAESTRA = { x: 260, y: 1520, w: 470, h: 590 };

const DEFS = `
  <filter id="polvo" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="4" seed="21"/>
    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.8 0 0 0 -0.38"/>
  </filter>
  <filter id="motas" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="5"/>
    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.0"/>
  </filter>
  ${filtroCrayon("tiza", 9, 10)}`;

function pizarra() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="#2c3133"/>
    <rect width="${ANCHO}" height="${ALTO}" filter="url(#polvo)" opacity="0.45"/>
    <rect width="${ANCHO}" height="${ALTO}" filter="url(#motas)" opacity="0.3"/>`;
}

/** Garabatos de tiza (números, letras sueltas, estrellas, flechas) en las zonas libres. */
function garabatos(semilla: number, zonas: Array<{ x: number; y: number }>) {
  const a = azar(semilla);
  let out = "";
  for (const z of zonas) {
    const c = a.elegir([TIZA, AMARILLO, CELESTE, ROSA, VERDE]);
    const t = a.entre(45, 75);
    const k = Math.floor(a.r() * 5);
    if (k === 0) out += `<polygon points="${estrella(z.x, z.y, t)}" stroke="${c}" fill="none"/>`;
    else if (k === 1) out += `<text x="${z.x}" y="${z.y}" font-family="Schoolbell, cursive" font-size="${t * 2.4}" fill="${c}" text-anchor="middle">${a.elegir(["1+2", "A", "abc", "7", "3×3"])}</text>`;
    else if (k === 2) out += `<path d="M ${z.x - t} ${z.y} q ${t} ${-t} ${2 * t} 0 m -30 -20 l 30 20 l -34 14" stroke="${c}" fill="none"/>`;
    else if (k === 3) out += `<circle cx="${z.x}" cy="${z.y}" r="${t * 0.7}" stroke="${c}" fill="none"/><path d="M ${z.x} ${z.y - t * 0.7} v ${-t * 0.6}" stroke="${c}"/>`;
    else out += `<path d="M ${z.x - t} ${z.y + t / 2} l ${t} ${-t} l ${t} ${t} z" stroke="${c}" fill="none"/>`;
  }
  return `<g stroke-width="11" stroke-linecap="round" stroke-linejoin="round" filter="url(#tiza)">${out}</g>`;
}

/** Un lápiz de tiza dibujado en diagonal. */
function lapiz(x: number, y: number, largo: number, giro: number, color: string) {
  return `<g transform="rotate(${giro} ${x} ${y})" stroke="${color}" stroke-width="10" fill="none" filter="url(#tiza)">
    <rect x="${x}" y="${y - 32}" width="${largo}" height="64" rx="6"/><path d="M ${x + largo} ${y - 32} l 80 32 l -80 32"/>
    <path d="M ${x + 70} ${y - 32} v 64"/></g>`;
}

export const mosaicoPrimariaPizarron: Modelo = {
  slug: "mosaico-primaria-pizarron",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Pizarrón",
  descripcion: `Carpeta 30×20 cm para primaria: pizarrón con dibujos de tiza de colores. El retrato grande del alumno en la tapa; la foto grupal y la seño en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Primaria",
  filtros: { estilo: "Divertido", etiquetas: ["mosaico", "compañeros", "pizarrón", "tiza", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `${pizarra()}
       ${lapiz(2050, 2140, 360, -8, AMARILLO)}
       ${garabatos(4, [{ x: 3280, y: 260 }, { x: 3300, y: 1150 }, { x: 3330, y: 2120 }, { x: 1550, y: 1660 }, { x: 1500, y: 2140 }, { x: 260, y: 230 }])}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${pizarra()}
       ${garabatos(11, [{ x: 330, y: 2210 }, { x: 1480, y: 2220 }, { x: 2080, y: 2220 }, { x: 3250, y: 2215 }])}`,
      DEFS,
    ),

  armar: (a) => {
    const tiza = (tam: number, color = TIZA, extra = {}) => ({ familia: "Schoolbell", tam, color, ...extra });

    // Contratapa: la foto grupal y la seño.
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 180, 1300, 190), "¡Nuestro grado!", tiza(140, AMARILLO));
    a.forma(0, "marco_grupal", "Marco de la foto grupal", agrandar(GRUPAL, 22), { relleno: TIZA });
    a.foto(0, "grupal", GRUPAL);
    a.forma(0, "marco_maestra", "Marco de la seño", agrandar(MAESTRA, 18), { relleno: TIZA, giro: -3 });
    a.foto(0, "maestra", MAESTRA, { giro: -3 });
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 820, y: 1640, w: 820, h: 170 }, "Nuestra seño", tiza(110, ROSA, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Grado y escuela", { x: 820, y: 1830, w: 820, h: 260 }, "course.withSchool", "Grado - Escuela", tiza(70, CELESTE, { alinear: "LEFT", interlineado: 1.2 }));

    // Tapa: el retrato grande y los datos.
    a.forma(0, "marco_retrato", "Marco del retrato", agrandar(RETRATO, 26), { relleno: TIZA });
    a.foto(0, "individual", RETRATO);
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1880, 1400, 200), "student.fullName", "Nombre del alumno", tiza(130, AMARILLO, { interlineado: 1.05 }));
    a.variable(0, "curso", "Grado", centrado(CENTRO_DER, 210, 1300, 170), "course.displayName", "Grado", tiza(120, CELESTE));
    a.variable(0, "colegio", "Escuela", centrado(CENTRO_DER, 2085, 1400, 120), "school.name", "Escuela", tiza(70, TIZA));

    // Interior: el mosaico en las dos páginas.
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 110, 1300, 170), "Mis compañeros", tiza(120, AMARILLO));
    a.texto(1, "anio", "Año", centrado(CENTRO_DER, 110, 1300, 170), "Ciclo lectivo 2026", tiza(100, CELESTE));
    mosaicoEnDosPaginas(a, 330, 1800, tiza(46, TIZA, { interlineado: 1.05 }), {
      frame: "rect",
      photoAspect: 0.78,
      gapX: 34,
      gapY: 30,
      borderWidth: 12,
      borderColor: TIZA,
      namePosition: "below",
      nameLines: 2,
      givenNames: "first",
    });
  },
};

