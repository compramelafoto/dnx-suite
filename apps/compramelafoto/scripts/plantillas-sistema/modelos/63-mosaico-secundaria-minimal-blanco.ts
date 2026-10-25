import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, centrado } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import { ANCHO_MOSAICO, DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Minimal blanco: papel blanco, grises y mucho aire, con tipografía fina.
 * Tapa con el retrato grande y el nombre en letra liviana; adentro, el mosaico recto, sin bordes y
 * con poca separación, como un anuario de diseño.
 */

const PAPEL = "#fbfbf9";
const TINTA = "#2b2b2b";
const GRIS = "#8c8c8a";
const LINEA = "#d9d9d5";

const RETRATO = centrado(CENTRO_DER, 330, 960, 1200);
const GRUPAL = centrado(CENTRO_IZQ, 400, 1320, 880);
const TUTOR = { x: GRUPAL.x, y: 1440, w: 440, h: 560 };
const X_MOSAICO_IZQ = 129;
const X_MOSAICO_DER = ANCHO - 129 - ANCHO_MOSAICO;

const linea = (x1: number, x2: number, y: number, grosor = 3, color = LINEA) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="${grosor}"/>`;

export const mosaicoSecundariaMinimalBlanco: Modelo = {
  slug: "mosaico-secundaria-minimal-blanco",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Minimal blanco",
  descripcion: `Carpeta 30×20 cm para secundaria, minimalista: papel blanco, grises y letra fina, con mucho aire. El retrato grande del alumno en la tapa; la foto grupal y el tutor en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Secundaria",
  filtros: { estilo: "Minimalista", etiquetas: ["mosaico", "compañeros", "minimalista", "blanco", "tutor"] },
  etiquetasDeFotos: { ...ETIQUETAS_MOSAICO, maestra: "Foto del tutor o la tutora" },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PAPEL}"/>${grano("g", 0.025)}
       ${linea(GRUPAL.x, GRUPAL.x + GRUPAL.w, 300)}
       ${linea(GRUPAL.x, GRUPAL.x + GRUPAL.w, 2150)}
       ${linea(RETRATO.x, RETRATO.x + RETRATO.w, 2150)}
       <rect x="${TUTOR.x + 24}" y="${TUTOR.y + 24}" width="${TUTOR.w}" height="${TUTOR.h}" fill="#ecece8"/>`,
      filtroGrano("g", 0.9),
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PAPEL}"/>${grano("g", 0.025)}
       ${linea(X_MOSAICO_IZQ, X_MOSAICO_IZQ + ANCHO_MOSAICO, 330)}
       ${linea(X_MOSAICO_DER, X_MOSAICO_DER + ANCHO_MOSAICO, 330)}
       ${linea(X_MOSAICO_IZQ, X_MOSAICO_IZQ + 160, 2250, 3, GRIS)}
       ${linea(PLIEGUE * 2 - 129 - 160, PLIEGUE * 2 - 129, 2250, 3, GRIS)}`,
      filtroGrano("g", 0.9),
    ),

  armar: (a) => {
    const fina = (tam: number, color = TINTA, extra = {}) => ({ familia: "Raleway", tam, color, peso: 300, ...extra });
    const sans = (tam: number, color = GRIS, extra = {}) => ({ familia: "Montserrat", tam, color, peso: 500, mayus: "uppercase" as const, ...extra });

    // Contratapa: la foto grupal y el tutor.
    a.texto(0, "titulo_grupal", "Título de la contratapa", { x: GRUPAL.x, y: 170, w: 900, h: 110 }, "Nuestro curso", fina(84, TINTA, { alinear: "LEFT" }));
    a.texto(0, "anio_contratapa", "Año de la contratapa", { x: GRUPAL.x + GRUPAL.w - 600, y: 200, w: 600, h: 70 }, "2026", sans(44, GRIS, { alinear: "RIGHT" }));
    a.foto(0, "grupal", GRUPAL);
    a.foto(0, "maestra", TUTOR);
    a.texto(0, "titulo_maestra", "Título del tutor", { x: TUTOR.x + TUTOR.w + 110, y: 1560, w: 760, h: 110 }, "Nuestro tutor", fina(78, TINTA, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Curso y colegio", { x: TUTOR.x + TUTOR.w + 110, y: 1700, w: 760, h: 260 }, "course.withSchool", "Curso - Colegio", fina(48, GRIS, { alinear: "LEFT", interlineado: 1.35, peso: 400 }));

    // Tapa: el retrato grande y los datos.
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 180, 1100, 80), "Ciclo lectivo 2026", sans(42));
    a.foto(0, "individual", RETRATO);
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1610, 1450, 170), "student.fullName", "Nombre del alumno", fina(124, TINTA, { interlineado: 1.05 }));
    a.forma(0, "raya", "Raya", centrado(CENTRO_DER, 1810, 120, 4), { relleno: TINTA });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1860, 1300, 80), "course.displayName", "Curso", sans(46));
    a.variable(0, "colegio", "Colegio", centrado(CENTRO_DER, 1960, 1300, 150), "school.name", "Colegio", fina(50, TINTA, { peso: 400, interlineado: 1.25 }));

    // Interior: el mosaico en las dos páginas.
    a.texto(1, "titulo_mosaico", "Título del mosaico", { x: X_MOSAICO_IZQ, y: 150, w: 1200, h: 150 }, "Compañeros", fina(120, TINTA, { alinear: "LEFT" }));
    a.variable(1, "curso_mosaico", "Curso", { x: X_MOSAICO_DER, y: 215, w: ANCHO_MOSAICO, h: 80 }, "course.displayName", "Curso", sans(42, GRIS, { alinear: "RIGHT" }));
    mosaicoEnDosPaginas(a, 400, 1800, { familia: "Raleway", tam: 38, color: TINTA, peso: 500, interlineado: 1.1 }, {
      frame: "rect",
      photoAspect: 0.75,
      gapX: 18,
      gapY: 18,
      borderWidth: 0,
      namePosition: "below",
      nameLines: 2,
      givenNames: "all",
    });
  },
};
