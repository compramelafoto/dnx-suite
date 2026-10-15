import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import { FECHA_FALLBACK, degradadoLuz, degradadoOro, filete, llama, paloma, rayos } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/** Confirmación · Paloma y llamas: el Espíritu Santo como paloma dorada entre rayos y siete llamas. */

const ORO_PLANO = "#c39c4e";
const ORO_TXT = "#8e6b28";
const ROJO = "#b9574a";
const LLAMA_INT = "#f2c46d";
const TEXTO = "#3d3226";

const FOTO_IND: Rect = centrado(CENTRO_IZQ, 300, 1000, 1330);
const FOTO_GRU: Rect = centrado(CENTRO_DER, 300, 1320, 880);
const FOTO_CAT: Rect = { x: 1990, y: 1360, w: 600, h: 600 };
const TXT_X = FOTO_CAT.x + FOTO_CAT.w + 80;

const DEFS = `${degradadoOro("oro")}${degradadoLuz("luz", "#fde9b8", 0.85)}${filtroGrano("g", 0.8, 2, 15)}`;

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="#fdfbf6"/>${grano("g", 0.04)}`;
}

/** Doble filete: dorado por fuera, rojo fino por dentro. */
function orla(x0: number) {
  const m = 110;
  return `<rect x="${x0 + m}" y="${m}" width="${PLIEGUE - 2 * m}" height="${ALTO - 2 * m}" fill="none" stroke="url(#oro)" stroke-width="10"/>
    <rect x="${x0 + m + 24}" y="${m + 24}" width="${PLIEGUE - 2 * m - 48}" height="${ALTO - 2 * m - 48}" fill="none" stroke="${ROJO}" stroke-width="2.5" opacity="0.7"/>`;
}

/** Las siete llamas en arco. */
function llamas(cx: number, cy: number, r: number, h: number) {
  let out = "";
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    out += llama(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.55, h, i % 2 ? ROJO : "#d9853f", LLAMA_INT);
  }
  return out;
}

function marco(r: Rect) {
  const p = agrandar(r, 40);
  const f = agrandar(r, 12);
  return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#ffffff" stroke="${ORO_PLANO}" stroke-width="3"/><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="url(#oro)"/>`;
}

export const confirmacionPalomaLlamas: Modelo = {
  slug: "confirmacion-paloma-llamas",
  nombre: "Librito Confirmación · Paloma y llamas",
  descripcion:
    "Librito 30×20 cm (2 páginas) de Confirmación, formal en blanco y dorado: la paloma del Espíritu Santo entre rayos de luz y siete llamas, orla dorada con filete rojo. Logo del colegio y listado de compañeros en la contratapa; foto individual, grupal y con la catequista en el interior.",
  serie: "religiosas",
  categoria: "Religioso",
  etiquetasDeFotos: { maestra: "Foto con la catequista" },
  filtros: {
    evento: "Confirmación",
    estilo: "Formal",
    orientacion: "vertical",
    etiquetas: ["paloma", "Espíritu Santo", "llamas", "rayos de luz", "dorado", "blanco"],
  },

  fondoExterior: () =>
    svg(
      `${papel()}${orla(0)}${orla(PLIEGUE)}
       <circle cx="${CENTRO_DER}" cy="620" r="560" fill="url(#luz)"/>
       ${rayos(CENTRO_DER, 620, 160, 500, 64, ORO_PLANO, 0.45, 0.03)}
       ${paloma(CENTRO_DER, 600, 600, "#ffffff", { giro: 18, linea: ORO_PLANO })}
       ${llamas(CENTRO_DER, 1000, 420, 120)}
       ${filete(CENTRO_DER, 1640, 520, ORO_PLANO)}
       ${filete(CENTRO_IZQ, 860, 620, ORO_PLANO)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${papel()}${orla(0)}${orla(PLIEGUE)}${marco(FOTO_IND)}${marco(FOTO_GRU)}${marco(FOTO_CAT)}
       ${paloma(TXT_X + 560, 2040, 170, ORO_PLANO, { giro: 12 })}`,
      DEFS,
    ),

  armar: (a) => {
    // Contratapa
    a.logo(0, "logo", centrado(CENTRO_IZQ, 240, 340, 340));
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 620, 1350, 200), "Compañeros de Confirmación", {
      familia: "Great Vibes", tam: 116, color: ORO_TXT,
    });
    a.listado(0, { x: 270, y: 940, w: PLIEGUE - 540, h: 1080 }, { familia: "Libre Baskerville", tam: 46, color: TEXTO, interlineado: 1.5 });
    a.variable(0, "curso", "Curso", centrado(CENTRO_IZQ, 2070, 1250, 90), "course.displayName", "Curso", {
      familia: "Libre Baskerville", tam: 46, color: ORO_TXT, italica: true,
    });

    // Tapa
    a.texto(0, "titulo", "Título de tapa", centrado(CENTRO_DER, 1170, 1350, 280), "Mi Confirmación", {
      familia: "Great Vibes", tam: 200, color: ORO_TXT,
    });
    a.texto(0, "lema", "Lema", centrado(CENTRO_DER, 1450, 1300, 110), "«Ven, Espíritu Santo»", {
      familia: "Playfair Display", tam: 66, color: ROJO, italica: true,
    });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1690, 1400, 140), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 90, color: TEXTO,
    });
    a.variable(0, "fecha", "Fecha", centrado(CENTRO_DER, 1840, 1000, 90), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Libre Baskerville", tam: 50, color: ORO_TXT, italica: true,
    });
    a.variable(0, "colegio", "Colegio o parroquia", centrado(CENTRO_DER, 1980, 1300, 150), "school.name", "Colegio o parroquia", {
      familia: "Libre Baskerville", tam: 44, color: TEXTO, mayus: "uppercase", interlineado: 1.3,
    });

    // Interior izquierda
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1730, 1400, 210), "student.fullName", "Nombre del alumno", {
      familia: "Great Vibes", tam: 136, color: ORO_TXT,
    });
    a.texto(1, "formula", "Fórmula de la Confirmación", centrado(CENTRO_IZQ, 1950, 1300, 130), "«Recibe por esta señal el don del Espíritu Santo»", {
      familia: "Playfair Display", tam: 46, color: TEXTO, italica: true, interlineado: 1.3,
    });

    // Interior derecha
    a.foto(1, "grupal", FOTO_GRU);
    a.foto(1, "maestra", FOTO_CAT);
    a.texto(1, "titulo_catequista", "Con mi catequista", { x: TXT_X, y: 1400, w: 760, h: 150 }, "Con mi catequista", {
      familia: "Great Vibes", tam: 100, color: ORO_TXT, alinear: "LEFT",
    });
    a.variable(1, "curso_colegio", "Curso y colegio", { x: TXT_X, y: 1580, w: 760, h: 230 }, "course.withSchool", "Curso - Colegio", {
      familia: "Libre Baskerville", tam: 46, color: TEXTO, alinear: "LEFT", interlineado: 1.35,
    });
    a.variable(1, "fecha", "Fecha", { x: TXT_X, y: 1830, w: 500, h: 80 }, "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Libre Baskerville", tam: 44, color: ORO_TXT, italica: true, alinear: "LEFT",
    });
  },
};
