import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, filtroNube, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";
import { cajaDeMitad, escudoGenerico, orlaRombos, ramaLaurel, rect, separador, x0De } from "./formales-comun";

/**
 * Heráldico · Escudo y orla: pergamino con orlas de rombos azul y oro arriba y abajo, y en la tapa
 * un escudo genérico (sin marcas) entre ramas de laurel. Tipografía Merriweather y Parisienne.
 */

const PERGAMINO = "#efe2c4";
const AZUL = "#1d2f5e";
const ORO = "#b58f3e";
const TINTA = "#1a2a52";
const SEPIA = "#5c4528";

const FOTO_IND = centrado(CENTRO_IZQ, 420, 900, 1180);
const FOTO_GRU = centrado(CENTRO_DER, 560, 1240, 827);

const DEFS = `${filtroNube("n", 91, 70)}${filtroNube("n2", 93, 40)}${filtroGrano("g", 0.75, 3, 29)}`;

function pergamino() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${PERGAMINO}"/>
    <g filter="url(#n)" opacity="0.28"><rect x="150" y="150" width="${ANCHO - 300}" height="${ALTO - 300}" fill="#cfb27a"/></g>
    <g filter="url(#n2)" opacity="0.12"><rect x="600" y="500" width="${ANCHO - 1200}" height="${ALTO - 1000}" fill="#b89458"/></g>
    ${grano("g", 0.1)}`;
}

function orlas(mitad: 0 | 1) {
  const r = cajaDeMitad(mitad, 110);
  return `${rect(r, AZUL, 6)}${orlaRombos(r.x + 30, r.x + r.w - 30, 150, 86, ORO, AZUL)}${orlaRombos(r.x + 30, r.x + r.w - 30, ALTO - 150 - 86, 86, ORO, AZUL)}
    <line x1="${r.x + 30}" y1="150" x2="${r.x + 30}" y2="${ALTO - 150}" stroke="${ORO}" stroke-width="4"/>
    <line x1="${r.x + r.w - 30}" y1="150" x2="${r.x + r.w - 30}" y2="${ALTO - 150}" stroke="${ORO}" stroke-width="4"/>`;
}

export const formalHeraldico: Modelo = {
  slug: "formal-heraldico",
  nombre: "Librito Formal · Heráldico con escudo y orla",
  descripcion:
    "Librito 30×20 cm (2 páginas) de colegio tradicional: pergamino con orlas de rombos azul y oro, y un escudo genérico entre laureles en la tapa. Interior con fotos con doble filete azul y oro. Listado del curso en la contratapa.",
  categoria: "Formal",
  filtros: { estilo: "Clásico", etiquetas: ["escudo", "orla", "pergamino", "azul", "oro", "tradicional"] },

  fondoExterior: () =>
    svg(
      `${pergamino()}${orlas(0)}${orlas(1)}
       ${escudoGenerico(CENTRO_DER, 820, 330, ORO, AZUL)}
       ${ramaLaurel(CENTRO_DER, 820, 300, 1, ORO, 9, 1.45, 0.95)}${ramaLaurel(CENTRO_DER, 820, 300, -1, ORO, 9, 1.45, 0.95)}
       ${separador(CENTRO_DER, 1480, 520, AZUL)}${separador(CENTRO_IZQ, 580, 560, ORO)}`,
      DEFS,
    ),

  fondoInterior: () => svg(`${pergamino()}${orlas(0)}${orlas(1)}${separador(x0De(1) + PLIEGUE / 2, 500, 480, ORO)}`, DEFS),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 300, 1250, 240), "Compañeros", {
      familia: "Parisienne", tam: 170, color: TINTA,
    });
    a.listado(0, { x: 330, y: 660, w: PLIEGUE - 660, h: 1360 }, { familia: "Merriweather", tam: 44, color: TINTA, interlineado: 1.5 });

    // Tapa
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 270, 1250, 230), "Recuerdo escolar", {
      familia: "Parisienne", tam: 160, color: TINTA,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 1250, 500, 150), "2026", {
      familia: "Merriweather", tam: 100, color: TINTA, peso: 700,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1540, 1200, 260), "school.name", "Nombre del colegio", {
      familia: "Merriweather", tam: 64, color: TINTA, mayus: "uppercase", interlineado: 1.3, peso: 700,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1830, 1200, 110), "course.displayName", "Curso", {
      familia: "Merriweather", tam: 54, color: SEPIA, italica: true,
    });

    // Interior izquierda
    a.forma(1, "paspartu_individual", "Paspartú individual", agrandar(FOTO_IND, 34), { relleno: AZUL });
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 14), { relleno: ORO });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1660, 1250, 220), "student.fullName", "Nombre del alumno", {
      familia: "Parisienne", tam: 130, color: TINTA,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 1880, 1250, 80), "course.displayName", "Curso", {
      familia: "Merriweather", tam: 42, color: SEPIA, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 330, 1250, 140), "Nuestro curso", {
      familia: "Merriweather", tam: 70, color: TINTA, mayus: "uppercase", peso: 700,
    });
    a.forma(1, "paspartu_grupal", "Paspartú grupal", agrandar(FOTO_GRU, 34), { relleno: AZUL });
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 14), { relleno: ORO });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1490, 1250, 220), "course.withSchool", "Curso - Colegio", {
      familia: "Merriweather", tam: 50, color: TINTA, interlineado: 1.4,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1740, 1250, 150), "Con orgullo y gratitud", {
      familia: "Parisienne", tam: 100, color: SEPIA,
    });
  },
};
