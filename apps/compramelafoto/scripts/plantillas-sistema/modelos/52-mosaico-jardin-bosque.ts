import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { conejo, oso } from "../animalitos";
import { azar, filtroAcuarela, filtroGrano, grano, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Bosque de animalitos: papel crema con manchas de acuarela verde, arbolitos
 * redondos y animalitos del bosque. Tapa con el retrato en un círculo de borde blanco; adentro, el
 * mosaico en círculos con borde blanco grueso sobre dos tarjetas de color salvia.
 */

const CREMA = "#fbf5e6";
const SALVIA = "#cfe3c4";
const VERDE = "#79b07f";
const VERDE_OSC = "#3e6a49";
const MARRON = "#8a6248";
const ROSA = "#e98a8a";

const RETRATO = centrado(CENTRO_DER, 250, 1080, 1080);
const GRUPAL = centrado(CENTRO_IZQ, 400, 1360, 900);
const MAESTRA = { x: 290, y: 1500, w: 540, h: 540 };

const DEFS = `${filtroAcuarela("acu", 12)}${filtroAcuarela("acu2", 31)}${filtroGrano("g", 0.85)}`;

/** Arbolito redondo de acuarela: tronco y copa de tres círculos. */
function arbol(x: number, base: number, alto: number, color: string) {
  const r = alto * 0.3;
  return `<g>
    <rect x="${x - alto * 0.04}" y="${base - alto * 0.45}" width="${alto * 0.08}" height="${alto * 0.45}" rx="${alto * 0.03}" fill="${MARRON}" opacity="0.85"/>
    <g filter="url(#acu)" fill="${color}" opacity="0.85">
      <circle cx="${x}" cy="${base - alto + r}" r="${r}"/>
      <circle cx="${x - r * 0.7}" cy="${base - alto * 0.55}" r="${r * 0.8}"/>
      <circle cx="${x + r * 0.7}" cy="${base - alto * 0.55}" r="${r * 0.8}"/>
    </g>
  </g>`;
}

/** Hojitas sueltas de acuarela. */
function hojas(semilla: number, zonas: Array<{ x: number; y: number }>) {
  const a = azar(semilla);
  let out = "";
  for (const z of zonas) {
    const t = a.entre(40, 70);
    const g = a.entre(-60, 60);
    const c = a.elegir([VERDE, "#a7cf8e", "#e7b46a", ROSA]);
    out += `<g transform="rotate(${g.toFixed(0)} ${z.x} ${z.y})"><path d="M ${z.x - t} ${z.y} Q ${z.x} ${z.y - t * 0.8} ${z.x + t} ${z.y} Q ${z.x} ${z.y + t * 0.8} ${z.x - t} ${z.y} Z" fill="${c}" opacity="0.8"/>
      <path d="M ${z.x - t * 0.8} ${z.y} L ${z.x + t * 0.8} ${z.y}" stroke="#ffffff" stroke-width="5" opacity="0.6"/></g>`;
  }
  return out;
}

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>`;
}

export const mosaicoJardinBosque: Modelo = {
  slug: "mosaico-jardin-bosque",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Bosque de animalitos",
  descripcion: `Carpeta 30×20 cm para jardín: papel crema con acuarelas verdes, arbolitos y animalitos del bosque. El retrato grande del alumno en un círculo en la tapa; la foto grupal y la seño en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Jardín",
  filtros: { estilo: "Clásico", etiquetas: ["mosaico", "compañeros", "bosque", "animalitos", "acuarela", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `${papel()}
       <g filter="url(#acu2)" opacity="0.55">
         <ellipse cx="${CENTRO_DER}" cy="${RETRATO.y + RETRATO.h / 2}" rx="760" ry="700" fill="${SALVIA}"/>
         <ellipse cx="${CENTRO_IZQ}" cy="${GRUPAL.y + GRUPAL.h / 2}" rx="880" ry="640" fill="${SALVIA}"/>
       </g>
       <g filter="url(#acu)" opacity="0.7">
         <ellipse cx="${PLIEGUE * 0.5}" cy="${ALTO + 120}" rx="${PLIEGUE * 0.75}" ry="260" fill="${VERDE}"/>
         <ellipse cx="${PLIEGUE * 1.5}" cy="${ALTO + 150}" rx="${PLIEGUE * 0.7}" ry="250" fill="#9cc98a"/>
       </g>
       ${arbol(1580, 2270, 400, VERDE)}${arbol(130, 2300, 300, "#a7cf8e")}
       ${arbol(1960, 2290, 420, "#a7cf8e")}${arbol(3360, 2280, 520, VERDE)}
       ${oso(2160, 2170, 95)}${conejo(3130, 2190, 90)}
       ${hojas(5, [{ x: 200, y: 200 }, { x: 1560, y: 230 }, { x: 1980, y: 180 }, { x: 3360, y: 220 }, { x: 3380, y: 1300 }, { x: 1980, y: 1320 }])}
       ${grano("g", 0.05)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${papel()}
       <g filter="url(#acu2)" opacity="0.5">
         <circle cx="80" cy="80" r="330" fill="${SALVIA}"/><circle cx="${ANCHO - 80}" cy="90" r="330" fill="${SALVIA}"/>
         <circle cx="60" cy="${ALTO - 60}" r="280" fill="#f3d9b5"/><circle cx="${ANCHO - 60}" cy="${ALTO - 70}" r="280" fill="#f3d9b5"/>
       </g>
       ${hojas(9, [{ x: 150, y: 130 }, { x: 130, y: 260 }, { x: ANCHO - 150, y: 130 }, { x: ANCHO - 130, y: 260 }, { x: 150, y: ALTO - 110 }, { x: ANCHO - 150, y: ALTO - 110 }, { x: PLIEGUE - 90, y: 160 }, { x: PLIEGUE + 90, y: 160 }])}
       ${grano("g", 0.05)}`,
      DEFS,
    ),

  armar: (a) => {
    const titulo = (tam: number, color = VERDE_OSC, extra = {}) => ({ familia: "Quicksand", tam, color, peso: 700, ...extra });
    const mano = (tam: number, color = VERDE_OSC, extra = {}) => ({ familia: "Patrick Hand", tam, color, ...extra });

    // Contratapa: la foto grupal y la seño.
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 160, 1300, 180), "Nuestra sala", titulo(130));
    a.forma(0, "marco_grupal", "Marco de la foto grupal", agrandar(GRUPAL, 28), { relleno: "#ffffff", radio: 60 });
    a.foto(0, "grupal", GRUPAL, { radio: 40 });
    a.forma(0, "aro_maestra", "Aro de la seño", agrandar(MAESTRA, 40), { relleno: VERDE, circulo: true });
    a.forma(0, "marco_maestra", "Marco de la seño", agrandar(MAESTRA, 24), { relleno: "#ffffff", circulo: true });
    a.foto(0, "maestra", MAESTRA, { mascara: "circle" });
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 940, y: 1560, w: 700, h: 170 }, "Nuestra seño", mano(120, ROSA, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Sala y jardín", { x: 940, y: 1740, w: 700, h: 260 }, "course.withSchool", "Sala - Jardín", mano(72, VERDE_OSC, { alinear: "LEFT", interlineado: 1.15 }));

    // Tapa: el retrato grande y los datos.
    a.forma(0, "aro_retrato", "Aro del retrato", agrandar(RETRATO, 56), { relleno: VERDE, circulo: true });
    a.forma(0, "marco_retrato", "Marco del retrato", agrandar(RETRATO, 34), { relleno: "#ffffff", circulo: true });
    a.foto(0, "individual", RETRATO, { mascara: "circle" });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1440, 1420, 210), "student.fullName", "Nombre del alumno", titulo(120, VERDE_OSC, { interlineado: 1.05 }));
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER, 1660, 1300, 140), "course.displayName", "Sala", mano(100, ROSA));
    a.variable(0, "colegio", "Jardín", centrado(CENTRO_DER, 1800, 1300, 120), "school.name", "Jardín", mano(70, MARRON));
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 1930, 600, 110), "2026", titulo(70, VERDE));

    // Interior: el mosaico sobre dos tarjetas salvia.
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 90, 1300, 170), "Mis amigos del bosque", titulo(108));
    a.variable(1, "sala", "Sala", centrado(CENTRO_DER, 90, 1300, 170), "course.displayName", "Sala", mano(110, ROSA));
    const y = 320;
    const alto = 1890;
    const tarjeta = { relleno: SALVIA, radio: 70, opacidad: 0.75 };
    a.forma(1, "tarjeta_1", "Tarjeta del mosaico 1", { x: 90, y: y - 30, w: PLIEGUE - 90 - 150, h: alto + 60 }, tarjeta);
    a.forma(1, "tarjeta_2", "Tarjeta del mosaico 2", { x: PLIEGUE + 150, y: y - 30, w: PLIEGUE - 90 - 150, h: alto + 60 }, tarjeta);
    mosaicoEnDosPaginas(a, y, alto, mano(56, VERDE_OSC), {
      frame: "circle",
      gapX: 46,
      gapY: 34,
      borderWidth: 18,
      borderColor: "#ffffff",
      shadow: { dx: 0, dy: 12, color: "#9fc392" },
      namePosition: "below",
      nameLines: 1,
      givenNames: "first",
    });
  },
};
