import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, agrandar, centrado } from "../lienzo";
import { confeti, filtroGrano, grano, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Globos: cielo clarito con globos de colores y confeti. El retrato de la
 * tapa es un círculo con aro amarillo, como un globo más; adentro, el mosaico en círculos con una
 * sombra amarilla corrida.
 */

const TINTA = "#34325c";
const CORAL = "#ff6b6b";
const AMARILLO = "#ffc93c";
const COLORES = ["#ff6b6b", "#ffc93c", "#4ecdc4", "#5c7cfa", "#c77dff", "#ff9f43"];

const RETRATO = centrado(CENTRO_DER, 300, 1060, 1060);
const GRUPAL = centrado(CENTRO_IZQ, 400, 1400, 930);
const MAESTRA = { x: 300, y: 1530, w: 520, h: 520 };

const DEFS = `<linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#dff3ff"/><stop offset="1" stop-color="#fffaf0"/></linearGradient>
  <radialGradient id="brillo" cx="0.35" cy="0.3" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  ${filtroGrano("g", 0.85)}`;

/** Un globo con su nudito, su brillo y el hilo ondulado. `r` = radio horizontal. */
function globo(cx: number, cy: number, r: number, color: string, hilo = 2.2) {
  const ry = r * 1.2;
  const base = cy + ry;
  const largo = r * hilo;
  return `<g>
    <path d="M ${cx} ${base + 18} q ${r * 0.25} ${largo * 0.25} 0 ${largo * 0.5} t 0 ${largo * 0.5}" stroke="#8a8aa8" stroke-width="5" fill="none"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry}" fill="${color}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry}" fill="url(#brillo)"/>
    <ellipse cx="${cx - r * 0.38}" cy="${cy - ry * 0.42}" rx="${r * 0.14}" ry="${r * 0.26}" fill="#ffffff" opacity="0.6" transform="rotate(25 ${cx - r * 0.38} ${cy - ry * 0.42})"/>
    <polygon points="${cx - r * 0.13},${base + 22} ${cx + r * 0.13},${base + 22} ${cx},${base - 4}" fill="${color}"/>
  </g>`;
}

export const mosaicoJardinGlobos: Modelo = {
  slug: "mosaico-jardin-globos",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Globos",
  descripcion: `Carpeta 30×20 cm para jardín: cielo clarito con globos de colores y confeti, como una fiesta. El retrato grande del alumno en un círculo en la tapa; la foto grupal y la seño en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Jardín",
  filtros: { estilo: "Divertido", etiquetas: ["mosaico", "compañeros", "globos", "confeti", "fiesta", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () => {
    const evitar = [agrandar(RETRATO, 120), agrandar(GRUPAL, 80), { x: 1900, y: 1450, w: 1520, h: 700 }, { x: 200, y: 1450, w: 1450, h: 700 }, { x: 200, y: 100, w: 1350, h: 260 }];
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="url(#cielo)"/>
       ${confeti({ x: 60, y: 60, w: ANCHO - 120, h: ALTO - 120 }, 170, COLORES, 4, [14, 30], evitar)}
       ${globo(2010, 330, 120, COLORES[2]!)}${globo(3380, 470, 105, COLORES[3]!)}${globo(1985, 1130, 70, COLORES[4]!, 1.6)}
       ${globo(3330, 1050, 90, COLORES[0]!, 1.8)}
       ${globo(300, 190, 70, COLORES[1]!, 0.8)}${globo(1470, 190, 70, COLORES[4]!, 0.8)}
       ${grano("g", 0.04)}`,
      DEFS,
    );
  },

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="url(#cielo)"/>
       ${confeti({ x: 40, y: 40, w: ANCHO - 80, h: 220 }, 70, COLORES, 9, [12, 26], [{ x: 300, y: 60, w: 1200, h: 220 }, { x: 2050, y: 60, w: 1200, h: 220 }])}
       ${confeti({ x: 40, y: ALTO - 120, w: ANCHO - 80, h: 80 }, 40, COLORES, 13, [12, 24])}
       ${globo(150, 150, 70, COLORES[0]!, 1.2)}${globo(ANCHO - 150, 150, 70, COLORES[2]!, 1.2)}
       ${grano("g", 0.04)}`,
      DEFS,
    ),

  armar: (a) => {
    const fiesta = (tam: number, color = CORAL, extra = {}) => ({ familia: "Pacifico", tam, color, ...extra });
    const redonda = (tam: number, color = TINTA, extra = {}) => ({ familia: "Quicksand", tam, color, peso: 700, ...extra });

    // Contratapa
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 130, 1300, 220), "¡Qué fiesta!", fiesta(120, CORAL));
    a.forma(0, "sombra_grupal", "Sombra de la foto grupal", { ...agrandar(GRUPAL, 24), x: GRUPAL.x - 24 + 26, y: GRUPAL.y - 24 + 26 }, { relleno: AMARILLO, radio: 50 });
    a.forma(0, "marco_grupal", "Marco de la foto grupal", agrandar(GRUPAL, 24), { relleno: "#ffffff", radio: 50 });
    a.foto(0, "grupal", GRUPAL, { radio: 34 });
    a.forma(0, "aro_maestra", "Aro de la seño", agrandar(MAESTRA, 36), { relleno: COLORES[2]!, circulo: true });
    a.forma(0, "marco_maestra", "Marco de la seño", agrandar(MAESTRA, 18), { relleno: "#ffffff", circulo: true });
    a.foto(0, "maestra", MAESTRA, { mascara: "circle" });
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 940, y: 1580, w: 640, h: 200 }, "Nuestra seño", fiesta(96, COLORES[3]!, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Sala y jardín", { x: 940, y: 1800, w: 640, h: 260 }, "course.withSchool", "Sala - Jardín", redonda(62, TINTA, { alinear: "LEFT", interlineado: 1.2 }));

    // Tapa: el retrato como un globo.
    a.forma(0, "aro_retrato", "Aro del retrato", agrandar(RETRATO, 50), { relleno: AMARILLO, circulo: true });
    a.forma(0, "marco_retrato", "Marco del retrato", agrandar(RETRATO, 26), { relleno: "#ffffff", circulo: true });
    a.foto(0, "individual", RETRATO, { mascara: "circle" });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1490, 1420, 250), "student.fullName", "Nombre del alumno", fiesta(110, CORAL, { interlineado: 1.1 }));
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER, 1760, 1300, 140), "course.displayName", "Sala", redonda(90, TINTA));
    a.variable(0, "colegio", "Jardín", centrado(CENTRO_DER, 1900, 1300, 110), "school.name", "Jardín", redonda(62, "#6c6a9a", { peso: 600 }));
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 2030, 600, 110), "2026", redonda(70, COLORES[3]!));

    // Interior
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 70, 1300, 230), "Mis compañeros", fiesta(108, CORAL));
    a.variable(1, "sala", "Sala", centrado(CENTRO_DER, 70, 1300, 230), "course.displayName", "Sala", fiesta(108, COLORES[3]!));
    mosaicoEnDosPaginas(a, 330, 1880, redonda(50, TINTA), {
      frame: "circle",
      gapX: 60,
      gapY: 36,
      borderWidth: 10,
      borderColor: "#ffffff",
      shadow: { dx: 16, dy: 16, color: AMARILLO },
      namePosition: "below",
      nameLines: 1,
      givenNames: "first",
    });
  },
};
