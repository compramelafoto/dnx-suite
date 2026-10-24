import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, SEGURIDAD, TUBO_PLIEGUE, agrandar, centrado, type Armador, type Rect } from "../lienzo";
import { azar, svg } from "../texturas";
import { ANCHO_MOSAICO, DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Lápices de colores: papel blanco con una hilera de lápices de colores
 * asomando desde abajo y garabatos de color. Adentro, los retratos en recuadros redondeados con
 * borde de color (azul en una página, rojo en la otra) y bastante aire entre ellos.
 */

const TINTA = "#30343f";
const COLORES = ["#e63946", "#f77f00", "#fcbf49", "#8ac926", "#2a9d8f", "#1982c4", "#6a4c93", "#ff6fae"];
const AZUL = "#1982c4";
const ROJO = "#e63946";
const VERDE = "#2a9d8f";
const VIOLETA = "#6a4c93";

/** Un tono más oscuro de un color #rrggbb. */
function oscuro(c: string, k = 0.75) {
  const n = parseInt(c.slice(1), 16);
  const f = (v: number) => Math.round(v * k).toString(16).padStart(2, "0");
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

/** Lápiz de color parado, con la punta hacia arriba en (x, punta); el resto se va por abajo. */
function lapizParado(x: number, punta: number, ancho: number, color: string) {
  const cono = ancho * 1.5;
  const m = ancho / 2;
  const base = punta + cono;
  return `<rect x="${x - m}" y="${base}" width="${ancho}" height="${ALTO - base + 40}" fill="${color}"/>
    <rect x="${x - m}" y="${base}" width="${ancho / 3}" height="${ALTO - base + 40}" fill="#ffffff" opacity="0.25"/>
    <rect x="${x + m - ancho / 3}" y="${base}" width="${ancho / 3}" height="${ALTO - base + 40}" fill="#000000" opacity="0.13"/>
    <polygon points="${x - m},${base} ${x},${punta} ${x + m},${base}" fill="#f2cf9c"/>
    <polygon points="${x - m},${base} ${x},${punta} ${x - m / 3},${base}" fill="#ffffff" opacity="0.3"/>
    <path d="M ${x - m} ${base + 1} q ${m / 2} -16 ${m} 0 q ${m / 2} -16 ${m} 0 Z" fill="${color}"/>
    <polygon points="${x - m * 0.36},${punta + cono * 0.36} ${x},${punta} ${x + m * 0.36},${punta + cono * 0.36}" fill="${oscuro(color, 0.9)}"/>`;
}

/** Una hilera de lápices de colores asomando por el borde de abajo, entre x0 y x1. */
function hilera(x0: number, x1: number, semilla: number, ancho = 64) {
  const a = azar(semilla);
  const n = Math.floor((x1 - x0) / (ancho * 1.55));
  const paso = (x1 - x0) / n;
  let out = "";
  for (let i = 0; i < n; i++) {
    out += lapizParado(x0 + paso * (i + 0.5), ALTO - a.entre(150, 230), ancho, COLORES[(i + semilla) % COLORES.length]!);
  }
  return out;
}

/** Garabato de lápiz: un rulo suelto. */
function rulo(x: number, y: number, s: number, color: string, giro = 0) {
  let d = `M ${x - s} ${y}`;
  for (let i = 0; i < 4; i++) d += ` c ${s * 0.3} ${-s * 0.6} ${s * 0.75} ${-s * 0.4} ${s * 0.45} 0 s ${-s * 0.3} ${s * 0.3} ${s * 0.15} ${s * 0.05}`;
  return `<path d="${d}" stroke="${color}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" transform="rotate(${giro} ${x} ${y})"/>`;
}

/** Subrayado de lápiz: una línea en zigzag suave. */
function subrayado(cx: number, y: number, ancho: number, color: string) {
  let d = `M ${cx - ancho / 2} ${y}`;
  const n = 14;
  for (let i = 1; i <= n; i++) d += ` L ${(cx - ancho / 2 + (ancho * i) / n).toFixed(1)} ${(y + (i % 2 ? -10 : 10)).toFixed(1)}`;
  return `<path d="${d}" stroke="${color}" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`;
}

/** Estrellita de cuatro puntas, como un brillo dibujado. */
function brillo(x: number, y: number, s: number, color: string) {
  return `<path d="M ${x} ${y - s} Q ${x + s * 0.15} ${y - s * 0.15} ${x + s} ${y} Q ${x + s * 0.15} ${y + s * 0.15} ${x} ${y + s} Q ${x - s * 0.15} ${y + s * 0.15} ${x - s} ${y} Q ${x - s * 0.15} ${y - s * 0.15} ${x} ${y - s} Z" fill="${color}"/>`;
}

const PAPEL = `<rect width="${ANCHO}" height="${ALTO}" fill="#ffffff"/>`;

/** Foto con borde de color redondeado. */
function fotoRedonda(a: Armador, clave: string, rol: "individual" | "grupal" | "maestra", r: Rect, color: string) {
  a.forma(0, `marco_${clave}`, "Borde de color", agrandar(r, 22), { relleno: color, radio: 64 });
  a.forma(0, `filete_${clave}`, "Filete blanco", agrandar(r, 8), { relleno: "#ffffff", radio: 50 });
  a.foto(0, rol, r, { radio: 44 });
}

const RETRATO = centrado(CENTRO_DER, 340, 960, 1200);
const GRUPAL = centrado(CENTRO_IZQ, 360, 1300, 860);
const MAESTRA = { x: 250, y: 1390, w: 420, h: 520 };

// Los dos recuadros del mosaico (los mismos de `mosaicoEnDosPaginas`), para darle a cada página
// su color de borde.
const MOSAICO_Y = 330;
const MOSAICO_ALTO = 1760;
const MOSAICO_IZQ = { x: SEGURIDAD + 70, y: MOSAICO_Y, w: ANCHO_MOSAICO, h: MOSAICO_ALTO };
const MOSAICO_DER = { x: PLIEGUE + TUBO_PLIEGUE + 60, y: MOSAICO_Y, w: ANCHO_MOSAICO, h: MOSAICO_ALTO };

export const mosaicoPrimariaLapices: Modelo = {
  slug: "mosaico-primaria-lapices",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Lápices de colores",
  descripcion: `Carpeta 30×20 cm para primaria: papel blanco con una hilera de lápices de colores y garabatos. El retrato del alumno con borde de color en la tapa; la foto grupal y la seño en la contratapa. Adentro, recuadros redondeados con borde de color. ${DESCRIPCION_MOSAICO}`,
  categoria: "Primaria",
  filtros: { estilo: "Divertido", etiquetas: ["mosaico", "compañeros", "lápices", "colores", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `${PAPEL}
       ${hilera(60, PLIEGUE - 60, 1)}
       ${hilera(PLIEGUE + 60, ANCHO - 60, 4)}
       ${subrayado(CENTRO_IZQ, 300, 760, COLORES[2]!)}
       ${rulo(260, 200, 70, VIOLETA, -10)}
       ${brillo(1500, 220, 50, COLORES[1]!)}
       ${brillo(1590, 1380, 36, COLORES[3]!)}
       ${rulo(3330, 640, 60, COLORES[3]!, 20)}
       ${brillo(2010, 700, 44, COLORES[7]!)}
       ${brillo(3380, 1500, 50, COLORES[2]!)}`,
    ),

  fondoInterior: () =>
    svg(
      `${PAPEL}
       ${hilera(60, PLIEGUE - 60, 6, 56)}
       ${hilera(PLIEGUE + 60, ANCHO - 60, 3, 56)}
       ${subrayado(CENTRO_IZQ, 250, 700, COLORES[2]!)}
       ${subrayado(CENTRO_DER, 250, 760, COLORES[3]!)}
       ${brillo(330, 150, 44, COLORES[7]!)}
       ${rulo(1450, 160, 56, VERDE, 10)}
       ${brillo(2080, 150, 44, COLORES[1]!)}
       ${rulo(3230, 160, 56, VIOLETA, -10)}`,
    ),

  armar: (a) => {
    const letra = (tam: number, color = TINTA, extra = {}) => ({ familia: "Kalam", tam, color, peso: 700, ...extra });

    // Contratapa.
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 110, 1200, 190), "¡Nuestro grado!", letra(128, AZUL));
    fotoRedonda(a, "grupal", "grupal", GRUPAL, VERDE);
    fotoRedonda(a, "maestra", "maestra", MAESTRA, COLORES[7]!);
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 770, y: 1460, w: 860, h: 160 }, "Nuestra seño", letra(112, ROJO, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Grado y escuela", { x: 770, y: 1640, w: 860, h: 240 }, "course.withSchool", "Grado - Escuela", letra(58, TINTA, { alinear: "LEFT", interlineado: 1.2, peso: 400 }));

    // Tapa.
    a.variable(0, "curso", "Grado", centrado(CENTRO_DER, 110, 1450, 170), "course.displayName", "Grado", letra(110, VIOLETA));
    fotoRedonda(a, "retrato", "individual", RETRATO, AZUL);
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1610, 1450, 180), "student.fullName", "Nombre del alumno", letra(124, TINTA, { interlineado: 1 }));
    a.variable(0, "colegio", "Escuela", centrado(CENTRO_DER, 1800, 1250, 110), "school.name", "Escuela", letra(66, ROJO, { peso: 400 }));

    // Interior.
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 80, 1000, 170), "Mis compañeros", letra(118, AZUL));
    a.texto(1, "anio", "Año", centrado(CENTRO_DER, 80, 1100, 170), "Ciclo lectivo 2026", letra(108, ROJO));
    const nombres = letra(40, TINTA, { interlineado: 1.05 });
    const comunes = {
      frame: "rounded" as const,
      cornerRadius: 34,
      photoAspect: 0.8,
      gapX: 74,
      gapY: 44,
      borderWidth: 12,
      namePosition: "below" as const,
      nameLines: 2 as const,
      givenNames: "first" as const,
      capacity: 0,
    };
    a.mosaico(1, "mosaico_1", MOSAICO_IZQ, nombres, { ...comunes, borderColor: AZUL, chainOrder: 1 });
    a.mosaico(1, "mosaico_2", MOSAICO_DER, nombres, { ...comunes, borderColor: ROJO, chainOrder: 2 });
  },
};
