import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import { FECHA_FALLBACK, ojivaPath, paloma, rayos, vitral } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/** Confirmación · Vitral: fondo azul pizarra, un vitral ojival de vidrios suaves con la paloma. */

const PIZARRA = "#26394b";
const MARFIL = "#f6f1e3";
const ORO = "#d1b071";
const AZUL_TXT = "#26394b";
const GRIS = "#6b7682";
const VIDRIOS = ["#bcd7ea", "#9fc4df", "#cfe0c8", "#b3cba8", "#f2e3b3", "#e9d6a0", "#fbf8ef"] as const;

const VENTANA: Rect = centrado(CENTRO_DER, 210, 860, 1120);
const FOTO_AMI: Rect = centrado(CENTRO_IZQ, 300, 1150, 860);
const FOTO_IND: Rect = centrado(CENTRO_IZQ, 230, 1150, 1480);
const FOTO_GRU: Rect = centrado(CENTRO_DER, 230, 1400, 933);
const FOTO_CAT: Rect = { x: 1990, y: 1330, w: 600, h: 600 };
const TXT_X = FOTO_CAT.x + FOTO_CAT.w + 80;

const DEFS_GRANO = filtroGrano("g", 0.8, 2, 18);

function marcoOro(r: Rect, d = 18) {
  const b = agrandar(r, d);
  return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${ORO}" stroke-width="5"/>`;
}

/** Rosetón: vitral circular. */
function roseton(id: string, cx: number, cy: number, r: number, semilla: number) {
  const forma = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  return vitral(id, forma, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }, VIDRIOS, ORO, semilla, 70);
}

export const confirmacionVitral: Modelo = {
  slug: "confirmacion-vitral",
  nombre: "Librito Confirmación · Vitral",
  descripcion:
    "Librito 30×20 cm (2 páginas) de Confirmación moderno: tapa azul pizarra con un vitral ojival de vidrios celestes, verde salvia y dorados, y la paloma del Espíritu Santo. Sin listado: cuatro fotos (con amigos en la contratapa; individual, grupal y con la catequista en el interior, entre guardas de vitral).",
  serie: "religiosas",
  categoria: "Religioso",
  etiquetasDeFotos: { maestra: "Foto con la catequista" },
  filtros: {
    evento: "Confirmación",
    estilo: "Moderno",
    orientacion: "vertical",
    etiquetas: ["vitral", "paloma", "Espíritu Santo", "azul", "celeste", "verde salvia", "moderno"],
  },

  fondoExterior: () => {
    const v = vitral("vt", ojivaPath(VENTANA.x, VENTANA.y, VENTANA.w, VENTANA.h), VENTANA, VIDRIOS, ORO, 41, 120);
    const r = roseton("rs", CENTRO_IZQ, 1880, 190, 52);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PIZARRA}"/>${grano("g", 0.08, "screen")}
       ${rayos(CENTRO_DER, 760, 520, 760, 48, ORO, 0.22, 0.02)}
       ${v.out}
       <circle cx="${CENTRO_DER}" cy="${VENTANA.y + 560}" r="250" fill="#ffffff" opacity="0.35"/>
       ${paloma(CENTRO_DER, VENTANA.y + 560, 440, "#ffffff", { giro: 16, linea: "#c9b27a" })}
       ${marcoOro(FOTO_AMI)}
       ${r.out}`,
      `${v.defs}${r.defs}${DEFS_GRANO}`,
    );
  },

  fondoInterior: () => {
    const izq = vitral("vi", `M 0 0 H 170 V ${ALTO} H 0 Z`, { x: 0, y: 0, w: 170, h: ALTO }, VIDRIOS, ORO, 61, 90);
    const der = vitral("vd", `M ${ANCHO - 170} 0 H ${ANCHO} V ${ALTO} H ${ANCHO - 170} Z`, { x: ANCHO - 170, y: 0, w: 170, h: ALTO }, VIDRIOS, ORO, 67, 90);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${MARFIL}"/>${grano("g", 0.04)}
       ${izq.out}${der.out}
       ${marcoOro(FOTO_IND, 16)}${marcoOro(FOTO_GRU, 16)}${marcoOro(FOTO_CAT, 16)}
       <line x1="${TXT_X}" y1="${FOTO_CAT.y + 200}" x2="${TXT_X + 220}" y2="${FOTO_CAT.y + 200}" stroke="${ORO}" stroke-width="5"/>`,
      `${izq.defs}${der.defs}${DEFS_GRANO}`,
    );
  },

  armar: (a) => {
    // Contratapa
    a.foto(0, "amigos", FOTO_AMI);
    a.texto(0, "titulo_amigos", "Con mis amigos", centrado(CENTRO_IZQ, 1240, 1300, 150), "Con mis amigos", {
      familia: "Playfair Display", tam: 96, color: ORO, italica: true,
    });
    a.variable(0, "colegio_contratapa", "Colegio o parroquia", centrado(CENTRO_IZQ, 1420, 1300, 150), "school.name", "Colegio o parroquia", {
      familia: "Montserrat", tam: 44, color: MARFIL, mayus: "uppercase", interlineado: 1.3,
    });

    // Tapa
    a.texto(0, "titulo", "Título de tapa", centrado(CENTRO_DER, 1420, 1450, 170), "Confirmación", {
      familia: "Montserrat", tam: 132, color: MARFIL, peso: 700, mayus: "uppercase",
    });
    a.texto(0, "cita", "Cita bíblica", centrado(CENTRO_DER, 1610, 1400, 120), "«Recibirán la fuerza del Espíritu Santo»", {
      familia: "Playfair Display", tam: 60, color: ORO, italica: true,
    });
    a.texto(0, "cita_ref", "Referencia de la cita", centrado(CENTRO_DER, 1720, 500, 70), "Hch 1, 8", {
      familia: "Montserrat", tam: 40, color: ORO,
    });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1840, 1400, 130), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 84, color: "#ffffff",
    });
    a.variable(0, "colegio", "Colegio o parroquia", centrado(CENTRO_DER, 1990, 1400, 90), "school.name", "Colegio o parroquia", {
      familia: "Montserrat", tam: 40, color: MARFIL, mayus: "uppercase",
    });
    a.variable(0, "fecha", "Fecha", centrado(CENTRO_DER, 2090, 1000, 80), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Montserrat", tam: 42, color: ORO,
    });

    // Interior izquierda
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1800, 1400, 130), "student.fullName", "Nombre del alumno", {
      familia: "Montserrat", tam: 74, color: AZUL_TXT, peso: 700, mayus: "uppercase",
    });
    a.texto(1, "recuerdo", "Recuerdo", centrado(CENTRO_IZQ, 1950, 1400, 100), "Recuerdo de mi Confirmación", {
      familia: "Playfair Display", tam: 58, color: GRIS, italica: true,
    });

    // Interior derecha
    a.foto(1, "grupal", FOTO_GRU);
    a.foto(1, "maestra", FOTO_CAT);
    a.texto(1, "titulo_catequista", "Con mi catequista", { x: TXT_X, y: FOTO_CAT.y + 40, w: 740, h: 120 }, "Con mi catequista", {
      familia: "Montserrat", tam: 52, color: AZUL_TXT, peso: 700, mayus: "uppercase", alinear: "LEFT",
    });
    a.variable(1, "curso_colegio", "Curso y colegio", { x: TXT_X, y: FOTO_CAT.y + 260, w: 740, h: 220 }, "course.withSchool", "Curso - Colegio", {
      familia: "Playfair Display", tam: 50, color: GRIS, italica: true, alinear: "LEFT", interlineado: 1.35,
    });
    a.variable(1, "fecha", "Fecha", { x: TXT_X, y: FOTO_CAT.y + 500, w: 600, h: 80 }, "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Montserrat", tam: 42, color: AZUL_TXT, alinear: "LEFT",
    });
  },
};
