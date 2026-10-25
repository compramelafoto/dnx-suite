import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, agrandar, centrado, type Armador, type Rect } from "../lienzo";
import { puntos, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Útiles escolares: papel crema con lápices, regla, globo terráqueo, manzana
 * y libros dibujados en plano, sin contornos. Las fotos llevan un recuadro de color corrido
 * detrás (como una sombra sólida); el mosaico, lo mismo.
 */

const CREMA = "#fbf5e6";
const TINTA = "#2d3142";
const CORAL = "#ef6f5a";
const MOSTAZA = "#f2b632";
const VERDE_AGUA = "#2a9d8f";
const AZUL = "#3d7dd8";

/**
 * Lápiz acostado, de goma a punta, con la punta hacia la derecha antes de girar. `(x, y)` es el
 * centro de la goma; `giro` en grados. `mina` es el color de la punta (gris para el de grafito).
 */
export function lapiz(x: number, y: number, largo: number, grueso: number, giro: number, cuerpo: string, mina = "#3b3b45", goma = "#f29bb0") {
  const L = largo;
  const T = grueso;
  const m = T / 2;
  return `<g transform="translate(${x} ${y}) rotate(${giro}) translate(0 ${-m})">
    <rect x="0" y="0" width="${0.09 * L}" height="${T}" rx="${T * 0.22}" fill="${goma}"/>
    <rect x="${0.08 * L}" y="${-T * 0.03}" width="${0.07 * L}" height="${T * 1.06}" fill="#c9ccd3"/>
    <path d="M ${0.1 * L} ${-T * 0.03} v ${T * 1.06} M ${0.13 * L} ${-T * 0.03} v ${T * 1.06}" stroke="#a5a9b3" stroke-width="${T * 0.05}"/>
    <rect x="${0.15 * L}" y="0" width="${0.68 * L}" height="${T}" fill="${cuerpo}"/>
    <rect x="${0.15 * L}" y="0" width="${0.68 * L}" height="${T / 3}" fill="#ffffff" opacity="0.22"/>
    <rect x="${0.15 * L}" y="${(2 * T) / 3}" width="${0.68 * L}" height="${T / 3}" fill="#000000" opacity="0.12"/>
    <polygon points="${0.83 * L},0 ${L},${m} ${0.83 * L},${T}" fill="#f1c98f"/>
    <polygon points="${0.83 * L},0 ${L},${m} ${0.83 * L},${T / 3}" fill="#ffffff" opacity="0.25"/>
    <polygon points="${0.945 * L},${m - T * 0.16} ${L},${m} ${0.945 * L},${m + T * 0.16}" fill="${mina}"/>
  </g>`;
}

/** Regla amarilla con rayitas. */
function regla(x: number, y: number, largo: number, alto: number, giro: number) {
  let marcas = "";
  const n = 30;
  for (let i = 1; i < n; i++) {
    const px = (largo * i) / n;
    const h = i % 5 === 0 ? alto * 0.45 : alto * 0.25;
    marcas += `<line x1="${px.toFixed(1)}" y1="0" x2="${px.toFixed(1)}" y2="${h.toFixed(1)}"/>`;
  }
  return `<g transform="translate(${x} ${y}) rotate(${giro})">
    <rect width="${largo}" height="${alto}" rx="${alto * 0.08}" fill="#f6d36b"/>
    <rect y="${alto * 0.72}" width="${largo}" height="${alto * 0.28}" rx="${alto * 0.08}" fill="#e2b94a"/>
    <g stroke="#7a5a1c" stroke-width="${alto * 0.035}">${marcas}</g>
    <circle cx="${largo * 0.05}" cy="${alto * 0.6}" r="${alto * 0.08}" fill="${CREMA}"/>
  </g>`;
}

/** Globo terráqueo en su pie. `id` tiene que ser único en la página (recorte de los continentes). */
function globo(id: string, cx: number, cy: number, r: number) {
  return `<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
    <ellipse cx="${cx}" cy="${cy + r * 1.62}" rx="${r * 0.62}" ry="${r * 0.14}" fill="#7a5638"/>
    <rect x="${cx - r * 0.07}" y="${cy + r * 1.15}" width="${r * 0.14}" height="${r * 0.45}" fill="#9b7049"/>
    <path d="M ${cx - r * 1.05} ${cy + r * 0.62} A ${r * 1.22} ${r * 1.22} 0 0 0 ${cx + r * 0.62} ${cy + r * 1.05}" stroke="#b5884f" stroke-width="${r * 0.1}" fill="none" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#5aaee8"/>
    <g clip-path="url(#${id})" fill="#72c46d">
      <path d="M ${cx - r * 0.7} ${cy - r * 0.55} q ${r * 0.35} ${-r * 0.3} ${r * 0.62} ${-r * 0.05} q ${r * 0.1} ${r * 0.3} ${-r * 0.15} ${r * 0.45} q ${-r * 0.05} ${r * 0.3} ${r * 0.12} ${r * 0.55} q ${-r * 0.1} ${r * 0.3} ${-r * 0.35} ${r * 0.1} q ${-r * 0.15} ${-r * 0.4} ${-r * 0.45} ${-r * 0.5} q ${-r * 0.1} ${-r * 0.3} ${r * 0.21} ${-r * 0.55} Z"/>
      <path d="M ${cx + r * 0.25} ${cy - r * 0.7} q ${r * 0.4} ${-r * 0.05} ${r * 0.6} ${r * 0.25} q ${r * 0.1} ${r * 0.3} ${-r * 0.1} ${r * 0.4} q ${r * 0.15} ${r * 0.3} ${-r * 0.05} ${r * 0.65} q ${-r * 0.25} ${r * 0.1} ${-r * 0.3} ${-r * 0.25} q ${-r * 0.05} ${-r * 0.35} ${-r * 0.2} ${-r * 0.5} q ${-r * 0.1} ${-r * 0.35} ${r * 0.05} ${-r * 0.55} Z"/>
      <ellipse cx="${cx + r * 0.1}" cy="${cy + r * 0.92}" rx="${r * 0.7}" ry="${r * 0.14}" fill="#ffffff" opacity="0.9"/>
    </g>
    <ellipse cx="${cx - r * 0.38}" cy="${cy - r * 0.42}" rx="${r * 0.22}" ry="${r * 0.12}" transform="rotate(-35 ${cx - r * 0.38} ${cy - r * 0.42})" fill="#ffffff" opacity="0.35"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#3f8fcc" stroke-width="${r * 0.03}"/>`;
}

/** Manzana roja con hojita. */
function manzana(cx: number, cy: number, s: number) {
  const P = (dx: number, dy: number) => `${(cx + dx * s).toFixed(1)} ${(cy + dy * s).toFixed(1)}`;
  return `<path d="M ${P(0, -0.35)} C ${P(-0.25, -0.55)} ${P(-0.6, -0.45)} ${P(-0.6, -0.05)} C ${P(-0.6, 0.4)} ${P(-0.3, 0.62)} ${P(-0.12, 0.56)} C ${P(-0.05, 0.52)} ${P(0.05, 0.52)} ${P(0.12, 0.56)} C ${P(0.3, 0.62)} ${P(0.6, 0.4)} ${P(0.6, -0.05)} C ${P(0.6, -0.45)} ${P(0.25, -0.55)} ${P(0, -0.35)} Z" fill="#e5483d"/>
    <path d="M ${P(0.12, -0.38)} C ${P(0.42, -0.45)} ${P(0.55, -0.2)} ${P(0.5, 0.1)}" stroke="#c4352c" stroke-width="${s * 0.04}" fill="none" opacity="0.6"/>
    <ellipse cx="${cx - s * 0.33}" cy="${cy - s * 0.12}" rx="${s * 0.08}" ry="${s * 0.17}" transform="rotate(20 ${cx - s * 0.33} ${cy - s * 0.12})" fill="#ffffff" opacity="0.4"/>
    <path d="M ${P(0, -0.36)} Q ${P(0.02, -0.52)} ${P(0.08, -0.64)}" stroke="#6b4423" stroke-width="${s * 0.06}" fill="none" stroke-linecap="round"/>
    <path d="M ${P(0.06, -0.52)} C ${P(0.2, -0.75)} ${P(0.45, -0.72)} ${P(0.5, -0.62)} C ${P(0.38, -0.48)} ${P(0.18, -0.46)} ${P(0.06, -0.52)} Z" fill="#5cb85c"/>`;
}

/** Pila de libros. `(x, y)` es la esquina de abajo a la izquierda. */
function libros(x: number, y: number, w: number) {
  const capas = [
    { c: AZUL, dx: 0, w: w, h: w * 0.2 },
    { c: MOSTAZA, dx: w * 0.06, w: w * 0.86, h: w * 0.17 },
    { c: VERDE_AGUA, dx: -w * 0.03, w: w * 0.94, h: w * 0.19 },
  ];
  let out = "";
  let yy = y;
  for (const k of capas) {
    yy -= k.h;
    out += `<rect x="${x + k.dx}" y="${yy}" width="${k.w}" height="${k.h}" rx="${k.h * 0.12}" fill="${k.c}"/>
      <rect x="${x + k.dx + k.w * 0.9}" y="${yy + k.h * 0.12}" width="${k.w * 0.08}" height="${k.h * 0.76}" fill="#fffaf0"/>
      <rect x="${x + k.dx + k.w * 0.12}" y="${yy + k.h * 0.38}" width="${k.w * 0.4}" height="${k.h * 0.24}" fill="#ffffff" opacity="0.5"/>`;
  }
  return out;
}

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>${puntos({ x: 40, y: 40, w: ANCHO - 80, h: ALTO - 80 }, 90, 5, "#e3d9bf", 0.9)}`;
}

/** Foto con borde blanco y el recuadro de color corrido detrás. */
function fotoConColor(a: Armador, clave: string, rol: "individual" | "grupal" | "maestra", r: Rect, color: string, corrido: number) {
  const borde = agrandar(r, 18);
  a.forma(0, `color_${clave}`, "Recuadro de color", { ...borde, x: borde.x + corrido, y: borde.y + corrido }, { relleno: color });
  a.forma(0, `marco_${clave}`, "Borde de la foto", borde, { relleno: "#ffffff" });
  a.foto(0, rol, r);
}

const RETRATO = centrado(CENTRO_DER, 380, 980, 1220);
const GRUPAL = centrado(CENTRO_IZQ, 380, 1320, 880);
const MAESTRA = { x: 240, y: 1440, w: 440, h: 540 };

export const mosaicoPrimariaUtiles: Modelo = {
  slug: "mosaico-primaria-utiles",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Útiles escolares",
  descripcion: `Carpeta 30×20 cm para primaria: papel crema con lápices, regla, globo terráqueo, manzana y libros dibujados; cada foto con un recuadro de color corrido detrás. El retrato del alumno en la tapa; la foto grupal y la seño en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Primaria",
  filtros: { estilo: "Moderno", etiquetas: ["mosaico", "compañeros", "útiles", "escuela", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `${papel()}
       ${globo("g1", 3310, 1980, 125)}
       ${manzana(2040, 2060, 230)}
       ${lapiz(2220, 2210, 720, 70, -6, MOSTAZA)}
       ${libros(1240, 2250, 400)}
       ${regla(90, 2235, 720, 92, -4)}
       ${lapiz(830, 2130, 360, 50, 8, CORAL)}`,
    ),

  fondoInterior: () =>
    svg(
      `${papel()}
       ${manzana(210, 200, 170)}
       ${lapiz(CENTRO_IZQ - 330, 290, 660, 34, 0, CORAL)}
       ${lapiz(CENTRO_DER - 330, 290, 660, 34, 0, VERDE_AGUA)}
       ${globo("g2", 3360, 175, 82)}
       ${regla(160, 2190, 900, 90, 0)}
       ${lapiz(1170, 2235, 460, 60, 0, AZUL)}
       ${libros(1990, 2290, 330)}
       ${lapiz(2440, 2235, 460, 60, 0, MOSTAZA)}
       ${manzana(3240, 2215, 150)}`,
    ),

  armar: (a) => {
    const letra = (tam: number, color = TINTA, extra = {}) => ({ familia: "Nunito", tam, color, peso: 700, ...extra });

    // Contratapa.
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 140, 1400, 170), "¡Nuestro grado!", letra(120, TINTA));
    fotoConColor(a, "grupal", "grupal", GRUPAL, VERDE_AGUA, 30);
    fotoConColor(a, "maestra", "maestra", MAESTRA, MOSTAZA, 24);
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 780, y: 1520, w: 860, h: 150 }, "Nuestra seño", letra(104, CORAL, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Grado y escuela", { x: 780, y: 1690, w: 860, h: 240 }, "course.withSchool", "Grado - Escuela", letra(56, TINTA, { alinear: "LEFT", interlineado: 1.2, peso: 400 }));

    // Tapa.
    a.variable(0, "curso", "Grado", centrado(CENTRO_DER, 150, 1450, 150), "course.displayName", "Grado", letra(104, CORAL));
    fotoConColor(a, "retrato", "individual", RETRATO, CORAL, 36);
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1700, 1450, 170), "student.fullName", "Nombre del alumno", letra(118, TINTA, { interlineado: 1 }));
    a.variable(0, "colegio", "Escuela", centrado(CENTRO_DER, 1870, 1100, 110), "school.name", "Escuela", letra(62, AZUL));

    // Interior.
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 90, 1100, 170), "Mis compañeros", letra(112, TINTA));
    a.texto(1, "anio", "Año", centrado(CENTRO_DER, 90, 1100, 170), "Ciclo lectivo 2026", letra(96, CORAL));
    mosaicoEnDosPaginas(a, 330, 1790, letra(42, TINTA, { interlineado: 1.05 }), {
      frame: "rect",
      photoAspect: 0.78,
      gapX: 52,
      gapY: 34,
      borderWidth: 8,
      borderColor: "#ffffff",
      shadow: { dx: 14, dy: 14, color: CORAL },
      namePosition: "below",
      nameLines: 2,
      givenNames: "first",
    });
  },
};
