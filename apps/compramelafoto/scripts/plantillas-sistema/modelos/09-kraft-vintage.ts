import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, centrado, girarCon, type Rect } from "../lienzo";
import { svg } from "../texturas";
import type { Modelo } from "./tipo";

/** Kraft · Vintage: papel madera, sellos postales, hilo y fotos tipo polaroid. Informal. */

const TINTA = "#3b2a1a";
const CREMA = "#fbf4e4";
const ROJO = "#a63d2f";

const FOTO_IND = centrado(CENTRO_IZQ, 300, 1000, 1180);
const FOTO_GRU = centrado(CENTRO_DER, 380, 1300, 866);
/** Polaroid: borde parejo arriba y a los costados, ancho abajo para escribir. */
const polaroid = (r: Rect, borde: number, pie: number): Rect => ({ x: r.x - borde, y: r.y - borde, w: r.w + 2 * borde, h: r.h + borde + pie });
const POL_IND = polaroid(FOTO_IND, 50, 330);
const POL_GRU = polaroid(FOTO_GRU, 45, 250);
const GIRO_IND = -3;
const GIRO_GRU = 2;
const ETIQUETA = centrado(CENTRO_DER, 980, 1300, 760);

const DEFS = `
  <filter id="fibras" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="0.015 0.4" numOctaves="3" seed="14"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0 0.05  0 0 0 1.5 -0.55"/>
  </filter>
  <filter id="motas" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0 0.05  0 0 0 -3 1.9"/>
  </filter>
  <filter id="tinta" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="9" result="t"/>
    <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 1.5" result="h"/>
    <feComposite in="SourceGraphic" in2="h" operator="in"/>
  </filter>
  <radialGradient id="vineta" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3b2410" stop-opacity="0.35"/></radialGradient>`;

function kraft() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="#bf9364"/>
    <rect width="${ANCHO}" height="${ALTO}" filter="url(#fibras)" opacity="0.6"/>
    <rect width="${ANCHO}" height="${ALTO}" filter="url(#motas)" opacity="0.35"/>
    <rect width="${PLIEGUE}" height="${ALTO}" fill="url(#vineta)"/><rect x="${PLIEGUE}" width="${PLIEGUE}" height="${ALTO}" fill="url(#vineta)"/>`;
}

/** Matasellos: dos anillos y líneas onduladas. */
function matasellos(cx: number, cy: number, r: number, color: string) {
  let ondas = "";
  for (let i = 0; i < 5; i++) {
    const y = cy - 80 + i * 40;
    ondas += `<path d="M ${cx + r * 0.9} ${y} q 70 -30 140 0 t 140 0 t 140 0 t 140 0"/>`;
  }
  return `<g stroke="${color}" fill="none" filter="url(#tinta)" opacity="0.7">
    <circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="10"/><circle cx="${cx}" cy="${cy}" r="${r * 0.78}" stroke-width="5" stroke-dasharray="16 12"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.3}" stroke-width="6"/><g stroke-width="7">${ondas}</g></g>`;
}

/** Estampilla con borde dentado. */
function estampilla(x: number, y: number, w: number, h: number, giro: number, color: string) {
  let dientes = "";
  const paso = 34;
  for (let i = paso / 2; i < w; i += paso) dientes += `<circle cx="${x + i}" cy="${y}" r="10"/><circle cx="${x + i}" cy="${y + h}" r="10"/>`;
  for (let i = paso / 2; i < h; i += paso) dientes += `<circle cx="${x}" cy="${y + i}" r="10"/><circle cx="${x + w}" cy="${y + i}" r="10"/>`;
  return `<g transform="rotate(${giro} ${x + w / 2} ${y + h / 2})">
    <mask id="d${x}"><rect x="${x - 20}" y="${y - 20}" width="${w + 40}" height="${h + 40}" fill="#fff"/><g fill="#000">${dientes}</g></mask>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${CREMA}" mask="url(#d${x})"/>
    <rect x="${x + 30}" y="${y + 30}" width="${w - 60}" height="${h - 60}" fill="${color}" opacity="0.85"/>
    <circle cx="${x + w / 2}" cy="${y + h * 0.45}" r="${w * 0.2}" fill="${CREMA}" opacity="0.8"/>
    <path d="M ${x + 30} ${y + h - 30} L ${x + w * 0.4} ${y + h * 0.55} L ${x + w * 0.6} ${y + h * 0.7} L ${x + w - 30} ${y + h * 0.5} L ${x + w - 30} ${y + h - 30} Z" fill="${CREMA}" opacity="0.5"/>
  </g>`;
}

function hilo(x0: number, x1: number, y: number) {
  return `<path d="M ${x0} ${y} Q ${(x0 + x1) / 2} ${y + 90} ${x1} ${y}" stroke="#e8dcc2" stroke-width="8" fill="none"/><path d="M ${x0} ${y + 4} Q ${(x0 + x1) / 2} ${y + 94} ${x1} ${y + 4}" stroke="#9b8662" stroke-width="3" fill="none" stroke-dasharray="10 8"/>`;
}

function washi(cx: number, cy: number, giro: number, color: string) {
  return `<g transform="rotate(${giro} ${cx} ${cy})"><rect x="${cx - 160}" y="${cy - 42}" width="320" height="84" fill="${color}" opacity="0.8"/>
    <path d="M ${cx - 160} ${cy - 42} l -10 14 l 10 14 l -10 14 l 10 14 l -10 14 l 10 14 M ${cx + 160} ${cy - 42} l 10 14 l -10 14 l 10 14 l -10 14 l 10 14 l -10 14" stroke="${color}" stroke-width="3" fill="none" opacity="0.8"/></g>`;
}

export const kraftVintage: Modelo = {
  slug: "kraft-vintage",
  nombre: "Librito Kraft · Vintage",
  descripcion:
    "Librito 30×20 cm (2 páginas) informal: papel madera, sellos postales, hilo y fotos tipo polaroid con letra manuscrita. Sirve para cualquier nivel. Fotos en el interior; listado del curso en la contratapa.",
  categoria: "Informal",

  fondoExterior: () =>
    svg(
      `${kraft()}
       ${matasellos(2150, 330, 150, TINTA)}
       ${estampilla(3250, 100, 170, 210, 6, ROJO)}
       ${hilo(1830, 3540, 1560)}
       ${estampilla(2050, 1840, 200, 250, -8, "#4f7a6a")}
       ${matasellos(3150, 2000, 130, ROJO)}
       ${washi(ETIQUETA.x + 80, ETIQUETA.y + 10, -20, "#e8b4a0")}${washi(ETIQUETA.x + ETIQUETA.w - 80, ETIQUETA.y + ETIQUETA.h - 10, -20, "#a9c7b8")}
       ${matasellos(1350, 2120, 110, TINTA)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${kraft()}
       ${hilo(-20, 1790, 150)}${hilo(1750, 3560, 150)}
       ${washi(POL_IND.x + POL_IND.w / 2, POL_IND.y - 10, -4, "#e8b4a0")}
       ${washi(POL_GRU.x + 120, POL_GRU.y + 10, -35, "#a9c7b8")}${washi(POL_GRU.x + POL_GRU.w - 120, POL_GRU.y + 10, 35, "#a9c7b8")}
       ${estampilla(250, 1950, 160, 200, -10, ROJO)}
       ${matasellos(3100, 2130, 110, TINTA)}`,
      DEFS,
    ),

  armar: (a) => {
    // Contratapa
    a.forma(0, "papel", "Papel del listado", { x: 230, y: 240, w: PLIEGUE - 460, h: 1860 }, { relleno: CREMA, opacidad: 0.95 });
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 300, 1200, 220), "Mis compañeros", { familia: "Caveat", tam: 170, color: TINTA, peso: 700 });
    a.forma(0, "raya", "Raya", centrado(CENTRO_IZQ, 540, 500, 6), { relleno: ROJO });
    a.listado(0, { x: 330, y: 620, w: PLIEGUE - 660, h: 1420 }, { familia: "Caveat", tam: 82, color: TINTA, interlineado: 1.2 });

    // Tapa
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 330, 1300, 300), "Recuerdos", { familia: "Caveat", tam: 260, color: TINTA, peso: 700 }, -3);
    a.forma(0, "etiqueta", "Etiqueta", ETIQUETA, { relleno: CREMA, borde: TINTA, grosor: 5 });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, ETIQUETA.y + 70, 1100, 110), "— 2026 —", { familia: "Oswald", tam: 80, color: ROJO, peso: 700 });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, ETIQUETA.y + 220, 1150, 300), "school.name", "Nombre del colegio", {
      familia: "Oswald", tam: 100, color: TINTA, peso: 700, mayus: "uppercase", interlineado: 1.15,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, ETIQUETA.y + 560, 1150, 150), "course.displayName", "Curso", {
      familia: "Caveat", tam: 110, color: TINTA,
    });

    // Interior izquierda: polaroid
    a.forma(1, "polaroid_individual", "Polaroid individual", POL_IND, { relleno: CREMA, giro: GIRO_IND });
    a.foto(1, "individual", girarCon(FOTO_IND, POL_IND, GIRO_IND), { giro: GIRO_IND });
    a.variable(1, "alumno", "Nombre del alumno", girarCon({ x: POL_IND.x + 40, y: FOTO_IND.y + FOTO_IND.h + 50, w: POL_IND.w - 80, h: 220 }, POL_IND, GIRO_IND), "student.fullName", "Nombre del alumno", {
      familia: "Caveat", tam: 140, color: TINTA, peso: 700,
    }, GIRO_IND);

    // Interior derecha
    a.forma(1, "polaroid_grupal", "Polaroid grupal", POL_GRU, { relleno: CREMA, giro: GIRO_GRU });
    a.foto(1, "grupal", girarCon(FOTO_GRU, POL_GRU, GIRO_GRU), { giro: GIRO_GRU });
    a.texto(1, "pie_grupal", "Pie de la grupal", girarCon({ x: POL_GRU.x + 40, y: FOTO_GRU.y + FOTO_GRU.h + 45, w: POL_GRU.w - 80, h: 170 }, POL_GRU, GIRO_GRU), "Mi curso", {
      familia: "Caveat", tam: 130, color: TINTA, peso: 700,
    }, GIRO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1640, 1350, 220), "course.withSchool", "Curso - Colegio", {
      familia: "Oswald", tam: 72, color: TINTA, mayus: "uppercase", interlineado: 1.25,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1900, 1300, 160), "Lo que vivimos juntos, para siempre", {
      familia: "Caveat", tam: 96, color: CREMA, peso: 700,
    });
  },
};
