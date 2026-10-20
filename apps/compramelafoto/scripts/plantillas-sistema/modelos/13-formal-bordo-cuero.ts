import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, filtroNube, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";
import { cajaDeMitad, cuatroEsquinas, cuero, defsCuero, defsVineta, esquinaHojas, fileteDoble, ramaLaurel, rect, vineta } from "./formales-comun";

/**
 * Bordó · Cuero repujado: tapa de cuero bordó con un filete hundido (relieve en seco), filete
 * dorado con hojas en las esquinas y una etiqueta crema con el logo y el nombre del colegio.
 */

const BORDO = "#5a1522";
const ORO = "#cfae6a";
const CREMA_ORO = "#f2e4c4";
const CREMA = "#f5ecdc";
const TINTA = "#4a1019";
const SEPIA = "#5e4630";

const ETIQUETA = { x: CENTRO_DER - 520, y: 1070, w: 1040, h: 1010 };
const FOTO_IND = centrado(CENTRO_IZQ, 300, 900, 1200);
const FOTO_GRU = centrado(CENTRO_DER, 540, 1300, 867);

const DEFS = `${defsCuero("c", 13)}${defsVineta("v")}${filtroGrano("g", 0.8, 2, 6)}${filtroNube("n", 52, 70)}`;

/** Filete hundido: una línea oscura y otra clara corrida, como el gofrado en seco del cuero. */
function hundido(mitad: 0 | 1, m: number) {
  const r = cajaDeMitad(mitad, m);
  return rect(r, "#000000", 7, 'stroke-opacity="0.35"') + rect({ x: r.x + 5, y: r.y + 5, w: r.w, h: r.h }, "#ffffff", 4, 'stroke-opacity="0.14"');
}

function tapa() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${BORDO}"/>${cuero("c", 0.55)}${vineta("v", 0)}${vineta("v", 1)}
    ${hundido(0, 95)}${hundido(1, 95)}${hundido(0, 215)}${hundido(1, 215)}`;
}

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>
    <g filter="url(#n)" opacity="0.16"><rect x="200" y="200" width="${ANCHO - 400}" height="${ALTO - 400}" fill="#d6bf96"/></g>${grano("g", 0.08)}`;
}

export const formalBordoCuero: Modelo = {
  slug: "formal-bordo-cuero",
  nombre: "Librito Formal · Bordó cuero repujado",
  descripcion:
    "Librito 30×20 cm (2 páginas) formal: tapa de cuero bordó con filete hundido y filete dorado con hojas; etiqueta crema con el logo del colegio y su nombre. Interior crema con fotos con paspartú bordó. Listado del curso en la contratapa.",
  categoria: "Formal",
  filtros: { estilo: "Clásico", etiquetas: ["bordó", "cuero", "oro", "laurel", "logo"] },

  fondoExterior: () =>
    svg(
      `${tapa()}${fileteDoble(0, 140, ORO, 5, 2, 16)}${fileteDoble(1, 140, ORO, 5, 2, 16)}
       ${cuatroEsquinas(cajaDeMitad(0, 175), (x, y, sx, sy) => esquinaHojas(x, y, sx, sy, ORO))}
       ${cuatroEsquinas(cajaDeMitad(1, 175), (x, y, sx, sy) => esquinaHojas(x, y, sx, sy, ORO))}
       ${ramaLaurel(CENTRO_DER, 660, 300, 1, ORO, 8, 1.0, 0.9)}${ramaLaurel(CENTRO_DER, 660, 300, -1, ORO, 8, 1.0, 0.9)}
       <rect x="${ETIQUETA.x - 14}" y="${ETIQUETA.y - 14}" width="${ETIQUETA.w + 28}" height="${ETIQUETA.h + 28}" fill="none" stroke="${ORO}" stroke-width="6"/>
       <rect x="${ETIQUETA.x}" y="${ETIQUETA.y}" width="${ETIQUETA.w}" height="${ETIQUETA.h}" fill="${CREMA}"/>
       ${rect(agrandar(ETIQUETA, -18), BORDO, 2)}
       <line x1="${CENTRO_IZQ - 300}" y1="530" x2="${CENTRO_IZQ + 300}" y2="530" stroke="${ORO}" stroke-width="4"/>`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${papel()}${fileteDoble(0, 100, BORDO, 5, 2, 18)}${fileteDoble(1, 100, BORDO, 5, 2, 18)}
       ${cuatroEsquinas(cajaDeMitad(0, 130), (x, y, sx, sy) => esquinaHojas(x, y, sx, sy, BORDO))}
       ${cuatroEsquinas(cajaDeMitad(1, 130), (x, y, sx, sy) => esquinaHojas(x, y, sx, sy, BORDO))}`,
      DEFS,
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 270, 1250, 230), "Compañeros", {
      familia: "Allura", tam: 190, color: ORO,
    });
    a.listado(0, { x: 330, y: 620, w: PLIEGUE - 660, h: 1420 }, { familia: "Crimson Text", tam: 56, color: CREMA_ORO, interlineado: 1.4 });

    // Tapa
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 330, 1200, 270), "Recuerdo", {
      familia: "Allura", tam: 230, color: ORO,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 690, 520, 170), "2026", {
      familia: "Crimson Text", tam: 130, color: CREMA_ORO, peso: 700,
    });
    a.logo(0, "logo", centrado(CENTRO_DER, 1120, 420, 380));
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1540, 920, 260), "school.name", "Nombre del colegio", {
      familia: "Crimson Text", tam: 72, color: TINTA, mayus: "uppercase", interlineado: 1.2, peso: 700,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1850, 920, 110), "course.displayName", "Curso", {
      familia: "Crimson Text", tam: 60, color: SEPIA, italica: true,
    });

    // Interior izquierda
    a.forma(1, "paspartu_individual", "Paspartú individual", agrandar(FOTO_IND, 40), { relleno: BORDO });
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 14), { relleno: ORO });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1640, 1300, 240), "student.fullName", "Nombre del alumno", {
      familia: "Allura", tam: 150, color: TINTA,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 1900, 1250, 90), "course.displayName", "Curso", {
      familia: "Crimson Text", tam: 50, color: SEPIA, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 290, 1250, 170), "Nuestro curso", {
      familia: "Crimson Text", tam: 96, color: TINTA, italica: true,
    });
    a.forma(1, "paspartu_grupal", "Paspartú grupal", agrandar(FOTO_GRU, 40), { relleno: BORDO });
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 14), { relleno: ORO });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1560, 1250, 220), "course.withSchool", "Curso - Colegio", {
      familia: "Crimson Text", tam: 60, color: TINTA, interlineado: 1.3,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1820, 1250, 110), "Un año para no olvidar", {
      familia: "Crimson Text", tam: 56, color: SEPIA, italica: true,
    });
  },
};
