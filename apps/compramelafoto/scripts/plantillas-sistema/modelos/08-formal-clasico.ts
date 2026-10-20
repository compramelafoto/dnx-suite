import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, filtroNube, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/** Formal · Clásico crema: papel crema, orla de doble filete con volutas, laureles y serif. */

const BORDO = "#6e1f2b";
const SEPIA = "#5a4632";
const ORO_VIEJO = "#a8874a";

const FOTO_IND = centrado(CENTRO_IZQ, 330, 980, 1260);
const FOTO_GRU = centrado(CENTRO_DER, 600, 1280, 853);

const DEFS = `${filtroGrano("g", 0.75, 3, 5)}${filtroNube("n", 31, 60)}`;

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="#f5eedd"/>
    <g filter="url(#n)" opacity="0.18"><rect x="200" y="200" width="${ANCHO - 400}" height="${ALTO - 400}" fill="#d8c49a"/></g>
    ${grano("g", 0.1)}`;
}

/** Voluta en una esquina: dos curvas enroscadas y una hojita. `sx`/`sy` dan la orientación. */
function voluta(x: number, y: number, sx: number, sy: number) {
  const p = (dx: number, dy: number) => `${x + sx * dx} ${y + sy * dy}`;
  return `<g stroke="${ORO_VIEJO}" stroke-width="6" fill="none" stroke-linecap="round">
    <path d="M ${p(0, 160)} C ${p(0, 40)} ${p(40, 0)} ${p(160, 0)}"/>
    <path d="M ${p(40, 220)} C ${p(40, 90)} ${p(90, 40)} ${p(220, 40)}"/>
    <path d="M ${p(70, 70)} m 0 0 c ${sx * 40} ${sy * -30} ${sx * 80} ${sy * 10} ${sx * 50} ${sy * 45} c ${sx * -25} ${sy * 25} ${sx * -55} ${sy * 0} ${sx * -40} ${sy * -20}"/>
  </g><circle cx="${x + sx * 70}" cy="${y + sy * 70}" r="12" fill="${BORDO}"/>`;
}

function orla(x0: number) {
  const m = 110;
  const w = PLIEGUE;
  return `<rect x="${x0 + m}" y="${m}" width="${w - 2 * m}" height="${ALTO - 2 * m}" fill="none" stroke="${BORDO}" stroke-width="7"/>
    <rect x="${x0 + m + 26}" y="${m + 26}" width="${w - 2 * m - 52}" height="${ALTO - 2 * m - 52}" fill="none" stroke="${ORO_VIEJO}" stroke-width="3"/>
    ${voluta(x0 + m + 40, m + 40, 1, 1)}${voluta(x0 + w - m - 40, m + 40, -1, 1)}${voluta(x0 + m + 40, ALTO - m - 40, 1, -1)}${voluta(x0 + w - m - 40, ALTO - m - 40, -1, -1)}`;
}

/** Rama de laurel a lo largo de un arco; `lado` = 1 derecha, -1 izquierda. */
function laurel(cx: number, cy: number, r: number, lado: 1 | -1) {
  let hojas = "";
  for (let i = 0; i < 9; i++) {
    const ang = Math.PI / 2 + lado * (0.25 + i * 0.13);
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    const giro = (ang * 180) / Math.PI + (lado > 0 ? -60 : 60);
    hojas += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="46" ry="16" fill="${ORO_VIEJO}" transform="rotate(${giro.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  const a0 = Math.PI / 2 + lado * 0.2;
  const a1 = Math.PI / 2 + lado * 1.35;
  return `<path d="M ${cx + Math.cos(a0) * r} ${cy + Math.sin(a0) * r} A ${r} ${r} 0 0 ${lado > 0 ? 1 : 0} ${cx + Math.cos(a1) * r} ${cy + Math.sin(a1) * r}" stroke="${ORO_VIEJO}" stroke-width="5" fill="none"/>${hojas}`;
}

function filete(cx: number, y: number, ancho: number) {
  return `<line x1="${cx - ancho / 2}" y1="${y}" x2="${cx + ancho / 2}" y2="${y}" stroke="${ORO_VIEJO}" stroke-width="3"/><circle cx="${cx}" cy="${y}" r="10" fill="${BORDO}"/>`;
}

export const formalClasico: Modelo = {
  slug: "formal-clasico",
  nombre: "Librito Formal · Clásico crema",
  descripcion:
    "Librito 30×20 cm (2 páginas) formal: papel crema, orla de doble filete con volutas, laureles y tipografía serif clásica en bordó. Para cualquier nivel. Fotos en el interior con paspartú; listado del curso en la contratapa.",
  categoria: "Formal",

  fondoExterior: () =>
    svg(
      `${papel()}${orla(0)}${orla(PLIEGUE)}
       ${laurel(CENTRO_DER, 1020, 330, 1)}${laurel(CENTRO_DER, 1020, 330, -1)}
       ${filete(CENTRO_DER, 640, 520)}${filete(CENTRO_IZQ, 520, 520)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(`${papel()}${orla(0)}${orla(PLIEGUE)}${filete(CENTRO_DER, 1700, 480)}`, DEFS),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 260, 1300, 230), "Compañeros", { familia: "Parisienne", tam: 170, color: BORDO });
    a.listado(0, { x: 300, y: 620, w: PLIEGUE - 600, h: 1450 }, { familia: "Libre Baskerville", tam: 54, color: SEPIA, interlineado: 1.45 });

    // Tapa
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 360, 1300, 260), "Recuerdo escolar", { familia: "Parisienne", tam: 190, color: BORDO });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 920, 500, 170), "2026", { familia: "Libre Baskerville", tam: 120, color: BORDO });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1470, 1250, 300), "school.name", "Nombre del colegio", {
      familia: "Libre Baskerville", tam: 84, color: SEPIA, mayus: "uppercase", interlineado: 1.25,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1810, 1250, 130), "course.displayName", "Curso", {
      familia: "Libre Baskerville", tam: 72, color: BORDO, italica: true,
    });

    // Interior izquierda: paspartú
    a.forma(1, "paspartu_individual", "Paspartú individual", agrandar(FOTO_IND, 50), { relleno: "#fbf8f0", borde: ORO_VIEJO, grosor: 4 });
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 10), { relleno: BORDO });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1700, 1300, 260), "student.fullName", "Nombre del alumno", {
      familia: "Parisienne", tam: 150, color: BORDO,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 1980, 1250, 100), "course.displayName", "Curso", {
      familia: "Libre Baskerville", tam: 52, color: SEPIA, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 290, 1250, 160), "Nuestro curso", {
      familia: "Libre Baskerville", tam: 84, color: BORDO, mayus: "uppercase",
    });
    a.forma(1, "paspartu_grupal", "Paspartú grupal", agrandar(FOTO_GRU, 45), { relleno: "#fbf8f0", borde: ORO_VIEJO, grosor: 4 });
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 10), { relleno: BORDO });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1760, 1250, 210), "course.withSchool", "Curso - Colegio", {
      familia: "Libre Baskerville", tam: 60, color: SEPIA, interlineado: 1.3,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1990, 1250, 120), "Con cariño, para recordar siempre.", {
      familia: "Libre Baskerville", tam: 56, color: BORDO, italica: true,
    });
  },
};
