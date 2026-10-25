import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Armador, type Rect } from "../lienzo";
import { azar, confeti, estrella, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Fin de año con confeti: fondo claro de fiesta con guirnaldas de banderines,
 * serpentinas, estrellitas doradas y confeti de colores. Adentro, los retratos redondeados con
 * borde blanco, para cerrar el año con todo el grado.
 */

const FONDO = "#fff8ef";
const TINTA = "#3b2c5a";
const FIESTA = ["#ff5d73", "#ffb703", "#38b6ff", "#7ed957", "#b07cff", "#ff8c42"];
const ORO = "#f4b400";

/** Guirnalda de banderines colgando entre x0 y x1, con la panza `caida` px más abajo. */
function guirnalda(x0: number, x1: number, y: number, caida: number, semilla: number, n = 11) {
  const cx = (x0 + x1) / 2;
  const cy = y + 2 * caida;
  const punto = (t: number) => ({
    x: (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1,
    y: (1 - t) ** 2 * y + 2 * (1 - t) * t * cy + t ** 2 * y,
  });
  const tangente = (t: number) => {
    const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
    const dy = 2 * (1 - t) * (cy - y) + 2 * t * (y - cy);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };
  let out = `<path d="M ${x0} ${y} Q ${cx} ${cy} ${x1} ${y}" stroke="#8a7a9a" stroke-width="6" fill="none"/>`;
  const a = azar(semilla);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = punto(t);
    const c = FIESTA[(i + semilla) % FIESTA.length]!;
    out += `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(tangente(t) + a.entre(-3, 3)).toFixed(1)})">
      <polygon points="-56,0 56,0 0,128" fill="${c}"/><polygon points="-56,0 0,0 0,128" fill="#ffffff" opacity="0.18"/>
      <circle cx="0" cy="34" r="12" fill="#ffffff" opacity="0.7"/></g>`;
  }
  return out;
}

/** Serpentina: una cinta enrulada que avanza de (x, y) hacia la derecha y luego gira `giro`. */
function serpentina(x: number, y: number, vueltas: number, s: number, color: string, giro = 0) {
  let d = `M 0 0`;
  for (let i = 0; i < vueltas; i++) d += ` c ${s * 0.9} ${-s * 0.1} ${s * 1.1} ${-s} ${s * 0.45} ${-s * 0.9} s ${s * 0.1} ${s * 1.2} ${s * 1.4} ${s * 1.0}`;
  return `<path d="${d}" transform="translate(${x} ${y}) rotate(${giro})" stroke="${color}" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function estrellas(lista: Array<[number, number, number]>) {
  return lista.map(([x, y, r]) => `<polygon points="${estrella(x, y, r, 5, 0.5)}" fill="${ORO}"/>`).join("");
}

/** Foto con borde blanco redondeado y una sombra suave de color. */
function fotoDeFiesta(a: Armador, clave: string, rol: "individual" | "grupal" | "maestra", r: Rect, color: string, giro = 0) {
  const borde = agrandar(r, 22);
  a.forma(0, `sombra_${clave}`, "Sombra de color", { ...borde, x: borde.x + 18, y: borde.y + 22 }, { relleno: color, radio: 40, giro });
  a.forma(0, `marco_${clave}`, "Borde blanco", borde, { relleno: "#ffffff", radio: 40, giro });
  a.foto(0, rol, r, { radio: 24, giro });
}

const RETRATO = centrado(CENTRO_DER, 450, 900, 1120);
const GRUPAL = centrado(CENTRO_IZQ, 450, 1300, 820);
const MAESTRA = { x: 260, y: 1470, w: 420, h: 520 };

// Las zonas de texto quedan sin confeti, para que se lean bien.
const SIN_CONFETI_EXT: Rect[] = [
  centrado(CENTRO_IZQ, 200, 1400, 200),
  { x: 740, y: 1500, w: 940, h: 460 },
  centrado(CENTRO_DER, 200, 1450, 200),
  centrado(CENTRO_DER, 1620, 1500, 480),
];
const SIN_CONFETI_INT: Rect[] = [
  centrado(CENTRO_IZQ, 190, 1300, 170),
  centrado(CENTRO_DER, 190, 1300, 170),
  // El mosaico: los nombres van sobre el fondo y el confeti los ensuciaría.
  { x: 110, y: 370, w: ANCHO - 220, h: 1800 },
];

export const mosaicoPrimariaFinDeAno: Modelo = {
  slug: "mosaico-primaria-fin-de-ano",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Fin de año con confeti",
  descripcion: `Carpeta 30×20 cm para primaria, de fin de año: fondo claro con guirnaldas de banderines, serpentinas y confeti de colores. El retrato del alumno en la tapa; la foto grupal y la seño en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Primaria",
  filtros: { estilo: "Divertido", evento: "Fin de año", etiquetas: ["mosaico", "compañeros", "fin de año", "confeti", "fiesta", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}"/>
       ${confeti({ x: 40, y: 220, w: ANCHO - 80, h: ALTO - 260 }, 260, FIESTA, 62, [16, 34], SIN_CONFETI_EXT)}
       ${guirnalda(-40, PLIEGUE - 40, 40, 50, 1)}
       ${guirnalda(PLIEGUE + 40, ANCHO + 40, 40, 50, 3)}
       ${serpentina(80, 2200, 5, 70, FIESTA[2]!, -12)}
       ${serpentina(1220, 2280, 4, 60, FIESTA[0]!, -4)}
       ${serpentina(2020, 2250, 5, 66, FIESTA[3]!, -8)}
       ${serpentina(3020, 2230, 4, 60, FIESTA[4]!, -14)}
       ${estrellas([[1560, 1390, 46], [1950, 900, 40], [3380, 1200, 52], [1500, 2120, 34], [3330, 520, 38], [200, 1380, 36]])}`,
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}"/>
       ${confeti({ x: 40, y: 200, w: ANCHO - 80, h: ALTO - 240 }, 110, FIESTA, 63, [14, 30], SIN_CONFETI_INT)}
       ${guirnalda(-40, PLIEGUE - 40, 30, 36, 2, 13)}
       ${guirnalda(PLIEGUE + 40, ANCHO + 40, 30, 36, 5, 13)}
       ${serpentina(140, 2290, 7, 60, FIESTA[0]!, -3)}
       ${serpentina(1960, 2290, 7, 60, FIESTA[2]!, -3)}`,
    ),

  armar: (a) => {
    const marcador = (tam: number, color: string, extra = {}) => ({ familia: "Permanent Marker", tam, color, ...extra });
    const letra = (tam: number, color = TINTA, extra = {}) => ({ familia: "Nunito", tam, color, peso: 700, ...extra });

    // Contratapa.
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 210, 1350, 180), "¡Qué lindo año!", marcador(120, FIESTA[0]!));
    fotoDeFiesta(a, "grupal", "grupal", GRUPAL, FIESTA[2]!);
    fotoDeFiesta(a, "maestra", "maestra", MAESTRA, FIESTA[1]!, -3);
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 770, y: 1540, w: 880, h: 160 }, "¡Gracias, seño!", marcador(96, FIESTA[4]!, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Grado y escuela", { x: 770, y: 1720, w: 880, h: 220 }, "course.withSchool", "Grado - Escuela", letra(56, TINTA, { alinear: "LEFT", interlineado: 1.2 }));

    // Tapa.
    a.variable(0, "curso", "Grado", centrado(CENTRO_DER, 210, 1400, 170), "course.displayName", "Grado", marcador(104, FIESTA[2]!));
    fotoDeFiesta(a, "retrato", "individual", RETRATO, FIESTA[0]!);
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1660, 1450, 170), "student.fullName", "Nombre del alumno", letra(118, TINTA, { interlineado: 1 }));
    a.variable(0, "colegio", "Escuela", centrado(CENTRO_DER, 1830, 1300, 100), "school.name", "Escuela", letra(60, FIESTA[4]!));
    a.texto(0, "anio_tapa", "Año", centrado(CENTRO_DER, 1950, 1000, 130), "¡Fin de año 2026!", marcador(84, FIESTA[0]!));

    // Interior.
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 190, 1250, 160), "Mis compañeros", marcador(112, FIESTA[0]!));
    a.texto(1, "anio", "Año", centrado(CENTRO_DER, 190, 1250, 160), "¡Fin de año 2026!", marcador(104, FIESTA[2]!));
    mosaicoEnDosPaginas(a, 380, 1770, letra(40, TINTA, { interlineado: 1.05 }), {
      frame: "rounded",
      cornerRadius: 30,
      photoAspect: 0.8,
      gapX: 48,
      gapY: 34,
      borderWidth: 12,
      borderColor: "#ffffff",
      shadow: { dx: 0, dy: 12, color: "#ecd9c3" },
      namePosition: "below",
      nameLines: 2,
      givenNames: "first",
    });
  },
};
