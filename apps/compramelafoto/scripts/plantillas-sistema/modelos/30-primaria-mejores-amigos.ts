import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, girarCon } from "../lienzo";
import { estrella, filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Primaria · Mejores amigos, sin listado: la tapa es la foto con los amigos a sangre, con un
 * «sticker» inclinado encima. Contratapa en papel cuadriculado con la individual; adentro, la foto
 * con la seño y la grupal. Cuatro fotos, tono descontracturado.
 */

const TINTA = "#222233";
const AMARILLO = "#ffd23f";
const FUCSIA = "#ee4266";
const CELESTE = "#3bceac";

const STICKER = centrado(CENTRO_DER, 1640, 1360, 470);
const GIRO_STICKER = -4;
const FOTO_IND = centrado(CENTRO_IZQ, 250, 1120, 1380);
const FOTO_MAE = centrado(CENTRO_IZQ, 280, 1380, 1120);
const FOTO_GRU = centrado(CENTRO_DER, 380, 1480, 990);

function cuadricula(x0: number, x1: number) {
  let out = "";
  for (let x = x0; x <= x1; x += 59) out += `<line x1="${x}" y1="0" x2="${x}" y2="${ALTO}" stroke="#bcd7ef" stroke-width="3"/>`;
  for (let y = 0; y <= ALTO; y += 59) out += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#bcd7ef" stroke-width="3"/>`;
  return out;
}

function cinta(cx: number, cy: number, giro: number, color: string) {
  return `<rect x="${cx - 140}" y="${cy - 40}" width="280" height="80" fill="${color}" opacity="0.8" transform="rotate(${giro} ${cx} ${cy})"/>`;
}

function garabatoCorazon(cx: number, cy: number, s: number, color: string) {
  return `<path d="M ${cx} ${cy + s * 0.35} C ${cx - s * 0.9} ${cy - s * 0.25}, ${cx - s * 0.45} ${cy - s * 0.95}, ${cx} ${cy - s * 0.45} C ${cx + s * 0.45} ${cy - s * 0.95}, ${cx + s * 0.9} ${cy - s * 0.25}, ${cx} ${cy + s * 0.35} Z" fill="none" stroke="${color}" stroke-width="14" stroke-linejoin="round"/>`;
}

const defs = () => filtroGrano("g", 0.85);

export const primariaMejoresAmigos: Modelo = {
  slug: "primaria-mejores-amigos",
  serie: "variadas",
  nombre: "Librito Primaria · Mejores amigos",
  descripcion:
    "Librito 30×20 cm para primaria, sin listado y descontracturado: la foto con los mejores amigos ocupa toda la tapa, con un sticker encima. Contratapa en papel cuadriculado con la foto individual; adentro, la foto con la seño y la grupal. Cuatro fotos.",
  categoria: "Primaria",
  filtros: { estilo: "Informal", orientacion: "vertical", etiquetas: ["amigos", "maestra", "sin listado", "foto a sangre"] },

  fondoExterior: () => {
    const m = agrandar(FOTO_IND, 34);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fbfdff"/>
       ${cuadricula(0, PLIEGUE)}
       <rect x="${m.x + 14}" y="${m.y + 18}" width="${m.w}" height="${m.h}" fill="#000" opacity="0.12" transform="rotate(2 ${m.x + m.w / 2} ${m.y + m.h / 2})"/>
       <rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="#ffffff" transform="rotate(2 ${m.x + m.w / 2} ${m.y + m.h / 2})"/>
       ${garabatoCorazon(230, 2180, 110, FUCSIA)}
       <polygon points="${estrella(PLIEGUE - 220, 2170, 90)}" fill="none" stroke="${CELESTE}" stroke-width="14" stroke-linejoin="round"/>
       ${grano("g", 0.04)}`,
      defs(),
    );
  },

  fondoInterior: () => {
    const mm = agrandar(FOTO_MAE, 34);
    const mg = agrandar(FOTO_GRU, 34);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fbfdff"/>
       ${cuadricula(0, ANCHO)}
       <rect x="${mm.x}" y="${mm.y}" width="${mm.w}" height="${mm.h}" fill="#ffffff"/>
       <rect x="${mg.x}" y="${mg.y}" width="${mg.w}" height="${mg.h}" fill="#ffffff"/>
       ${cinta(mm.x + 90, mm.y + 20, -30, AMARILLO)}${cinta(mm.x + mm.w - 90, mm.y + 20, 30, CELESTE)}
       ${cinta(mg.x + 90, mg.y + 20, -30, FUCSIA)}${cinta(mg.x + mg.w - 90, mg.y + 20, 30, AMARILLO)}
       ${garabatoCorazon(PLIEGUE + 250, 2150, 90, FUCSIA)}
       <polygon points="${estrella(ANCHO - 260, 2150, 80)}" fill="none" stroke="${AMARILLO}" stroke-width="14" stroke-linejoin="round"/>
       ${grano("g", 0.04)}`,
      defs(),
    );
  },

  armar: (a) => {
    // Tapa: los amigos a sangre y un sticker inclinado
    a.foto(0, "amigos", { x: PLIEGUE, y: 0, w: PLIEGUE, h: ALTO });
    a.forma(0, "sticker", "Sticker", STICKER, { relleno: AMARILLO, borde: "#ffffff", grosor: 18, radio: 60, giro: GIRO_STICKER });
    a.texto(0, "titulo", "Título", girarCon({ x: STICKER.x + 40, y: STICKER.y + 50, w: STICKER.w - 80, h: 220 }, STICKER, GIRO_STICKER), "Mejores amigos", {
      familia: "Permanent Marker", tam: 140, color: TINTA,
    }, GIRO_STICKER);
    a.variable(0, "curso", "Grado", girarCon({ x: STICKER.x + 40, y: STICKER.y + 290, w: STICKER.w - 80, h: 130 }, STICKER, GIRO_STICKER), "course.displayName", "Grado", {
      familia: "Patrick Hand", tam: 74, color: TINTA,
    }, GIRO_STICKER);

    // Contratapa: la individual pegada en el cuaderno
    a.foto(0, "individual", girarCon(FOTO_IND, FOTO_IND, 2), { giro: 2 });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1730, 1400, 200), "student.fullName", "Nombre del alumno", {
      familia: "Permanent Marker", tam: 110, color: FUCSIA,
    });
    a.variable(0, "curso_colegio", "Grado y escuela", centrado(CENTRO_IZQ, 1950, 1150, 200), "course.withSchool", "Grado - Escuela", {
      familia: "Patrick Hand", tam: 68, color: TINTA, interlineado: 1.2,
    });

    // Interior izquierda: la seño
    a.foto(1, "maestra", FOTO_MAE);
    a.texto(1, "titulo_maestra", "Título foto con la maestra", centrado(CENTRO_IZQ, 1530, 1450, 210), "¡Gracias, seño!", {
      familia: "Permanent Marker", tam: 130, color: CELESTE,
    });
    a.texto(1, "frase_maestra", "Frase", centrado(CENTRO_IZQ, 1760, 1300, 240), "Por enseñarnos tanto y bancarnos siempre", {
      familia: "Patrick Hand", tam: 78, color: TINTA, interlineado: 1.2,
    });

    // Interior derecha: la grupal
    a.foto(1, "grupal", FOTO_GRU);
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 1490, 1450, 210), "Todo el grado", {
      familia: "Permanent Marker", tam: 130, color: FUCSIA,
    });
    a.variable(1, "curso_colegio", "Grado y escuela", centrado(CENTRO_DER, 1720, 1300, 240), "course.withSchool", "Grado - Escuela", {
      familia: "Patrick Hand", tam: 78, color: TINTA, interlineado: 1.2,
    });
  },
};
