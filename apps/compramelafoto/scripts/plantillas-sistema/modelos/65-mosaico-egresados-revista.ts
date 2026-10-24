import { ALTO, ANCHO, PLIEGUE } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import { ANCHO_MOSAICO, DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Revista: la tapa es una portada de revista (el retrato a sangre, la
 * cabecera enorme y los titulares); la contratapa, la foto de la promoción a sangre con su
 * bajada. Adentro, el mosaico pegado, sin separación, con el nombre sobre la foto en cinta oscura.
 */

const NEGRO = "#111111";
const ROJO = "#e63946";
const PAPEL = "#f5f2ec";
const BLANCO = "#ffffff";

const IZQ_TAPA = PLIEGUE + 190;
const ANCHO_TAPA = PLIEGUE - 190 - 130;
const X_MOSAICO_IZQ = 129;
const X_MOSAICO_DER = ANCHO - 129 - ANCHO_MOSAICO;
const ALTO_GRUPAL = 1240;
const TUTOR = { x: PLIEGUE - 180 - 400, y: 1430, w: 400, h: 500 };

/** Código de barras decorativo (sin números reales). */
function codigoDeBarras(x: number, y: number) {
  let out = `<rect x="${x - 20}" y="${y - 20}" width="300" height="190" fill="${BLANCO}"/>`;
  const anchos = [4, 2, 6, 2, 3, 8, 2, 4, 2, 6, 3, 2, 7, 2, 4, 3, 2, 6, 2, 4, 8, 2, 3, 5, 2, 4];
  let cx = x;
  anchos.forEach((w, i) => {
    if (i % 2 === 0) out += `<rect x="${cx}" y="${y}" width="${w}" height="120" fill="${NEGRO}"/>`;
    cx += w + 3;
  });
  return out;
}

export const mosaicoEgresadosRevista: Modelo = {
  slug: "mosaico-egresados-revista",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Revista",
  descripcion: `Carpeta 30×20 cm para egresados con forma de revista: el retrato del alumno a sangre en la tapa, con cabecera y titulares; la foto de la promoción a sangre y el tutor en la contratapa. Adentro, el mosaico pegado con el nombre sobre cada foto. ${DESCRIPCION_MOSAICO}`,
  categoria: "Egresados",
  filtros: { estilo: "Moderno", etiquetas: ["mosaico", "compañeros", "revista", "foto a sangre", "egresados"] },
  etiquetasDeFotos: { ...ETIQUETAS_MOSAICO, maestra: "Foto del tutor o la tutora" },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PAPEL}"/>
       <rect x="0" y="${ALTO_GRUPAL}" width="${PLIEGUE}" height="14" fill="${ROJO}"/>
       ${codigoDeBarras(190, 2060)}
       ${grano("g", 0.04)}`,
      filtroGrano("g", 0.9),
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PAPEL}"/>
       <rect x="${X_MOSAICO_IZQ}" y="150" width="22" height="150" fill="${ROJO}"/>
       <line x1="${X_MOSAICO_IZQ}" y1="340" x2="${X_MOSAICO_IZQ + ANCHO_MOSAICO}" y2="340" stroke="${NEGRO}" stroke-width="6"/>
       <line x1="${X_MOSAICO_DER}" y1="340" x2="${X_MOSAICO_DER + ANCHO_MOSAICO}" y2="340" stroke="${NEGRO}" stroke-width="6"/>
       ${grano("g", 0.04)}`,
      filtroGrano("g", 0.9),
    ),

  armar: (a) => {
    const anton = (tam: number, color = BLANCO, extra = {}) => ({ familia: "Anton", tam, color, alinear: "LEFT" as const, interlineado: 1, ...extra });
    const sans = (tam: number, color = BLANCO, extra = {}) => ({ familia: "Montserrat", tam, color, peso: 700, alinear: "LEFT" as const, ...extra });

    // Contratapa: la promoción a sangre, la bajada y el tutor.
    a.foto(0, "grupal", { x: 0, y: 0, w: PLIEGUE, h: ALTO_GRUPAL });
    a.texto(0, "titulo_grupal", "Título de la contratapa", { x: 190, y: 1360, w: 1000, h: 230 }, "LA PROMO", anton(210, NEGRO));
    a.variable(0, "curso_contratapa", "Curso y colegio", { x: 195, y: 1620, w: 960, h: 200 }, "course.withSchool", "Curso - Colegio", sans(52, NEGRO, { interlineado: 1.25 }));
    a.texto(0, "bajada", "Bajada", { x: 195, y: 1830, w: 960, h: 190 }, "Seis años, mil historias y una foto para siempre.", {
      familia: "Playfair Display", tam: 56, color: "#444444", italica: true, alinear: "LEFT", interlineado: 1.3,
    });
    a.forma(0, "marco_maestra", "Marco del tutor", { x: TUTOR.x - 14, y: TUTOR.y - 14, w: TUTOR.w + 28, h: TUTOR.h + 28 }, { relleno: BLANCO });
    a.foto(0, "maestra", TUTOR);
    a.forma(0, "cinta_maestra", "Cinta del tutor", { x: TUTOR.x - 14, y: TUTOR.y + TUTOR.h + 14, w: TUTOR.w + 28, h: 110 }, { relleno: ROJO });
    a.texto(0, "titulo_maestra", "Título del tutor", { x: TUTOR.x, y: TUTOR.y + TUTOR.h + 30, w: TUTOR.w, h: 80 }, "NUESTRO TUTOR", sans(44, BLANCO, { alinear: "CENTER" }));

    // Tapa: el retrato a sangre con la cabecera y los titulares.
    a.foto(0, "individual", { x: PLIEGUE, y: 0, w: PLIEGUE, h: ALTO });
    a.forma(0, "velo_cabecera", "Velo de la cabecera", { x: PLIEGUE, y: 0, w: PLIEGUE, h: 560 }, { relleno: NEGRO, opacidad: 0.35 });
    a.forma(0, "velo_titulares", "Velo de los titulares", { x: PLIEGUE, y: 1600, w: PLIEGUE, h: ALTO - 1600 }, { relleno: NEGRO, opacidad: 0.62 });
    a.texto(0, "cabecera", "Cabecera", { x: IZQ_TAPA - 10, y: 90, w: ANCHO_TAPA, h: 360 }, "EGRESADOS", anton(330));
    a.forma(0, "banda_edicion", "Banda de la edición", { x: IZQ_TAPA, y: 455, w: 760, h: 80 }, { relleno: ROJO });
    a.texto(0, "edicion", "Edición", { x: IZQ_TAPA + 24, y: 465, w: 740, h: 64 }, "EDICIÓN ESPECIAL · 2026", sans(48));
    a.texto(0, "titular_1", "Titular 1", { x: IZQ_TAPA, y: 1180, w: 440, h: 190 }, "LOS QUE HICIERON HISTORIA", anton(80, BLANCO, { interlineado: 1.05 }));
    a.forma(0, "raya_titular", "Raya del titular", { x: IZQ_TAPA, y: 1390, w: 120, h: 12 }, { relleno: ROJO });
    a.texto(0, "titular_2", "Titular 2", { x: IZQ_TAPA, y: 1420, w: 420, h: 150 }, "Todo lo que vivimos, en primera persona", sans(40, BLANCO, { peso: 600, interlineado: 1.25 }));
    a.texto(0, "exclusiva", "Exclusiva", { x: IZQ_TAPA, y: 1640, w: ANCHO_TAPA, h: 80 }, "EN EXCLUSIVA", sans(46, ROJO));
    a.variable(0, "alumno", "Nombre del alumno", { x: IZQ_TAPA, y: 1720, w: ANCHO_TAPA, h: 200 }, "student.fullName", "Nombre del alumno", anton(170));
    a.variable(0, "curso", "Curso", { x: IZQ_TAPA, y: 1945, w: ANCHO_TAPA, h: 90 }, "course.displayName", "Curso", sans(56, "#ffd5d8"));
    a.variable(0, "colegio", "Colegio", { x: IZQ_TAPA, y: 2045, w: ANCHO_TAPA, h: 160 }, "school.name", "Colegio", sans(48, BLANCO, { peso: 500, interlineado: 1.2 }));

    // Interior: «quiénes somos» y el mosaico pegado.
    a.texto(1, "titulo_mosaico", "Título del mosaico", { x: X_MOSAICO_IZQ + 60, y: 140, w: 1300, h: 180 }, "QUIÉNES SOMOS", anton(165, NEGRO));
    a.texto(1, "seccion", "Sección", { x: X_MOSAICO_DER, y: 240, w: ANCHO_MOSAICO, h: 70 }, "PROMOCIÓN 2026 · LA GENTE", sans(44, ROJO, { alinear: "RIGHT" }));
    a.texto(1, "folio_1", "Folio izquierdo", { x: X_MOSAICO_IZQ, y: 2225, w: 300, h: 60 }, "02", sans(36, NEGRO));
    a.texto(1, "folio_2", "Folio derecho", { x: X_MOSAICO_DER + ANCHO_MOSAICO - 300, y: 2225, w: 300, h: 60 }, "03", sans(36, NEGRO, { alinear: "RIGHT" }));
    mosaicoEnDosPaginas(a, 400, 1790, { familia: "Oswald", tam: 36, color: BLANCO, mayus: "uppercase", interlineado: 1.1 }, {
      frame: "rect",
      photoAspect: 0.66,
      gapX: 0,
      gapY: 0,
      borderWidth: 0,
      namePosition: "insideBottom",
      nameLines: 1,
      nameBackground: "#111111",
      givenNames: "all",
    });
  },
};
