import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { azar, filtroGrano, filtroNube, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";
import { birrete, corona, defsVineta, fileteDoble, separador, vineta } from "./formales-comun";

/**
 * Egresados · Azul noche y oro: tapa azul noche con polvo dorado, birrete, corona de laurel
 * alrededor del año y filete dorado. Interior marfil con bandas azules arriba y abajo.
 */

const NOCHE = "#0f1c35";
const ORO = "#d4b26a";
const ORO_CLARO = "#ead6a4";
const CREMA = "#f6f1e4";
const TINTA = "#14254a";
const SEPIA = "#5f5038";

const FOTO_IND = centrado(CENTRO_IZQ, 300, 900, 1200);
const FOTO_GRU = centrado(CENTRO_DER, 560, 1320, 880);

const DEFS = `${defsVineta("v")}${filtroNube("n", 81, 90)}${filtroGrano("g", 0.85, 2, 23)}`;

/** Polvo dorado: puntitos finos al azar, más densos hacia arriba. */
function polvo(semilla: number) {
  const a = azar(semilla);
  let out = `<g fill="${ORO_CLARO}">`;
  for (let i = 0; i < 900; i++) {
    const x = a.entre(0, ANCHO);
    const y = Math.pow(a.r(), 1.7) * ALTO;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${a.entre(1.5, 4.5).toFixed(1)}" opacity="${a.entre(0.15, 0.6).toFixed(2)}"/>`;
  }
  return out + "</g>";
}

function tapa() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${NOCHE}"/>
    <g filter="url(#n)" opacity="0.35"><rect x="300" y="200" width="${ANCHO - 600}" height="${ALTO - 900}" fill="#22355e"/></g>
    ${polvo(9)}${grano("g", 0.06, "screen")}${vineta("v", 0, 0.9)}${vineta("v", 1, 0.9)}`;
}

function papel() {
  const banda = (y: number) =>
    `<rect x="0" y="${y}" width="${ANCHO}" height="120" fill="${NOCHE}"/>`;
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>${grano("g", 0.06)}
    ${banda(0)}${banda(ALTO - 120)}
    <line x1="0" y1="138" x2="${ANCHO}" y2="138" stroke="${ORO}" stroke-width="5"/>
    <line x1="0" y1="${ALTO - 138}" x2="${ANCHO}" y2="${ALTO - 138}" stroke="${ORO}" stroke-width="5"/>`;
}

export const egresadosAzulOro: Modelo = {
  slug: "egresados-azul-oro",
  nombre: "Librito Egresados · Azul noche y oro",
  descripcion:
    "Librito 30×20 cm (2 páginas) para egresados: tapa azul noche con polvo dorado, birrete y corona de laurel alrededor del año de la promoción. Interior marfil con bandas azules y fotos con paspartú dorado. Listado del curso en la contratapa.",
  categoria: "Egresados",
  filtros: { estilo: "Formal", evento: "Egresados", etiquetas: ["azul noche", "oro", "birrete", "laurel", "promoción"] },

  fondoExterior: () =>
    svg(
      `${tapa()}${fileteDoble(0, 110, ORO, 5, 2, 20)}${fileteDoble(1, 110, ORO, 5, 2, 20)}
       ${birrete(CENTRO_DER, 290, 300, ORO, ORO_CLARO)}
       ${corona(CENTRO_DER, 1080, 300, ORO, 0.95)}
       ${separador(CENTRO_DER, 1490, 560, ORO)}${separador(CENTRO_IZQ, 520, 580, ORO)}`,
      DEFS,
    ),

  fondoInterior: () => svg(`${papel()}${separador(CENTRO_DER, 1580, 520, ORO)}`, DEFS),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 270, 1300, 230), "Mis compañeros", {
      familia: "Great Vibes", tam: 160, color: ORO,
    });
    a.listado(0, { x: 300, y: 620, w: PLIEGUE - 600, h: 1440 }, { familia: "Playfair Display", tam: 50, color: CREMA, interlineado: 1.45 });

    // Tapa
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 440, 1250, 240), "Promoción", {
      familia: "Great Vibes", tam: 190, color: ORO_CLARO,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 975, 560, 220), "2026", {
      familia: "Playfair Display", tam: 170, color: ORO, peso: 700,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1560, 1200, 260), "school.name", "Nombre del colegio", {
      familia: "Playfair Display", tam: 72, color: CREMA, mayus: "uppercase", interlineado: 1.25,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1870, 1200, 120), "course.displayName", "Curso", {
      familia: "Playfair Display", tam: 62, color: ORO_CLARO, italica: true,
    });

    // Interior izquierda
    a.forma(1, "paspartu_individual", "Paspartú individual", agrandar(FOTO_IND, 34), { relleno: NOCHE });
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 12), { relleno: ORO });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1640, 1300, 230), "student.fullName", "Nombre del alumno", {
      familia: "Great Vibes", tam: 145, color: TINTA,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 1900, 1300, 90), "course.displayName", "Curso", {
      familia: "Playfair Display", tam: 48, color: SEPIA, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 260, 1300, 200), "Egresados", {
      familia: "Great Vibes", tam: 140, color: TINTA,
    });
    a.forma(1, "paspartu_grupal", "Paspartú grupal", agrandar(FOTO_GRU, 34), { relleno: NOCHE });
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 12), { relleno: ORO });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1640, 1300, 220), "course.withSchool", "Curso - Colegio", {
      familia: "Playfair Display", tam: 58, color: TINTA, interlineado: 1.3,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1890, 1300, 100), "Lo mejor está por venir", {
      familia: "Playfair Display", tam: 54, color: SEPIA, italica: true,
    });
  },
};
