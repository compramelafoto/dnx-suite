import { ALTO, ANCHO, Armador, PLIEGUE, TUBO_PLIEGUE, type RolFoto, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Secundaria · Grilla: la tapa es la grupal a sangre con «PROMO 2026» en un bloque azul; adentro,
 * una grilla de cuatro fotos (individual, una libre, con amigos y con el profe), cada una con su
 * etiqueta negra. Cinco fotos; listado en la contratapa.
 */

const NEGRO = "#111111";
const AZUL = "#2b50ff";
const PAPEL = "#f4f1ea";

const MARGEN = 110;
const ESPACIO = 40;
const ALTO_CELDA = (ALTO - 2 * MARGEN - ESPACIO) / 2;
const ANCHO_CELDA = PLIEGUE - MARGEN - TUBO_PLIEGUE;

const CELDAS: Array<{ rol: RolFoto; r: Rect; etiqueta: string }> = [
  { rol: "individual", r: { x: MARGEN, y: MARGEN, w: ANCHO_CELDA, h: ALTO_CELDA }, etiqueta: "" },
  { rol: "libre", r: { x: MARGEN, y: MARGEN + ALTO_CELDA + ESPACIO, w: ANCHO_CELDA, h: ALTO_CELDA }, etiqueta: "UN DÍA PARA RECORDAR" },
  { rol: "amigos", r: { x: PLIEGUE + TUBO_PLIEGUE, y: MARGEN, w: ANCHO_CELDA, h: ALTO_CELDA }, etiqueta: "LOS DE SIEMPRE" },
  { rol: "maestra", r: { x: PLIEGUE + TUBO_PLIEGUE, y: MARGEN + ALTO_CELDA + ESPACIO, w: ANCHO_CELDA, h: ALTO_CELDA }, etiqueta: "CON MI PROFE" },
];

const defs = () => filtroGrano("g", 0.9);

export const secundariaGrillaCollage: Modelo = {
  slug: "secundaria-grilla-collage",
  serie: "variadas",
  nombre: "Librito Secundaria · Grilla de fotos",
  descripcion:
    "Librito 30×20 cm para secundaria, moderno: la foto grupal a sangre en la tapa con «PROMO 2026» en un bloque azul y, adentro, una grilla de cuatro fotos (individual, una libre, con amigos y con el profe) con etiquetas. Cinco fotos; listado en la contratapa.",
  categoria: "Secundaria",
  filtros: { estilo: "Moderno", orientacion: "vertical", etiquetas: ["collage", "grilla", "amigos", "maestra", "foto a sangre"] },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PAPEL}"/>
       <rect x="${PLIEGUE}" y="1440" width="${PLIEGUE}" height="${ALTO - 1440}" fill="${AZUL}"/>
       <rect x="170" y="480" width="${PLIEGUE - 340}" height="10" fill="${AZUL}"/>
       ${grano("g", 0.04)}`,
      defs(),
    ),

  fondoInterior: () => svg(`<rect width="${ANCHO}" height="${ALTO}" fill="${NEGRO}"/>${grano("g", 0.05, "screen")}`, defs()),

  armar: (a: Armador) => {
    // Tapa
    a.foto(0, "grupal", { x: PLIEGUE, y: 0, w: PLIEGUE, h: 1440 });
    a.texto(0, "titulo", "Título", { x: PLIEGUE + 170, y: 1500, w: PLIEGUE - 290, h: 320 }, "PROMO 2026", {
      familia: "Anton", tam: 270, color: "#ffffff", alinear: "LEFT",
    });
    a.variable(0, "curso_colegio", "Curso y colegio", { x: PLIEGUE + 170, y: 1860, w: PLIEGUE - 290, h: 260 }, "course.withSchool", "Curso - Colegio", {
      familia: "Montserrat", tam: 64, color: "#ffffff", peso: 700, alinear: "LEFT", interlineado: 1.25,
    });

    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", { x: 170, y: 200, w: PLIEGUE - 340, h: 260 }, "LA LISTA", {
      familia: "Anton", tam: 220, color: NEGRO, alinear: "LEFT",
    });
    a.listado(0, { x: 170, y: 600, w: PLIEGUE - 340, h: 1580 }, { familia: "Montserrat", tam: 56, color: NEGRO, alinear: "LEFT", interlineado: 1.45 }, 2);

    // Interior: la grilla, cada foto con su etiqueta
    for (const c of CELDAS) {
      a.foto(1, c.rol, c.r);
      const y = c.r.y + c.r.h - 170;
      a.forma(1, `etiqueta_${c.rol}`, `Etiqueta ${c.rol}`, { x: c.r.x + 50, y, w: 900, h: 120 }, { relleno: NEGRO });
      if (c.rol === "individual") {
        a.variable(1, `texto_${c.rol}`, "Nombre del alumno", { x: c.r.x + 80, y: y + 20, w: 840, h: 80 }, "student.fullName", "Nombre del alumno", {
          familia: "Montserrat", tam: 56, color: "#ffffff", peso: 700, alinear: "LEFT", mayus: "uppercase",
        });
      } else {
        a.texto(1, `texto_${c.rol}`, `Etiqueta ${c.rol}`, { x: c.r.x + 80, y: y + 20, w: 840, h: 80 }, c.etiqueta, {
          familia: "Montserrat", tam: 56, color: "#ffffff", peso: 700, alinear: "LEFT",
        });
      }
    }
  },
};
