import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import { FECHA_FALLBACK, acuarelas, olivo, paloma } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/** Primera Comunión · Acuarela con palomas: manchas suaves celeste y salvia, palomas en vuelo. */

const CELESTE = "#a9cbe3";
const SALVIA = "#b7cbb0";
const ORO = "#c8a45c";
const TEXTO = "#47607a";
const ORO_TXT = "#9c7a38";
const LINEA_PALOMA = "#9bb3c6";

const FOTO_LIBRE: Rect = centrado(CENTRO_IZQ, 300, 1150, 860);
const FOTO_IND: Rect = centrado(CENTRO_IZQ, 230, 1150, 1500);
const FOTO_GRU: Rect = centrado(CENTRO_DER, 230, 1420, 947);
const FOTO_CAT: Rect = { x: 1990, y: 1330, w: 640, h: 640 };

const DEFS_GRANO = filtroGrano("g", 0.8, 2, 4);

function hoja() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="#fdfcf8"/>`;
}

/** Borde blanco con sombra de acuarela detrás de una foto. */
function marco(r: Rect) {
  const b = agrandar(r, 26);
  return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="#ffffff" stroke="#dfe7ee" stroke-width="3"/>`;
}

export const comunionAcuarelaPalomas: Modelo = {
  slug: "comunion-acuarela-palomas",
  nombre: "Librito Primera Comunión · Acuarela y palomas",
  descripcion:
    "Librito 30×20 cm (2 páginas) de Primera Comunión en acuarela suave celeste y verde salvia, con palomas en vuelo y una ramita de olivo. Sin listado: cuatro fotos (individual, grupal, con la catequista y una foto libre del momento en la contratapa).",
  serie: "religiosas",
  categoria: "Religioso",
  etiquetasDeFotos: { maestra: "Foto con la catequista" },
  filtros: {
    evento: "Primera Comunión",
    estilo: "Clásico",
    orientacion: "vertical",
    etiquetas: ["acuarela", "palomas", "olivo", "celeste", "verde salvia", "suave"],
  },

  fondoExterior: () => {
    const m = acuarelas("ae", 21, [
      { x: 3400, y: 160, r: 420, color: CELESTE },
      { x: 3100, y: 60, r: 260, color: SALVIA, opacidad: 0.35 },
      { x: 1990, y: 2250, r: 380, color: SALVIA },
      { x: 2350, y: 2340, r: 240, color: CELESTE, opacidad: 0.35 },
      { x: 120, y: 2200, r: 360, color: CELESTE, opacidad: 0.35 },
      { x: 1600, y: 120, r: 260, color: SALVIA, opacidad: 0.35 },
    ]);
    return svg(
      `${hoja()}${m.out}${grano("g", 0.04)}
       ${paloma(CENTRO_DER - 160, 600, 460, "#ffffff", { linea: LINEA_PALOMA, giro: -8 })}
       ${paloma(CENTRO_DER + 330, 400, 260, "#ffffff", { linea: LINEA_PALOMA, giro: -14 })}
       ${paloma(CENTRO_DER + 400, 760, 180, "#ffffff", { linea: LINEA_PALOMA, giro: -4 })}
       ${olivo(CENTRO_DER - 380, 760, 230, 18, "#9fb49a")}
       <line x1="${CENTRO_DER - 160}" y1="1530" x2="${CENTRO_DER + 160}" y2="1530" stroke="${ORO}" stroke-width="3"/>
       ${marco(FOTO_LIBRE)}
       ${paloma(CENTRO_IZQ, 1830, 150, "#ffffff", { linea: LINEA_PALOMA, giro: -6 })}`,
      `${m.defs}${DEFS_GRANO}`,
    );
  },

  fondoInterior: () => {
    const m = acuarelas("ai", 34, [
      { x: 160, y: 140, r: 380, color: SALVIA, opacidad: 0.4 },
      { x: 1500, y: 2230, r: 420, color: CELESTE, opacidad: 0.4 },
      { x: 3380, y: 2200, r: 400, color: SALVIA, opacidad: 0.4 },
      { x: 3420, y: 180, r: 260, color: CELESTE, opacidad: 0.35 },
    ]);
    return svg(
      `${hoja()}${m.out}${grano("g", 0.04)}
       ${marco(FOTO_IND)}${marco(FOTO_GRU)}${marco(FOTO_CAT)}
       ${paloma(3220, 1420, 220, "#ffffff", { linea: LINEA_PALOMA, giro: -10 })}`,
      `${m.defs}${DEFS_GRANO}`,
    );
  },

  armar: (a) => {
    // Contratapa: la foto libre del momento.
    a.foto(0, "libre", FOTO_LIBRE, { radio: 8 });
    a.texto(0, "epigrafe", "Epígrafe de la foto libre", centrado(CENTRO_IZQ, 1220, 1300, 190), "Un momento para recordar", {
      familia: "Great Vibes", tam: 120, color: ORO_TXT,
    });
    a.texto(0, "cita", "Cita bíblica", centrado(CENTRO_IZQ, 1470, 1300, 120), "«Yo soy el pan de vida»", {
      familia: "Lora", tam: 66, color: TEXTO, italica: true,
    });
    a.texto(0, "cita_ref", "Referencia de la cita", centrado(CENTRO_IZQ, 1590, 500, 80), "Jn 6, 35", {
      familia: "Lora", tam: 44, color: ORO_TXT,
    });
    a.variable(0, "colegio_contratapa", "Colegio o parroquia", centrado(CENTRO_IZQ, 1990, 1250, 160), "school.name", "Colegio o parroquia", {
      familia: "Raleway", tam: 46, color: TEXTO, mayus: "uppercase", interlineado: 1.3,
    });

    // Tapa
    a.texto(0, "pretitulo", "Recuerdo de mi", centrado(CENTRO_DER, 960, 1200, 110), "Recuerdo de mi", {
      familia: "Lora", tam: 72, color: TEXTO, italica: true,
    });
    a.texto(0, "titulo", "Título de tapa", centrado(CENTRO_DER, 1070, 1400, 300), "Primera Comunión", {
      familia: "Great Vibes", tam: 215, color: ORO_TXT,
    });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1600, 1400, 140), "student.fullName", "Nombre del alumno", {
      familia: "Lora", tam: 92, color: TEXTO,
    });
    a.variable(0, "fecha", "Fecha", centrado(CENTRO_DER, 1750, 1000, 100), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Raleway", tam: 54, color: ORO_TXT,
    });
    a.variable(0, "colegio", "Colegio o parroquia", centrado(CENTRO_DER, 1930, 1250, 160), "school.name", "Colegio o parroquia", {
      familia: "Raleway", tam: 46, color: TEXTO, mayus: "uppercase", interlineado: 1.3,
    });

    // Interior izquierda
    a.foto(1, "individual", FOTO_IND, { radio: 8 });
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1810, 1400, 220), "student.fullName", "Nombre del alumno", {
      familia: "Great Vibes", tam: 140, color: ORO_TXT,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 2040, 1200, 90), "course.displayName", "Curso", {
      familia: "Raleway", tam: 48, color: TEXTO, mayus: "uppercase",
    });

    // Interior derecha
    a.foto(1, "grupal", FOTO_GRU, { radio: 8 });
    a.foto(1, "maestra", FOTO_CAT, { radio: 8 });
    a.texto(1, "titulo_catequista", "Con mi catequista", { x: 2720, y: 1560, w: 740, h: 160 }, "Con mi catequista", {
      familia: "Great Vibes", tam: 104, color: ORO_TXT, alinear: "LEFT",
    });
    a.texto(1, "gracias", "Agradecimiento", { x: 2720, y: 1730, w: 740, h: 230 }, "Gracias por acompañarme en este camino.", {
      familia: "Lora", tam: 52, color: TEXTO, italica: true, alinear: "LEFT", interlineado: 1.35,
    });
    a.variable(1, "curso_colegio", "Curso y colegio", { x: 1990, y: 2060, w: 1470, h: 90 }, "course.withSchool", "Curso - Colegio", {
      familia: "Raleway", tam: 44, color: TEXTO, alinear: "LEFT",
    });
  },
};
