import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { azar, estrella, filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/** Egresados · Negro y dorado: formal, marcos dorados art déco y caligrafía. */

const ORO = "#d4af63";
const CHAMPAN = "#f1e5c8";

const FOTO_IND = centrado(CENTRO_IZQ, 300, 1000, 1300);
const FOTO_GRU = centrado(CENTRO_DER, 560, 1300, 866);

const DEFS = `
  <linearGradient id="oro" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#a8823a"/><stop offset="0.35" stop-color="#f3d996"/><stop offset="0.6" stop-color="#c39a4b"/><stop offset="1" stop-color="#f0d48a"/>
  </linearGradient>
  <radialGradient id="brillo" cx="0.5" cy="0.45" r="0.7"><stop offset="0" stop-color="#25242a"/><stop offset="1" stop-color="#0b0b0d"/></radialGradient>
  ${filtroGrano("g", 0.9)}`;

/** Doble marco y abanicos art déco en las esquinas de una mitad. */
function marco(x0: number) {
  const m1 = 95;
  const m2 = 125;
  const w = PLIEGUE;
  const abanico = (cx: number, cy: number, sx: number, sy: number) => {
    let rayos = "";
    for (let i = 0; i <= 6; i++) {
      const ang = (i * Math.PI) / 12;
      rayos += `<line x1="${cx}" y1="${cy}" x2="${cx + sx * Math.cos(ang) * 150}" y2="${cy + sy * Math.sin(ang) * 150}"/>`;
    }
    return `<g stroke="url(#oro)" stroke-width="5">${rayos}</g><path d="M ${cx + sx * 150} ${cy} A 150 150 0 0 ${sx * sy > 0 ? 1 : 0} ${cx} ${cy + sy * 150}" stroke="url(#oro)" stroke-width="5" fill="none"/>`;
  };
  return `<rect x="${x0 + m1}" y="${m1}" width="${w - 2 * m1}" height="${ALTO - 2 * m1}" fill="none" stroke="url(#oro)" stroke-width="10"/>
    <rect x="${x0 + m2}" y="${m2}" width="${w - 2 * m2}" height="${ALTO - 2 * m2}" fill="none" stroke="url(#oro)" stroke-width="3"/>
    ${abanico(x0 + m2, m2, 1, 1)}${abanico(x0 + w - m2, m2, -1, 1)}${abanico(x0 + m2, ALTO - m2, 1, -1)}${abanico(x0 + w - m2, ALTO - m2, -1, -1)}`;
}

function destellos(semilla: number, zona: { x: number; y: number; w: number; h: number }, n: number) {
  const a = azar(semilla);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += `<polygon points="${estrella(a.entre(zona.x, zona.x + zona.w), a.entre(zona.y, zona.y + zona.h), a.entre(8, 22), 4, 0.25)}" fill="url(#oro)" opacity="${a.entre(0.4, 0.9).toFixed(2)}"/>`;
  }
  return out;
}

function divisor(cx: number, y: number, ancho: number) {
  return `<line x1="${cx - ancho / 2}" y1="${y}" x2="${cx - 40}" y2="${y}" stroke="url(#oro)" stroke-width="4"/><line x1="${cx + 40}" y1="${y}" x2="${cx + ancho / 2}" y2="${y}" stroke="url(#oro)" stroke-width="4"/>
    <polygon points="${cx},${y - 22} ${cx + 22},${y} ${cx},${y + 22} ${cx - 22},${y}" fill="url(#oro)"/>`;
}

export const egresadosNegroDorado: Modelo = {
  slug: "egresados-negro-dorado",
  nombre: "Librito Egresados · Negro y dorado",
  descripcion:
    "Librito 30×20 cm (2 páginas) formal para egresados: fondo negro, marcos dorados de estilo art déco, caligrafía y serif elegante. Fotos individual y grupal en el interior; listado de la promoción en la contratapa.",
  categoria: "Egresados",

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="url(#brillo)"/>${grano("g", 0.07, "screen")}
       ${marco(0)}${marco(PLIEGUE)}
       ${divisor(CENTRO_DER, 1240, 700)}
       ${divisor(CENTRO_IZQ, 560, 600)}
       ${destellos(4, { x: 1950, y: 200, w: 1400, h: 260 }, 18)}${destellos(6, { x: 1950, y: 1900, w: 1400, h: 250 }, 18)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="url(#brillo)"/>${grano("g", 0.07, "screen")}
       ${marco(0)}${marco(PLIEGUE)}
       ${divisor(CENTRO_DER, 1650, 600)}
       ${destellos(8, { x: 250, y: 200, w: 1300, h: 60 }, 10)}`,
      DEFS,
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 250, 1300, 260), "Egresados", { familia: "Great Vibes", tam: 200, color: ORO });
    a.listado(0, { x: 260, y: 660, w: PLIEGUE - 520, h: 1430 }, { familia: "Playfair Display", tam: 60, color: CHAMPAN, interlineado: 1.4 });

    // Tapa
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 330, 1350, 330), "Promoción", { familia: "Great Vibes", tam: 270, color: ORO });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 680, 1300, 420), "2026", { familia: "Playfair Display", tam: 360, color: CHAMPAN, interlineado: 1 });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1340, 1300, 300), "school.name", "Nombre del colegio", {
      familia: "Playfair Display", tam: 86, color: CHAMPAN, mayus: "uppercase", interlineado: 1.2,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1680, 1300, 140), "course.displayName", "Curso", {
      familia: "Playfair Display", tam: 76, color: ORO, italica: true,
    });

    // Interior izquierda
    a.forma(1, "marco_individual", "Marco dorado individual", agrandar(FOTO_IND, 30), { relleno: ORO });
    a.forma(1, "filete_individual", "Filete negro individual", agrandar(FOTO_IND, 18), { relleno: "#0d0d0f" });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1680, 1400, 300), "student.fullName", "Nombre del alumno", {
      familia: "Great Vibes", tam: 175, color: ORO,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 1990, 1300, 110), "course.displayName", "Curso", {
      familia: "Playfair Display", tam: 62, color: CHAMPAN, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 290, 1300, 160), "Promoción 2026", {
      familia: "Playfair Display", tam: 100, color: CHAMPAN, mayus: "uppercase",
    });
    a.forma(1, "marco_grupal", "Marco dorado grupal", agrandar(FOTO_GRU, 26), { relleno: ORO });
    a.forma(1, "filete_grupal", "Filete negro grupal", agrandar(FOTO_GRU, 15), { relleno: "#0d0d0f" });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1720, 1300, 220), "course.withSchool", "Curso - Colegio", {
      familia: "Playfair Display", tam: 68, color: CHAMPAN, interlineado: 1.25,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1960, 1300, 140), "El final de una etapa, el comienzo de todo.", {
      familia: "Playfair Display", tam: 60, color: ORO, italica: true,
    });
  },
};
