import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import { FECHA_FALLBACK, caliz, manojoEspigas, racimo, rayos } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/** Primera Comunión · Celeste con espigas y uvas (nene o unisex): bloques de color, trazo moderno. */

const CELESTE = "#9cc0dc";
const CELESTE_CLARO = "#e6f0f7";
const AZUL = "#2f4f6f";
const ORO = "#c6a25a";
const BLANCO = "#ffffff";
const BANDA_TAPA = 1300;

const FOTO_LIBRE: Rect = centrado(CENTRO_IZQ, 260, 1200, 900);
const FOTO_IND: Rect = centrado(CENTRO_IZQ, 200, 1250, 1450);
const FOTO_GRU: Rect = centrado(CENTRO_DER, 200, 1420, 947);
const FOTO_CAT: Rect = { x: 1960, y: 1290, w: 640, h: 640 };
const TXT_X = FOTO_CAT.x + FOTO_CAT.w + 80;

function hoja() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${BLANCO}"/>`;
}

function filete(r: Rect, color: string) {
  const b = agrandar(r, 22);
  return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${color}" stroke-width="5"/>`;
}

export const comunionCelesteEspigas: Modelo = {
  slug: "comunion-celeste-espigas",
  nombre: "Librito Primera Comunión · Celeste con espigas",
  descripcion:
    "Librito 30×20 cm (2 páginas) de Primera Comunión moderno, para nenes o unisex: bloques celestes, cáliz con la hostia, espigas de trigo y racimo de uvas en blanco y dorado. Sin listado; logo del colegio en la contratapa y cuatro fotos (individual, grupal, con la catequista y una foto libre).",
  serie: "religiosas",
  categoria: "Religioso",
  etiquetasDeFotos: { maestra: "Foto con la catequista" },
  filtros: {
    evento: "Primera Comunión",
    estilo: "Moderno",
    orientacion: "vertical",
    etiquetas: ["nene", "unisex", "celeste", "espigas", "uvas", "cáliz", "hostia"],
  },

  fondoExterior: () =>
    svg(
      `${hoja()}
       <rect x="${PLIEGUE}" y="0" width="${PLIEGUE}" height="${BANDA_TAPA}" fill="${CELESTE}"/>
       <rect x="${PLIEGUE}" y="${BANDA_TAPA}" width="${PLIEGUE}" height="14" fill="${ORO}"/>
       ${rayos(CENTRO_DER, 520, 120, 420, 40, BLANCO, 0.35, 0.03)}
       ${manojoEspigas(CENTRO_DER - 300, 1150, 360, BLANCO, -28)}
       ${racimo(CENTRO_DER + 330, 830, 260, "#e9f2f9", "#ffffff")}
       ${caliz(CENTRO_DER, 640, 300, BLANCO, { colorHostia: "#fffaf0", linea: "#7aa5c8" })}
       <rect x="0" y="${ALTO - 520}" width="${PLIEGUE}" height="520" fill="${CELESTE_CLARO}"/>
       ${filete(FOTO_LIBRE, CELESTE)}`,
      filtroGrano("g", 0.9),
    ),

  fondoInterior: () =>
    svg(
      `${hoja()}
       <rect x="0" y="${ALTO - 420}" width="${PLIEGUE}" height="420" fill="${CELESTE_CLARO}"/>
       <rect x="${PLIEGUE}" y="${ALTO - 300}" width="${PLIEGUE}" height="300" fill="${CELESTE_CLARO}"/>
       ${filete(FOTO_IND, CELESTE)}${filete(FOTO_GRU, CELESTE)}${filete(FOTO_CAT, ORO)}
       ${manojoEspigas(ANCHO - 260, ALTO - 110, 200, ORO, 20)}
       ${grano("g", 0.02)}`,
      filtroGrano("g", 0.9),
    ),

  armar: (a) => {
    // Contratapa
    a.foto(0, "libre", FOTO_LIBRE);
    a.texto(0, "cita", "Cita bíblica", centrado(CENTRO_IZQ, 1290, 1300, 120), "«Yo soy el pan de vida»", {
      familia: "Playfair Display", tam: 74, color: AZUL, italica: true,
    });
    a.texto(0, "cita_ref", "Referencia de la cita", centrado(CENTRO_IZQ, 1410, 500, 80), "Jn 6, 35", {
      familia: "Montserrat", tam: 42, color: ORO,
    });
    a.logo(0, "logo", centrado(CENTRO_IZQ, ALTO - 470, 260, 260));
    a.variable(0, "colegio_contratapa", "Colegio o parroquia", centrado(CENTRO_IZQ, ALTO - 190, 1300, 90), "school.name", "Colegio o parroquia", {
      familia: "Montserrat", tam: 42, color: AZUL, mayus: "uppercase",
    });

    // Tapa
    a.texto(0, "titulo", "Título de tapa", centrado(CENTRO_DER, 1450, 1450, 160), "Primera Comunión", {
      familia: "Montserrat", tam: 112, color: AZUL, peso: 700, mayus: "uppercase",
    });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1650, 1400, 150), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 96, color: AZUL, italica: true,
    });
    a.variable(0, "fecha", "Fecha", centrado(CENTRO_DER, 1840, 1000, 90), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Montserrat", tam: 52, color: ORO,
    });
    a.variable(0, "colegio", "Colegio o parroquia", centrado(CENTRO_DER, 2010, 1300, 150), "school.name", "Colegio o parroquia", {
      familia: "Montserrat", tam: 42, color: AZUL, mayus: "uppercase", interlineado: 1.3,
    });

    // Interior izquierda
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1790, 1400, 130), "student.fullName", "Nombre del alumno", {
      familia: "Montserrat", tam: 76, color: AZUL, peso: 700, mayus: "uppercase",
    });
    a.texto(1, "recuerdo", "Recuerdo", centrado(CENTRO_IZQ, 1940, 1400, 100), "Recuerdo de mi Primera Comunión", {
      familia: "Playfair Display", tam: 60, color: AZUL, italica: true,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 2080, 1200, 80), "course.displayName", "Curso", {
      familia: "Montserrat", tam: 42, color: ORO,
    });

    // Interior derecha
    a.foto(1, "grupal", FOTO_GRU);
    a.foto(1, "maestra", FOTO_CAT);
    a.texto(1, "titulo_catequista", "Con mi catequista", { x: TXT_X, y: 1330, w: 780, h: 100 }, "Con mi catequista", {
      familia: "Montserrat", tam: 54, color: AZUL, peso: 700, mayus: "uppercase", alinear: "LEFT",
    });
    a.texto(1, "cita", "Cita bíblica", { x: TXT_X, y: 1470, w: 780, h: 230 }, "«Dejen que los niños vengan a mí»", {
      familia: "Playfair Display", tam: 60, color: AZUL, italica: true, alinear: "LEFT", interlineado: 1.3,
    });
    a.texto(1, "cita_ref", "Referencia de la cita", { x: TXT_X, y: 1710, w: 400, h: 80 }, "Mc 10, 14", {
      familia: "Montserrat", tam: 40, color: ORO, alinear: "LEFT",
    });
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER - 80, ALTO - 200, 1300, 90), "course.withSchool", "Curso - Colegio", {
      familia: "Montserrat", tam: 40, color: AZUL,
    });
  },
};
