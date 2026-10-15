import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Egresados · Diploma: pergamino con doble borde, sello de lacre y letra caligráfica, como un
 * diploma. La tapa no lleva foto: es el «título» de egresados. Adentro, la individual con el
 * nombre, la grupal y la foto con la maestra. Listado de la promoción en la contratapa.
 */

const PERGAMINO = "#f6efdc";
const ORO = "#a8843a";
const TINTA = "#2c2416";
const LACRE = "#9b1d20";

const FOTO_IND: Rect = centrado(CENTRO_IZQ, 240, 1040, 1340);
const FOTO_GRU: Rect = centrado(CENTRO_DER, 220, 1460, 960);
const FOTO_MAE: Rect = { x: PLIEGUE + 230, y: 1380, w: 760, h: 760 };

function bordes(x0: number, ancho: number) {
  return `<rect x="${x0 + 100}" y="100" width="${ancho - 200}" height="${ALTO - 200}" fill="none" stroke="${ORO}" stroke-width="12"/>
    <rect x="${x0 + 130}" y="130" width="${ancho - 260}" height="${ALTO - 260}" fill="none" stroke="${ORO}" stroke-width="3"/>`;
}

function sello(cx: number, cy: number, r: number) {
  let ondas = "";
  for (let i = 0; i < 18; i++) {
    const a = (i * Math.PI * 2) / 18;
    ondas += `<circle cx="${cx + Math.cos(a) * r}" cy="${cy + Math.sin(a) * r}" r="${r * 0.22}" fill="${LACRE}"/>`;
  }
  return `<g>${ondas}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${LACRE}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="none" stroke="#c4474a" stroke-width="${r * 0.06}"/>
    <path d="M ${cx - r * 0.55} ${cy + r * 0.8} L ${cx - r * 0.75} ${cy + r * 1.9} L ${cx - r * 0.35} ${cy + r * 1.65} L ${cx - r * 0.1} ${cy + r * 2} L ${cx} ${cy + r * 0.9} Z" fill="${LACRE}"/>
    <path d="M ${cx + r * 0.55} ${cy + r * 0.8} L ${cx + r * 0.75} ${cy + r * 1.9} L ${cx + r * 0.35} ${cy + r * 1.65} L ${cx + r * 0.1} ${cy + r * 2} L ${cx} ${cy + r * 0.9} Z" fill="${LACRE}"/></g>`;
}

const marco = (r: Rect) => {
  const a = agrandar(r, 28);
  const b = agrandar(r, 10);
  return `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="${ORO}"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${PERGAMINO}"/>`;
};

const defs = () => filtroGrano("g", 0.7, 3, 4);

export const egresadosDiploma: Modelo = {
  slug: "egresados-diploma",
  serie: "variadas",
  nombre: "Librito Egresados · Diploma",
  descripcion:
    "Librito 30×20 cm para egresados con forma de diploma: pergamino con doble borde dorado, sello de lacre y letra caligráfica. La tapa es el título de egresados, sin foto; adentro, la foto individual con el nombre, la grupal y la foto con la maestra. Listado de la promoción en la contratapa.",
  categoria: "Egresados",
  filtros: { estilo: "Clásico", orientacion: "vertical", evento: "Egreso", etiquetas: ["diploma", "maestra", "clásico"] },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PERGAMINO}"/>
       ${bordes(0, PLIEGUE)}${bordes(PLIEGUE, PLIEGUE)}
       ${sello(CENTRO_DER, 1700, 150)}
       <line x1="${CENTRO_DER - 350}" y1="1180" x2="${CENTRO_DER + 350}" y2="1180" stroke="${ORO}" stroke-width="4"/>
       ${grano("g", 0.1)}`,
      defs(),
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PERGAMINO}"/>
       ${marco(FOTO_IND)}${marco(FOTO_GRU)}${marco(FOTO_MAE)}
       ${grano("g", 0.1)}`,
      defs(),
    ),

  armar: (a) => {
    // Tapa: el título
    a.texto(0, "titulo", "Título", centrado(CENTRO_DER, 300, 1400, 300), "Egresados", { familia: "Great Vibes", tam: 230, color: TINTA });
    a.texto(0, "promocion", "Promoción", centrado(CENTRO_DER, 640, 1400, 150), "Promoción 2026", {
      familia: "Playfair Display", tam: 100, color: ORO, peso: 700,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 850, 1350, 280), "school.name", "Nombre del colegio", {
      familia: "Libre Baskerville", tam: 76, color: TINTA, interlineado: 1.2,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1240, 1350, 130), "course.displayName", "Curso", {
      familia: "Libre Baskerville", tam: 60, color: TINTA, italica: true,
    });

    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 230, 1300, 220), "Nuestra promoción", {
      familia: "Great Vibes", tam: 130, color: TINTA,
    });
    a.listado(0, { x: 260, y: 520, w: PLIEGUE - 520, h: 1580 }, { familia: "Libre Baskerville", tam: 54, color: TINTA, interlineado: 1.45 }, 2);

    // Interior izquierda: la individual
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1720, 1450, 170), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 96, color: TINTA, peso: 700,
    });
    a.texto(1, "promocion", "Promoción", centrado(CENTRO_IZQ, 1910, 1300, 130), "Promoción 2026", {
      familia: "Lora", tam: 66, color: ORO, italica: true,
    });

    // Interior derecha: la grupal y la maestra
    a.foto(1, "grupal", FOTO_GRU);
    a.foto(1, "maestra", FOTO_MAE);
    a.texto(1, "titulo_maestra", "Título foto con la maestra", { x: PLIEGUE + 1080, y: 1450, w: 560, h: 380 }, "Gracias por acompañarnos", {
      familia: "Great Vibes", tam: 100, color: TINTA, interlineado: 1.1,
    });
    a.variable(1, "curso_colegio", "Curso y colegio", { x: PLIEGUE + 1080, y: 1860, w: 560, h: 280 }, "course.withSchool", "Curso - Colegio", {
      familia: "Lora", tam: 52, color: TINTA, italica: true, interlineado: 1.25,
    });
  },
};
