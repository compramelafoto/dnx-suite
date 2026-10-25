import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Armador, type Rect } from "../lienzo";
import { svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import { cruz, degradadoLuz, degradadoOro, filete, rayos } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Colegio católico: blanco con un velo celeste abajo, doble filete dorado en
 * cada página, esquinas con adorno y una cruz tenue con rayos de luz. Adentro, los compañeros en
 * óvalos limpios (sin borde ni sombra) con los nombres en letra con serifa.
 */

const AZUL = "#2c4a6e";
const CELESTE = "#9ccbea";
const ORO = "#c9a24f";
const ORO_OSCURO = "#9a7430";

const DEFS = `${degradadoOro("oro")}
  ${degradadoLuz("luz", "#ffffff", 0.9)}
  <linearGradient id="velo" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f4f9fd"/><stop offset="1" stop-color="#d6eaf8"/>
  </linearGradient>`;

/** Esquinero dorado: dos filetes en ángulo con un rombito y un punto. `sx`, `sy` = hacia dónde abre. */
function esquinero(x: number, y: number, sx: 1 | -1, sy: 1 | -1) {
  const l = 150;
  return `<g stroke="${ORO}" fill="none" stroke-linecap="round">
      <path d="M ${x} ${y + sy * l} V ${y} H ${x + sx * l}" stroke-width="7"/>
      <path d="M ${x + sx * 26} ${y + sy * (l - 40)} V ${y + sy * 26} H ${x + sx * (l - 40)}" stroke-width="3"/>
      <path d="M ${x + sx * 26} ${y + sy * 26} q ${sx * 60} ${sy * 4} ${sx * 70} ${sy * 70} q ${-sx * 66} ${-sy * 10} ${-sx * 70} ${-sy * 70} Z" stroke-width="3"/>
    </g>
    <rect x="${x - 13}" y="${y - 13}" width="26" height="26" fill="url(#oro)" transform="rotate(45 ${x} ${y})"/>`;
}

/** Marco de página: doble filete dorado con esquineros, de `x0` a `x1`. */
function marcoPagina(x0: number, x1: number) {
  const m = 72;
  const a = x0 + m;
  const b = x1 - m;
  const t = m;
  const u = ALTO - m;
  return `<rect x="${a}" y="${t}" width="${b - a}" height="${u - t}" fill="none" stroke="${ORO}" stroke-width="5"/>
    <rect x="${a + 18}" y="${t + 18}" width="${b - a - 36}" height="${u - t - 36}" fill="none" stroke="${ORO}" stroke-width="2" opacity="0.8"/>
    ${esquinero(a, t, 1, 1)}${esquinero(b, t, -1, 1)}${esquinero(a, u, 1, -1)}${esquinero(b, u, -1, -1)}`;
}

function base() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="url(#velo)"/>
    <path d="M 0 ${ALTO - 330} C ${ANCHO * 0.25} ${ALTO - 420} ${ANCHO * 0.4} ${ALTO - 250} ${ANCHO * 0.5} ${ALTO - 300} S ${ANCHO * 0.8} ${ALTO - 410} ${ANCHO} ${ALTO - 320} V ${ALTO} H 0 Z" fill="${CELESTE}" opacity="0.16"/>
    <path d="M 0 ${ALTO - 220} C ${ANCHO * 0.2} ${ALTO - 300} ${ANCHO * 0.42} ${ALTO - 160} ${ANCHO * 0.55} ${ALTO - 210} S ${ANCHO * 0.85} ${ALTO - 290} ${ANCHO} ${ALTO - 200} V ${ALTO} H 0 Z" fill="${CELESTE}" opacity="0.18"/>
    ${marcoPagina(0, PLIEGUE)}${marcoPagina(PLIEGUE, ANCHO)}`;
}

/** Foto con filete dorado y paspartú blanco. */
function fotoConFilete(a: Armador, clave: string, rol: "individual" | "grupal" | "maestra", r: Rect) {
  a.forma(0, `sombra_${clave}`, "Sombra suave", { ...agrandar(r, 30), x: r.x - 30 + 8, y: r.y - 30 + 12 }, { relleno: AZUL, opacidad: 0.12, radio: 8 });
  a.forma(0, `marco_${clave}`, "Filete dorado", agrandar(r, 30), { relleno: ORO, radio: 8 });
  a.forma(0, `paspartu_${clave}`, "Paspartú", agrandar(r, 24), { relleno: "#ffffff", radio: 4 });
  a.foto(0, rol, r);
}

const RETRATO = centrado(CENTRO_DER, 520, 860, 1060);
const GRUPAL = centrado(CENTRO_IZQ, 420, 1240, 800);
const MAESTRA = { x: 290, y: 1440, w: 400, h: 500 };

export const mosaicoReligiosoColegioCatolico: Modelo = {
  slug: "mosaico-religioso-colegio-catolico",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Colegio católico",
  descripcion: `Carpeta 30×20 cm para colegios católicos: blanco, celeste y dorado suave, con doble filete dorado y una cruz tenue con rayos de luz. El retrato del alumno en la tapa; la foto grupal y la maestra en la contratapa. Adentro, los compañeros en óvalos con los nombres en letra con serifa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Religioso",
  filtros: { estilo: "Clásico", etiquetas: ["mosaico", "compañeros", "colegio católico", "cruz", "celeste", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `${base()}
       <circle cx="${CENTRO_DER}" cy="250" r="330" fill="url(#luz)"/>
       ${rayos(CENTRO_DER, 250, 70, 300, 28, ORO, 0.22, 0.04)}
       ${cruz(CENTRO_DER, 250, 150, 22, "url(#oro)")}
       ${cruz(1400, 1960, 520, 64, CELESTE).replace("<g ", '<g opacity="0.22" ')}
       ${filete(CENTRO_DER, 1735, 560, ORO, 3)}
       ${filete(CENTRO_IZQ, 300, 520, ORO, 3)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${base()}
       ${filete(CENTRO_IZQ, 300, 600, ORO, 3)}
       ${filete(CENTRO_DER, 300, 600, ORO, 3)}
       ${cruz(CENTRO_IZQ, 2190, 90, 14, "url(#oro)")}
       ${cruz(CENTRO_DER, 2190, 90, 14, "url(#oro)")}`,
      DEFS,
    ),

  armar: (a) => {
    const serif = (tam: number, color = AZUL, extra = {}) => ({ familia: "Playfair Display", tam, color, ...extra });
    const libro = (tam: number, color = AZUL, extra = {}) => ({ familia: "Libre Baskerville", tam, color, ...extra });

    // Contratapa.
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 150, 1300, 150), "Nuestro curso", serif(104, AZUL, { italica: true }));
    fotoConFilete(a, "grupal", "grupal", GRUPAL);
    fotoConFilete(a, "maestra", "maestra", MAESTRA);
    a.texto(0, "titulo_maestra", "Título de la maestra", { x: 790, y: 1520, w: 800, h: 140 }, "Nuestra maestra", serif(88, AZUL, { italica: true, alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Grado y escuela", { x: 790, y: 1690, w: 800, h: 230 }, "course.withSchool", "Grado - Escuela", libro(48, ORO_OSCURO, { alinear: "LEFT", interlineado: 1.35 }));

    // Tapa.
    a.variable(0, "curso", "Grado", centrado(CENTRO_DER, 400, 1300, 100), "course.displayName", "Grado", libro(58, ORO_OSCURO, { mayus: "uppercase" }));
    fotoConFilete(a, "retrato", "individual", RETRATO);
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1770, 1450, 160), "student.fullName", "Nombre del alumno", serif(108, AZUL, { interlineado: 1 }));
    a.variable(0, "colegio", "Escuela", centrado(CENTRO_DER, 1940, 1300, 100), "school.name", "Escuela", libro(52, AZUL, { italica: true }));
    a.texto(0, "anio_tapa", "Año", centrado(CENTRO_DER, 2050, 600, 90), "2026", libro(52, ORO_OSCURO));

    // Interior.
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 140, 1200, 140), "Mis compañeros", serif(100, AZUL, { italica: true }));
    a.texto(1, "anio", "Año", centrado(CENTRO_DER, 140, 1200, 140), "Ciclo lectivo 2026", serif(92, AZUL, { italica: true }));
    mosaicoEnDosPaginas(a, 360, 1750, libro(36, AZUL, { interlineado: 1.1 }), {
      frame: "ellipse",
      photoAspect: 0.76,
      gapX: 46,
      gapY: 30,
      borderWidth: 0,
      shadow: null,
      namePosition: "below",
      nameLines: 2,
      givenNames: "first",
    });
  },
};
