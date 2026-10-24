import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { azar, estrella, filtroGrano, grano, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Negro y dorado: negro profundo con filetes dorados finos y esquinas art
 * déco. Tapa con el retrato en marco dorado; adentro, los compañeros en círculos con aro dorado.
 */

const ORO = "#d4af63";
const CHAMPAN = "#f1e5c8";
const NEGRO = "#0d0d0f";

const RETRATO = centrado(CENTRO_DER, 470, 880, 1100);
const GRUPAL = centrado(CENTRO_IZQ, 470, 1240, 826);
const TUTOR = { x: GRUPAL.x + 40, y: 1500, w: 400, h: 500 };

const DEFS = `
  <linearGradient id="oro" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#a8823a"/><stop offset="0.35" stop-color="#f3d996"/><stop offset="0.6" stop-color="#c39a4b"/><stop offset="1" stop-color="#f0d48a"/>
  </linearGradient>
  <radialGradient id="brillo" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="#232228"/><stop offset="1" stop-color="#09090b"/></radialGradient>
  ${filtroGrano("g", 0.9)}`;

/** Doble filete dorado con escalones art déco en las esquinas de una mitad. */
function filetes(x0: number, m = 70) {
  const w = PLIEGUE;
  const m2 = m + 22;
  const esquina = (cx: number, cy: number, sx: number, sy: number) => {
    const p = (dx: number, dy: number) => `${cx + sx * dx},${cy + sy * dy}`;
    return `<polyline points="${p(0, 150)} ${p(40, 150)} ${p(40, 40)} ${p(150, 40)} ${p(150, 0)}" fill="none" stroke="url(#oro)" stroke-width="4"/>
      <polygon points="${p(70, 58)} ${p(82, 70)} ${p(70, 82)} ${p(58, 70)}" fill="url(#oro)"/>`;
  };
  return `<rect x="${x0 + m}" y="${m}" width="${w - 2 * m}" height="${ALTO - 2 * m}" fill="none" stroke="url(#oro)" stroke-width="7"/>
    <rect x="${x0 + m2}" y="${m2}" width="${w - 2 * m2}" height="${ALTO - 2 * m2}" fill="none" stroke="url(#oro)" stroke-width="2.5"/>
    ${esquina(x0 + m2, m2, 1, 1)}${esquina(x0 + w - m2, m2, -1, 1)}${esquina(x0 + m2, ALTO - m2, 1, -1)}${esquina(x0 + w - m2, ALTO - m2, -1, -1)}`;
}

function divisor(cx: number, y: number, ancho: number) {
  return `<line x1="${cx - ancho / 2}" y1="${y}" x2="${cx - 40}" y2="${y}" stroke="url(#oro)" stroke-width="3"/><line x1="${cx + 40}" y1="${y}" x2="${cx + ancho / 2}" y2="${y}" stroke="url(#oro)" stroke-width="3"/>
    <polygon points="${cx},${y - 18} ${cx + 18},${y} ${cx},${y + 18} ${cx - 18},${y}" fill="url(#oro)"/>`;
}

function destellos(semilla: number, zona: { x: number; y: number; w: number; h: number }, n: number) {
  const a = azar(semilla);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += `<polygon points="${estrella(a.entre(zona.x, zona.x + zona.w), a.entre(zona.y, zona.y + zona.h), a.entre(7, 18), 4, 0.25)}" fill="url(#oro)" opacity="${a.entre(0.35, 0.85).toFixed(2)}"/>`;
  }
  return out;
}

const fondo = () => `<rect width="${ANCHO}" height="${ALTO}" fill="url(#brillo)"/>${grano("g", 0.06, "screen")}`;

export const mosaicoEgresadosNegroDorado: Modelo = {
  slug: "mosaico-egresados-negro-dorado",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Negro y dorado",
  descripcion: `Carpeta 30×20 cm para egresados: negro con filetes dorados y esquinas art déco. El retrato grande del alumno en marco dorado en la tapa; la foto de la promoción y el tutor en la contratapa. Adentro, los compañeros en círculos con aro dorado. ${DESCRIPCION_MOSAICO}`,
  categoria: "Egresados",
  filtros: { estilo: "Formal", etiquetas: ["mosaico", "compañeros", "negro", "dorado", "egresados", "promoción"] },
  etiquetasDeFotos: { ...ETIQUETAS_MOSAICO, maestra: "Foto del tutor o la tutora" },

  fondoExterior: () =>
    svg(
      `${fondo()}${filetes(0)}${filetes(PLIEGUE)}
       ${divisor(CENTRO_DER, 1800, 640)}
       ${divisor(CENTRO_IZQ, 395, 520)}
       ${destellos(4, { x: PLIEGUE + 300, y: 2120, w: 1180, h: 50 }, 8)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${fondo()}${filetes(0)}${filetes(PLIEGUE)}
       ${divisor(CENTRO_IZQ, 395, 520)}${divisor(CENTRO_DER, 395, 520)}`,
      DEFS,
    ),

  armar: (a) => {
    const serif = (tam: number, color = CHAMPAN, extra = {}) => ({ familia: "Playfair Display", tam, color, ...extra });
    const script = (tam: number, color = ORO) => ({ familia: "Great Vibes", tam, color });

    // Contratapa: la promoción y el tutor.
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 160, 1300, 210), "Nuestra promoción", script(150));
    a.forma(0, "marco_grupal", "Marco dorado de la grupal", agrandar(GRUPAL, 22), { relleno: ORO });
    a.forma(0, "filete_grupal", "Filete negro de la grupal", agrandar(GRUPAL, 12), { relleno: NEGRO });
    a.foto(0, "grupal", GRUPAL);
    a.forma(0, "marco_maestra", "Marco dorado del tutor", agrandar(TUTOR, 18), { relleno: ORO });
    a.forma(0, "filete_maestra", "Filete negro del tutor", agrandar(TUTOR, 9), { relleno: NEGRO });
    a.foto(0, "maestra", TUTOR);
    a.texto(0, "titulo_maestra", "Título del tutor", { x: TUTOR.x + TUTOR.w + 100, y: 1580, w: 700, h: 170 }, "Nuestro tutor", script(120));
    a.variable(0, "curso_contratapa", "Curso y colegio", { x: TUTOR.x + TUTOR.w + 100, y: 1770, w: 700, h: 230 }, "course.withSchool", "Curso - Colegio", serif(48, CHAMPAN, { alinear: "LEFT", interlineado: 1.3, italica: true }));

    // Tapa: el retrato en marco dorado y los datos.
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 175, 1300, 230), "Promoción 2026", script(170));
    a.forma(0, "marco_retrato", "Marco dorado del retrato", agrandar(RETRATO, 26), { relleno: ORO });
    a.forma(0, "filete_retrato", "Filete negro del retrato", agrandar(RETRATO, 14), { relleno: NEGRO });
    a.foto(0, "individual", RETRATO);
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1625, 1400, 150), "student.fullName", "Nombre del alumno", serif(104, CHAMPAN, { interlineado: 1.05 }));
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1855, 1300, 90), "course.displayName", "Curso", serif(58, ORO, { italica: true }));
    a.variable(0, "colegio", "Colegio", centrado(CENTRO_DER, 1960, 1300, 150), "school.name", "Colegio", serif(48, CHAMPAN, { mayus: "uppercase", interlineado: 1.25 }));

    // Interior: el mosaico en círculos con aro dorado.
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 170, 1300, 200), "Compañeros", script(160));
    a.texto(1, "anio", "Año", centrado(CENTRO_DER, 215, 1300, 130), "Promoción 2026", serif(84, CHAMPAN, { mayus: "uppercase" }));
    mosaicoEnDosPaginas(a, 470, 1720, serif(36, CHAMPAN, { interlineado: 1.1 }), {
      frame: "circle",
      gapX: 46,
      gapY: 64,
      borderWidth: 10,
      borderColor: ORO,
      namePosition: "below",
      nameLines: 2,
      givenNames: "all",
    });
  },
};
