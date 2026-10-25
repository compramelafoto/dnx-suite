import { ALTO, ANCHO, CENTRO_IZQ, PLIEGUE, centrado, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import { FECHA_FALLBACK, cruzLinea } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/** Primera Comunión · Moderna minimalista: blanco, una cruz de línea en verde salvia y mucho aire. */

const TINTA = "#2b2b2b";
const GRIS = "#5f5f5f";
const SALVIA = "#8ea486";
const ORO = "#c2a165";
const IZQ_TAPA = PLIEGUE + 250;

const FOTO_IND: Rect = centrado(CENTRO_IZQ, 230, 1180, 1530);
const FOTO_GRU: Rect = { x: PLIEGUE + 190, y: 230, w: 1400, h: 933 };
const FOTO_CAT: Rect = { x: PLIEGUE + 190, y: 1300, w: 560, h: 700 };
const TXT_X = FOTO_CAT.x + FOTO_CAT.w + 90;

function hoja() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="#fcfcfa"/>${grano("g", 0.03)}`;
}

export const comunionMinimalista: Modelo = {
  slug: "comunion-minimalista",
  nombre: "Librito Primera Comunión · Minimalista",
  descripcion:
    "Librito 30×20 cm (2 páginas) de Primera Comunión moderno y minimalista: fondo blanco, una cruz de línea fina en verde salvia, tipografía liviana y mucho aire. Listado de compañeros en la contratapa; foto individual, grupal y con la catequista en el interior.",
  serie: "religiosas",
  categoria: "Religioso",
  etiquetasDeFotos: { maestra: "Foto con la catequista" },
  filtros: {
    evento: "Primera Comunión",
    estilo: "Minimalista",
    orientacion: "vertical",
    etiquetas: ["cruz", "minimalista", "blanco", "verde salvia", "moderno", "unisex"],
  },

  fondoExterior: () =>
    svg(
      `${hoja()}
       ${cruzLinea(IZQ_TAPA + 90, 560, 330, 46, SALVIA, 5)}
       <line x1="${IZQ_TAPA}" y1="1520" x2="${IZQ_TAPA + 260}" y2="1520" stroke="${ORO}" stroke-width="4"/>
       <line x1="260" y1="560" x2="520" y2="560" stroke="${TINTA}" stroke-width="4"/>
       <circle cx="${PLIEGUE - 330}" cy="${ALTO - 330}" r="36" fill="${SALVIA}"/>`,
      filtroGrano("g", 0.9),
    ),

  fondoInterior: () =>
    svg(
      `${hoja()}
       ${cruzLinea(ANCHO - 330, ALTO - 360, 150, 22, SALVIA, 4)}
       <line x1="${TXT_X}" y1="${FOTO_CAT.y + 250}" x2="${TXT_X + 200}" y2="${FOTO_CAT.y + 250}" stroke="${ORO}" stroke-width="4"/>`,
      filtroGrano("g", 0.9),
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", { x: 260, y: 380, w: 1250, h: 150 }, "Compañeros", {
      familia: "Lora", tam: 100, color: TINTA, italica: true, alinear: "LEFT",
    });
    a.listado(0, { x: 260, y: 680, w: PLIEGUE - 520, h: 1300 }, { familia: "Raleway", tam: 54, color: GRIS, alinear: "LEFT", interlineado: 1.5 });
    a.variable(0, "colegio_contratapa", "Colegio o parroquia", { x: 260, y: 2030, w: 1100, h: 110 }, "school.name", "Colegio o parroquia", {
      familia: "Raleway", tam: 44, color: GRIS, alinear: "LEFT", mayus: "uppercase",
    });

    // Tapa
    a.texto(0, "titulo1", "Primera", { x: IZQ_TAPA, y: 1000, w: 1250, h: 210 }, "Primera", {
      familia: "Raleway", tam: 170, color: TINTA, alinear: "LEFT", interlineado: 1,
    });
    a.texto(0, "titulo2", "Comunión", { x: IZQ_TAPA, y: 1210, w: 1250, h: 230 }, "Comunión", {
      familia: "Raleway", tam: 170, color: TINTA, alinear: "LEFT", peso: 700, interlineado: 1,
    });
    a.variable(0, "alumno", "Nombre del alumno", { x: IZQ_TAPA, y: 1600, w: 1250, h: 130 }, "student.fullName", "Nombre del alumno", {
      familia: "Lora", tam: 84, color: TINTA, italica: true, alinear: "LEFT",
    });
    a.variable(0, "fecha", "Fecha", { x: IZQ_TAPA, y: 1740, w: 1250, h: 90 }, "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Raleway", tam: 52, color: GRIS, alinear: "LEFT",
    });
    a.variable(0, "colegio", "Colegio o parroquia", { x: IZQ_TAPA, y: 1960, w: 1250, h: 150 }, "school.name", "Colegio o parroquia", {
      familia: "Raleway", tam: 44, color: GRIS, alinear: "LEFT", mayus: "uppercase", interlineado: 1.3,
    });

    // Interior izquierda
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", { x: FOTO_IND.x, y: FOTO_IND.y + FOTO_IND.h + 70, w: FOTO_IND.w, h: 150 }, "student.fullName", "Nombre del alumno", {
      familia: "Raleway", tam: 92, color: TINTA, alinear: "LEFT",
    });
    a.variable(1, "curso", "Curso", { x: FOTO_IND.x, y: FOTO_IND.y + FOTO_IND.h + 220, w: FOTO_IND.w, h: 100 }, "course.displayName", "Curso", {
      familia: "Lora", tam: 58, color: GRIS, italica: true, alinear: "LEFT",
    });

    // Interior derecha
    a.foto(1, "grupal", FOTO_GRU);
    a.foto(1, "maestra", FOTO_CAT);
    a.texto(1, "titulo_catequista", "Con mi catequista", { x: TXT_X, y: FOTO_CAT.y + 60, w: 700, h: 140 }, "Con mi catequista", {
      familia: "Lora", tam: 72, color: TINTA, italica: true, alinear: "LEFT",
    });
    a.texto(1, "cita", "Cita bíblica", { x: TXT_X, y: FOTO_CAT.y + 330, w: 720, h: 220 }, "«Yo soy el pan de vida»", {
      familia: "Raleway", tam: 56, color: TINTA, alinear: "LEFT", interlineado: 1.3,
    });
    a.texto(1, "cita_ref", "Referencia de la cita", { x: TXT_X, y: FOTO_CAT.y + 520, w: 600, h: 80 }, "Jn 6, 35", {
      familia: "Raleway", tam: 42, color: GRIS, alinear: "LEFT",
    });
    a.variable(1, "fecha", "Fecha", { x: TXT_X, y: FOTO_CAT.y + 620, w: 700, h: 80 }, "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Raleway", tam: 42, color: SALVIA, alinear: "LEFT",
    });
  },
};
