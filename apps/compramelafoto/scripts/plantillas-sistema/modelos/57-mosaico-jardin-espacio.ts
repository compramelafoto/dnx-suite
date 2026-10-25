import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { azar, estrella, filtroGrano, filtroNube, grano, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Espacio: cielo azul profundo con estrellas, planetas de colores y un cohete.
 * El retrato de la tapa va en una ventanita redonda de nave espacial; adentro, el mosaico en
 * polaroids blancas apenas giradas, con textos claros sobre el azul.
 */

const CLARO = "#f4f1ff";
const AMARILLO = "#ffd95a";
const CELESTE = "#7fd6ff";
const NAVE = "#c9d3e6";
const TINTA = "#1f2552";

const RETRATO = centrado(CENTRO_DER, 280, 1060, 1060);
const GRUPAL = centrado(CENTRO_IZQ, 400, 1400, 930);
const MAESTRA = { x: 300, y: 1520, w: 520, h: 520 };

const DEFS = `<radialGradient id="cosmos" cx="0.5" cy="0.45" r="0.8">
    <stop offset="0" stop-color="#26306b"/><stop offset="0.6" stop-color="#141a45"/><stop offset="1" stop-color="#0b0f2e"/></radialGradient>
  ${filtroNube("neb", 4, 60)}${filtroGrano("g", 0.85)}`;

function cielo() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="url(#cosmos)"/>
    <g filter="url(#neb)" opacity="0.4">
      <ellipse cx="700" cy="500" rx="700" ry="300" fill="#7b4fd6"/>
      <ellipse cx="2900" cy="1900" rx="700" ry="320" fill="#2a8fd6"/>
      <ellipse cx="2400" cy="300" rx="500" ry="220" fill="#d65fa8"/>
    </g>`;
}

function estrellas(semilla: number, n: number) {
  const a = azar(semilla);
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = a.entre(20, ANCHO - 20);
    const y = a.entre(20, ALTO - 20);
    const r = a.r() < 0.85 ? a.entre(2, 5) : a.entre(6, 9);
    out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="#ffffff" opacity="${a.entre(0.4, 1).toFixed(2)}"/>`;
  }
  return out;
}

function destellos(puntos: Array<[number, number, number]>) {
  return puntos.map(([x, y, r]) => `<polygon points="${estrella(x, y, r, 4, 0.22)}" fill="${AMARILLO}"/>`).join("");
}

/** Planeta con sombra y, si se pide, anillo. */
function planeta(cx: number, cy: number, r: number, color: string, sombra: string, anillo?: string) {
  const ani = (frente: boolean) =>
    anillo
      ? `<path d="M ${cx - r * 1.7} ${cy} A ${r * 1.7} ${r * 0.42} 0 0 ${frente ? 0 : 1} ${cx + r * 1.7} ${cy}" stroke="${anillo}" stroke-width="${r * 0.16}" fill="none" transform="rotate(-18 ${cx} ${cy})"/>`
      : "";
  return `<g>${ani(false)}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>
    <path d="M ${cx + r * 0.2} ${cy - r * 0.98} A ${r} ${r} 0 0 1 ${cx + r * 0.2} ${cy + r * 0.98} A ${r * 0.85} ${r} 0 0 0 ${cx + r * 0.2} ${cy - r * 0.98} Z" fill="${sombra}" opacity="0.55"/>
    <circle cx="${cx - r * 0.35}" cy="${cy - r * 0.2}" r="${r * 0.14}" fill="${sombra}" opacity="0.5"/><circle cx="${cx - r * 0.05}" cy="${cy + r * 0.4}" r="${r * 0.09}" fill="${sombra}" opacity="0.5"/>
    ${ani(true)}</g>`;
}

/** Cohete inclinado con su fuego. `s` = medio ancho del cuerpo. */
function cohete(x: number, y: number, s: number, giro: number) {
  return `<g transform="rotate(${giro} ${x} ${y})">
    <path d="M ${x - s * 0.55} ${y + s * 2.2} Q ${x} ${y + s * 4.4} ${x + s * 0.55} ${y + s * 2.2} Z" fill="#ff9f1c"/>
    <path d="M ${x - s * 0.3} ${y + s * 2.2} Q ${x} ${y + s * 3.4} ${x + s * 0.3} ${y + s * 2.2} Z" fill="${AMARILLO}"/>
    <path d="M ${x - s} ${y + s * 1.2} L ${x - s * 1.7} ${y + s * 2.4} L ${x - s * 0.8} ${y + s * 2.1} Z" fill="#ff5d73"/>
    <path d="M ${x + s} ${y + s * 1.2} L ${x + s * 1.7} ${y + s * 2.4} L ${x + s * 0.8} ${y + s * 2.1} Z" fill="#ff5d73"/>
    <path d="M ${x} ${y - s * 2.6} C ${x + s * 1.3} ${y - s * 1.5} ${x + s * 1.1} ${y + s * 1.2} ${x + s * 0.8} ${y + s * 2.2} L ${x - s * 0.8} ${y + s * 2.2} C ${x - s * 1.1} ${y + s * 1.2} ${x - s * 1.3} ${y - s * 1.5} ${x} ${y - s * 2.6} Z" fill="#f4f6fb"/>
    <path d="M ${x} ${y - s * 2.6} C ${x + s * 0.6} ${y - s * 2.1} ${x + s * 0.85} ${y - s * 1.6} ${x + s * 0.95} ${y - s * 1.3} L ${x - s * 0.95} ${y - s * 1.3} C ${x - s * 0.85} ${y - s * 1.6} ${x - s * 0.6} ${y - s * 2.1} ${x} ${y - s * 2.6} Z" fill="#ff5d73"/>
    <circle cx="${x}" cy="${y - s * 0.2}" r="${s * 0.5}" fill="${CELESTE}" stroke="#8f9bb8" stroke-width="${s * 0.14}"/>
    <rect x="${x - s * 0.15}" y="${y + s * 0.8}" width="${s * 0.3}" height="${s * 1.4}" fill="#ff5d73"/>
  </g>`;
}

export const mosaicoJardinEspacio: Modelo = {
  slug: "mosaico-jardin-espacio",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Espacio",
  descripcion: `Carpeta 30×20 cm para jardín: cielo azul profundo con estrellas, planetas de colores y un cohete. El retrato grande del alumno en una ventanita redonda de nave en la tapa; la foto grupal y la seño en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Jardín",
  filtros: { estilo: "Moderno", etiquetas: ["mosaico", "compañeros", "espacio", "planetas", "cohete", "estrellas", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `${cielo()}
       ${estrellas(3, 420)}
       ${planeta(3330, 1450, 120, "#ff9f6e", "#c7533a", "#ffd95a")}
       ${planeta(1960, 1300, 80, "#7bdcb5", "#2f8f75")}
       ${planeta(1560, 1500, 95, "#b48cff", "#6a45c4", "#7fd6ff")}
       ${cohete(2010, 290, 60, 28)}
       ${destellos([[3380, 200, 46], [1600, 230, 40], [180, 220, 40], [3350, 900, 34], [1580, 2200, 36], [1990, 2220, 40], [3380, 2210, 34]])}
       ${grano("g", 0.03, "screen")}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${cielo()}
       ${estrellas(9, 360)}
       ${planeta(150, 160, 70, "#ff9f6e", "#c7533a")}
       ${planeta(ANCHO - 190, ALTO - 170, 62, "#b48cff", "#6a45c4", "#7fd6ff")}
       ${destellos([[PLIEGUE - 110, 170, 34], [PLIEGUE + 110, 170, 34], [130, ALTO - 120, 30], [ANCHO - 130, 150, 30]])}
       ${grano("g", 0.03, "screen")}`,
      DEFS,
    ),

  armar: (a) => {
    const titulo = (tam: number, color = CLARO, extra = {}) => ({ familia: "Montserrat", tam, color, peso: 800, mayus: "uppercase" as const, ...extra });
    const suave = (tam: number, color = CLARO, extra = {}) => ({ familia: "Quicksand", tam, color, peso: 700, ...extra });

    // Contratapa
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 160, 1300, 150), "Nuestra tripulación", titulo(84, AMARILLO));
    a.forma(0, "marco_grupal", "Marco de la foto grupal", agrandar(GRUPAL, 24), { relleno: CLARO, radio: 40 });
    a.foto(0, "grupal", GRUPAL, { radio: 24 });
    a.forma(0, "aro_maestra", "Aro de la seño", agrandar(MAESTRA, 38), { relleno: NAVE, circulo: true });
    a.forma(0, "marco_maestra", "Marco de la seño", agrandar(MAESTRA, 16), { relleno: "#8f9bb8", circulo: true });
    a.foto(0, "maestra", MAESTRA, { mascara: "circle" });
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 940, y: 1600, w: 680, h: 140 }, "Nuestra seño", titulo(72, AMARILLO, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Sala y jardín", { x: 940, y: 1760, w: 680, h: 260 }, "course.withSchool", "Sala - Jardín", suave(62, CLARO, { alinear: "LEFT", interlineado: 1.2 }));

    // Tapa: el retrato en la ventanita de la nave.
    a.forma(0, "casco_retrato", "Aro de la ventanita", agrandar(RETRATO, 70), { relleno: NAVE, circulo: true });
    a.forma(0, "borde_retrato", "Borde de la ventanita", agrandar(RETRATO, 30), { relleno: "#8f9bb8", circulo: true });
    a.foto(0, "individual", RETRATO, { mascara: "circle" });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1520, 1420, 220), "student.fullName", "Nombre del alumno", suave(110, CLARO, { interlineado: 1.05 }));
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER, 1760, 1300, 130), "course.displayName", "Sala", titulo(72, AMARILLO));
    a.variable(0, "colegio", "Jardín", centrado(CENTRO_DER, 1900, 1300, 110), "school.name", "Jardín", suave(60, CELESTE, { peso: 600 }));
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 2020, 600, 100), "2026", titulo(60, CLARO));

    // Interior
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 110, 1300, 150), "Mis compañeros", titulo(88, AMARILLO));
    a.variable(1, "sala", "Sala", centrado(CENTRO_DER, 115, 1250, 150), "course.displayName", "Sala", titulo(80, CLARO));
    mosaicoEnDosPaginas(a, 320, 1900, suave(46, TINTA), {
      frame: "polaroid",
      photoAspect: 0.72,
      gapX: 40,
      gapY: 34,
      borderWidth: 0,
      tilt: 2,
      shadow: { dx: 12, dy: 12, color: "#0a0d26" },
      namePosition: "below",
      nameLines: 1,
      givenNames: "first",
    });
  },
};
