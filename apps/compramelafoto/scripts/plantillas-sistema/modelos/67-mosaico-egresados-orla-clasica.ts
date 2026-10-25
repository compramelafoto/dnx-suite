import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Orla clásica: granate oscuro con filetes dorados y un escudo genérico (un
 * libro abierto y una estrella entre laureles, sin marcas de nadie), letra serif. Adentro, la orla:
 * los compañeros en óvalos con el nombre debajo.
 */

const ORO = "#c9a45c";
const CREMA = "#f3e7cf";
const GRANATE = "#4a0f1a";

const RETRATO = centrado(CENTRO_DER, 700, 780, 980);
const GRUPAL = centrado(CENTRO_IZQ, 640, 1180, 786);
const TUTOR = { x: GRUPAL.x + 60, y: 1590, w: 340, h: 425 };

const DEFS = `
  <linearGradient id="oro" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#9c7a36"/><stop offset="0.4" stop-color="#ecd294"/><stop offset="0.65" stop-color="#b8913f"/><stop offset="1" stop-color="#e3c47c"/>
  </linearGradient>
  <radialGradient id="terciopelo" cx="0.5" cy="0.45" r="0.8"><stop offset="0" stop-color="#5e1424"/><stop offset="1" stop-color="#2e0810"/></radialGradient>
  <pattern id="damasco" width="120" height="120" patternUnits="userSpaceOnUse">
    <path d="M 60 18 L 72 60 L 60 102 L 48 60 Z" fill="#ffffff" opacity="0.025"/><circle cx="0" cy="0" r="8" fill="#ffffff" opacity="0.025"/><circle cx="120" cy="120" r="8" fill="#ffffff" opacity="0.025"/>
  </pattern>
  ${filtroGrano("g", 0.9)}`;

const fondo = () => `<rect width="${ANCHO}" height="${ALTO}" fill="url(#terciopelo)"/><rect width="${ANCHO}" height="${ALTO}" fill="url(#damasco)"/>${grano("g", 0.05, "screen")}`;

/** Doble filete dorado con un rombo en cada esquina, en una mitad. */
function filetes(x0: number, m = 66) {
  const w = PLIEGUE;
  const m2 = m + 24;
  const rombo = (cx: number, cy: number) => `<polygon points="${cx},${cy - 20} ${cx + 20},${cy} ${cx},${cy + 20} ${cx - 20},${cy}" fill="url(#oro)"/>`;
  return `<rect x="${x0 + m}" y="${m}" width="${w - 2 * m}" height="${ALTO - 2 * m}" fill="none" stroke="url(#oro)" stroke-width="6"/>
    <rect x="${x0 + m2}" y="${m2}" width="${w - 2 * m2}" height="${ALTO - 2 * m2}" fill="none" stroke="url(#oro)" stroke-width="2"/>
    ${rombo(x0 + m, m)}${rombo(x0 + w - m, m)}${rombo(x0 + m, ALTO - m)}${rombo(x0 + w - m, ALTO - m)}`;
}

/** Ramita de laurel: hojas en espiga a lo largo de un arco. */
function laurel(cx: number, cy: number, r: number, lado: 1 | -1) {
  let hojas = "";
  for (let i = 0; i < 9; i++) {
    const ang = ((100 + i * 16) * Math.PI) / 180;
    const x = cx + lado * r * Math.cos(ang) * -1;
    const y = cy + r * Math.sin(ang);
    const giro = lado * (i * 16 + 10);
    hojas += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="11" ry="26" transform="rotate(${giro} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#oro)"/>`;
  }
  return hojas;
}

/** Escudo genérico: blasón con un libro abierto y una estrella, entre dos ramas de laurel. */
function escudo(cx: number, cy: number) {
  const s = 1;
  const p = (dx: number, dy: number) => `${cx + dx * s},${cy + dy * s}`;
  return `<path d="M ${p(-95, -110)} L ${p(95, -110)} L ${p(95, 10)} Q ${p(95, 95)} ${p(0, 130)} Q ${p(-95, 95)} ${p(-95, 10)} Z" fill="${GRANATE}" stroke="url(#oro)" stroke-width="8"/>
    <path d="M ${p(-70, -88)} L ${p(70, -88)} L ${p(70, 6)} Q ${p(70, 72)} ${p(0, 102)} Q ${p(-70, 72)} ${p(-70, 6)} Z" fill="none" stroke="url(#oro)" stroke-width="2.5"/>
    <polygon points="${(() => {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? 30 : 13;
        const a = ((-90 + i * 36) * Math.PI) / 180;
        pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy - 45 + rr * Math.sin(a)).toFixed(1)}`);
      }
      return pts.join(" ");
    })()}" fill="url(#oro)"/>
    <path d="M ${p(-50, 20)} Q ${p(-25, 8)} ${p(0, 22)} Q ${p(25, 8)} ${p(50, 20)} L ${p(50, 62)} Q ${p(25, 50)} ${p(0, 64)} Q ${p(-25, 50)} ${p(-50, 62)} Z" fill="url(#oro)"/>
    <line x1="${cx}" y1="${cy + 22}" x2="${cx}" y2="${cy + 64}" stroke="${GRANATE}" stroke-width="4"/>
    ${laurel(cx, cy + 10, 150, 1)}${laurel(cx, cy + 10, 150, -1)}`;
}

function divisor(cx: number, y: number, ancho: number) {
  return `<line x1="${cx - ancho / 2}" y1="${y}" x2="${cx - 36}" y2="${y}" stroke="url(#oro)" stroke-width="3"/><line x1="${cx + 36}" y1="${y}" x2="${cx + ancho / 2}" y2="${y}" stroke="url(#oro)" stroke-width="3"/>
    <polygon points="${cx},${y - 16} ${cx + 16},${y} ${cx},${y + 16} ${cx - 16},${y}" fill="url(#oro)"/>`;
}

export const mosaicoEgresadosOrlaClasica: Modelo = {
  slug: "mosaico-egresados-orla-clasica",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Orla clásica",
  descripcion: `Carpeta 30×20 cm para egresados, clásica: granate oscuro con filetes dorados, un escudo genérico entre laureles y letra serif. El retrato grande del alumno en la tapa; la foto de la promoción y el tutor en la contratapa (con el logo del colegio si lo cargó). Adentro, la orla con los compañeros en óvalos. ${DESCRIPCION_MOSAICO}`,
  categoria: "Egresados",
  filtros: { estilo: "Clásico", etiquetas: ["mosaico", "compañeros", "orla", "granate", "dorado", "escudo", "egresados"] },
  etiquetasDeFotos: { ...ETIQUETAS_MOSAICO, maestra: "Foto del tutor o la tutora" },

  fondoExterior: () =>
    svg(
      `${fondo()}${filetes(0)}${filetes(PLIEGUE)}
       ${escudo(CENTRO_DER, 330)}
       ${divisor(CENTRO_DER, 1960, 560)}
       ${divisor(CENTRO_IZQ, 560, 560)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${fondo()}${filetes(0)}${filetes(PLIEGUE)}
       ${divisor(CENTRO_IZQ, 400, 620)}${divisor(CENTRO_DER, 400, 620)}`,
      DEFS,
    ),

  armar: (a) => {
    const serif = (tam: number, color = CREMA, extra = {}) => ({ familia: "Libre Baskerville", tam, color, ...extra });
    const playfair = (tam: number, color = ORO, extra = {}) => ({ familia: "Playfair Display", tam, color, italica: true, ...extra });

    // Contratapa: el logo del colegio (si lo hay), la promoción y el tutor.
    a.logo(0, "logo", centrado(CENTRO_IZQ, 150, 220, 220));
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 395, 1200, 130), "Nuestra promoción", playfair(84));
    a.forma(0, "marco_grupal", "Marco dorado de la grupal", agrandar(GRUPAL, 20), { relleno: ORO });
    a.forma(0, "filete_grupal", "Filete granate de la grupal", agrandar(GRUPAL, 11), { relleno: GRANATE });
    a.foto(0, "grupal", GRUPAL);
    a.forma(0, "marco_maestra", "Marco dorado del tutor", agrandar(TUTOR, 16), { relleno: ORO });
    a.forma(0, "filete_maestra", "Filete granate del tutor", agrandar(TUTOR, 8), { relleno: GRANATE });
    a.foto(0, "maestra", TUTOR);
    a.texto(0, "titulo_maestra", "Título del tutor", { x: TUTOR.x + TUTOR.w + 100, y: 1640, w: 680, h: 120 }, "Nuestro tutor", playfair(84, ORO, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Curso y colegio", { x: TUTOR.x + TUTOR.w + 100, y: 1790, w: 680, h: 230 }, "course.withSchool", "Curso - Colegio", serif(42, CREMA, { alinear: "LEFT", interlineado: 1.45 }));

    // Tapa: escudo, el retrato en marco dorado y los datos.
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 560, 1300, 90), "Promoción 2026", serif(54, ORO, { mayus: "uppercase" }));
    a.forma(0, "marco_retrato", "Marco dorado del retrato", agrandar(RETRATO, 24), { relleno: ORO });
    a.forma(0, "filete_retrato", "Filete granate del retrato", agrandar(RETRATO, 13), { relleno: GRANATE });
    a.foto(0, "individual", RETRATO);
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1755, 1400, 160), "student.fullName", "Nombre del alumno", playfair(108, CREMA, { interlineado: 1.05 }));
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 2010, 1300, 70), "course.displayName", "Curso", serif(42, ORO, { mayus: "uppercase" }));
    a.variable(0, "colegio", "Colegio", centrado(CENTRO_DER, 2085, 1300, 130), "school.name", "Colegio", serif(42, CREMA, { interlineado: 1.3 }));

    // Interior: la orla.
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 200, 1300, 150), "Compañeros de promoción", playfair(100));
    a.variable(1, "colegio_mosaico", "Colegio", centrado(CENTRO_DER, 240, 1300, 100), "school.name", "Colegio", serif(50, CREMA, { mayus: "uppercase" }));
    mosaicoEnDosPaginas(a, 480, 1720, { familia: "Crimson Text", tam: 40, color: CREMA, interlineado: 1.05 }, {
      frame: "ellipse",
      photoAspect: 0.78,
      gapX: 40,
      gapY: 26,
      borderWidth: 0,
      shadow: null,
      namePosition: "below",
      nameLines: 2,
      givenNames: "all",
    });
  },
};
