import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { azar, filtroGrano, grano, onda, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Mundo marino: mar azul que se oscurece hacia el fondo, burbujas, pececitos
 * de colores, algas y arena. El retrato de la tapa es una gran burbuja; adentro, el mosaico en
 * burbujas con borde celeste y el nombre en blanco.
 */

const ESPUMA = "#ffffff";
const CELESTE = "#8fe3ff";
const AMARILLO = "#ffd166";
const CORAL = "#ff8a80";
const PECES = ["#ff9f43", "#ffd166", "#ff6b9a", "#7bed9f", "#c3a6ff"];

const RETRATO = centrado(CENTRO_DER, 300, 1060, 1060);
const GRUPAL = centrado(CENTRO_IZQ, 400, 1400, 930);
const MAESTRA = { x: 300, y: 1520, w: 520, h: 520 };

const DEFS = `<linearGradient id="mar" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4cc3ea"/><stop offset="0.55" stop-color="#1f86c4"/><stop offset="1" stop-color="#145a99"/></linearGradient>
  <radialGradient id="burbuja" cx="0.35" cy="0.3" r="0.7"><stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="0.7" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.35"/></radialGradient>
  <linearGradient id="luz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  ${filtroGrano("g", 0.85)}`;

function mar() {
  let rayos = "";
  for (const [x, w] of [[300, 220], [1100, 160], [2100, 260], [2900, 180]] as const) {
    rayos += `<polygon points="${x},0 ${x + w},0 ${x + w * 2.6},${ALTO * 0.75} ${x + w * 1.4},${ALTO * 0.75}" fill="url(#luz)"/>`;
  }
  return `<rect width="${ANCHO}" height="${ALTO}" fill="url(#mar)"/>${rayos}`;
}

function burbujas(semilla: number, zona: { x: number; y: number; w: number; h: number }, n: number, evitar: Array<{ x: number; y: number; w: number; h: number }> = []) {
  const a = azar(semilla);
  let out = "";
  let k = 0;
  for (let i = 0; i < n * 15 && k < n; i++) {
    const x = a.entre(zona.x, zona.x + zona.w);
    const y = a.entre(zona.y, zona.y + zona.h);
    if (evitar.some((e) => x > e.x && x < e.x + e.w && y > e.y && y < e.y + e.h)) continue;
    const r = a.entre(12, 46);
    out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="url(#burbuja)" stroke="#ffffff" stroke-opacity="0.7" stroke-width="4"/>
      <circle cx="${(x - r * 0.35).toFixed(0)}" cy="${(y - r * 0.35).toFixed(0)}" r="${(r * 0.18).toFixed(1)}" fill="#ffffff" opacity="0.85"/>`;
    k++;
  }
  return out;
}

/** Pececito: cuerpo ovalado, cola de triángulo, ojito y una aleta. `dir` 1 mira a la derecha. */
function pez(x: number, y: number, s: number, color: string, dir = 1) {
  const t = `translate(${x} ${y}) scale(${dir} 1)`;
  return `<g transform="${t}">
    <polygon points="${-s * 0.8},0 ${-s * 1.35},${-s * 0.45} ${-s * 1.35},${s * 0.45}" fill="${color}"/>
    <ellipse cx="0" cy="0" rx="${s}" ry="${s * 0.62}" fill="${color}"/>
    <path d="M ${-s * 0.15} ${-s * 0.6} q ${s * 0.3} ${-s * 0.35} ${s * 0.5} ${-s * 0.02}" fill="${color}"/>
    <path d="M ${-s * 0.25} ${-s * 0.5} q ${s * 0.18} ${s * 0.5} 0 ${s}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${s * 0.08}" fill="none"/>
    <circle cx="${s * 0.5}" cy="${-s * 0.12}" r="${s * 0.15}" fill="#ffffff"/><circle cx="${s * 0.54}" cy="${-s * 0.12}" r="${s * 0.08}" fill="#22313f"/>
  </g>`;
}

/** Alga ondulada que sube desde abajo. */
function alga(x: number, alto: number, color: string) {
  let d = `M ${x} ${ALTO}`;
  for (let y = ALTO, i = 0; y > ALTO - alto; y -= 70, i++) d += ` q ${i % 2 ? 40 : -40} -35 0 -70`;
  return `<path d="${d}" stroke="${color}" stroke-width="30" fill="none" stroke-linecap="round"/>`;
}

function fondoMar(arena: boolean) {
  return arena
    ? `<path d="${onda(0, ANCHO + 200, ALTO - 110, 30, 520)} L ${ANCHO + 200} ${ALTO} L 0 ${ALTO} Z" fill="#f3d9a4"/>
       <path d="${onda(0, ANCHO + 200, ALTO - 60, 20, 380)} L ${ANCHO + 200} ${ALTO} L 0 ${ALTO} Z" fill="#e8c788"/>`
    : "";
}

export const mosaicoJardinMarino: Modelo = {
  slug: "mosaico-jardin-marino",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Mundo marino",
  descripcion: `Carpeta 30×20 cm para jardín: fondo de mar azul con burbujas, pececitos de colores, algas y arena. El retrato grande del alumno dentro de una burbuja en la tapa; la foto grupal y la seño en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Jardín",
  filtros: { estilo: "Moderno", etiquetas: ["mosaico", "compañeros", "mar", "peces", "burbujas", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () => {
    const evitar = [agrandar(RETRATO, 110), agrandar(GRUPAL, 70), { x: 1900, y: 1450, w: 1500, h: 700 }, { x: 220, y: 1440, w: 1400, h: 700 }, { x: 200, y: 100, w: 1350, h: 260 }];
    return svg(
      `${mar()}
       ${alga(140, 520, "#2fb88a")}${alga(230, 360, "#4fd1a1")}${alga(1600, 460, "#2fb88a")}${alga(1960, 380, "#4fd1a1")}${alga(3400, 560, "#2fb88a")}${alga(3310, 340, "#4fd1a1")}
       ${fondoMar(true)}
       ${burbujas(5, { x: 60, y: 60, w: ANCHO - 120, h: ALTO - 300 }, 70, evitar)}
       ${pez(1580, 1500, 70, PECES[0]!, -1)}${pez(2060, 160, 60, PECES[1]!)}${pez(3330, 300, 66, PECES[2]!, -1)}
       ${pez(2000, 1250, 56, PECES[3]!)}${pez(3360, 1360, 60, PECES[4]!, -1)}${pez(220, 1450, 52, PECES[1]!)}
       ${grano("g", 0.04)}`,
      DEFS,
    );
  },

  fondoInterior: () =>
    svg(
      `${mar()}
       ${alga(70, 300, "#2fb88a")}${alga(PLIEGUE - 80, 260, "#4fd1a1")}${alga(PLIEGUE + 80, 300, "#2fb88a")}${alga(ANCHO - 70, 280, "#4fd1a1")}
       ${burbujas(17, { x: 40, y: 40, w: ANCHO - 80, h: 240 }, 26, [{ x: 180, y: 0, w: 1450, h: 330 }, { x: 1900, y: 0, w: 1520, h: 330 }])}
       ${pez(130, 180, 42, PECES[0]!)}${pez(ANCHO - 120, 180, 42, PECES[2]!, -1)}
       ${grano("g", 0.04)}`,
      DEFS,
    ),

  armar: (a) => {
    const titulo = (tam: number, color = ESPUMA, extra = {}) => ({ familia: "Nunito", tam, color, peso: 800, ...extra });
    const suave = (tam: number, color = ESPUMA, extra = {}) => ({ familia: "Quicksand", tam, color, peso: 700, ...extra });

    // Contratapa
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 140, 1300, 190), "Nuestro cardumen", titulo(116, AMARILLO));
    a.forma(0, "marco_grupal", "Marco de la foto grupal", agrandar(GRUPAL, 26), { relleno: CELESTE, radio: 60 });
    a.foto(0, "grupal", GRUPAL, { radio: 40 });
    a.forma(0, "aro_maestra", "Aro de la seño", agrandar(MAESTRA, 40), { relleno: "#ffffff", circulo: true, opacidad: 0.35 });
    a.forma(0, "marco_maestra", "Marco de la seño", agrandar(MAESTRA, 20), { relleno: CELESTE, circulo: true });
    a.foto(0, "maestra", MAESTRA, { mascara: "circle" });
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 940, y: 1580, w: 680, h: 170 }, "Nuestra seño", titulo(104, AMARILLO, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Sala y jardín", { x: 940, y: 1770, w: 680, h: 260 }, "course.withSchool", "Sala - Jardín", suave(62, ESPUMA, { alinear: "LEFT", interlineado: 1.2 }));

    // Tapa: el retrato en una burbuja.
    a.forma(0, "halo_retrato", "Halo del retrato", agrandar(RETRATO, 70), { relleno: "#ffffff", circulo: true, opacidad: 0.25 });
    a.forma(0, "marco_retrato", "Marco del retrato", agrandar(RETRATO, 30), { relleno: CELESTE, circulo: true });
    a.foto(0, "individual", RETRATO, { mascara: "circle" });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1500, 1420, 220), "student.fullName", "Nombre del alumno", titulo(112, ESPUMA, { interlineado: 1.05 }));
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER, 1730, 1300, 140), "course.displayName", "Sala", suave(92, AMARILLO));
    a.variable(0, "colegio", "Jardín", centrado(CENTRO_DER, 1880, 1300, 110), "school.name", "Jardín", suave(62, ESPUMA, { peso: 600 }));
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 2000, 600, 100), "2026", suave(64, CORAL));

    // Interior
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 90, 1300, 180), "Mis compañeros", titulo(112, AMARILLO));
    a.variable(1, "sala", "Sala", centrado(CENTRO_DER, 100, 1200, 170), "course.displayName", "Sala", titulo(98, ESPUMA));
    mosaicoEnDosPaginas(a, 330, 1860, suave(48, ESPUMA), {
      frame: "circle",
      gapX: 40,
      gapY: 30,
      borderWidth: 14,
      borderColor: CELESTE,
      namePosition: "below",
      nameLines: 1,
      givenNames: "first",
    });
  },
};
