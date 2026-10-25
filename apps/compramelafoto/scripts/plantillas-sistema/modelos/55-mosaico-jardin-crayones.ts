import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { azar, corazon, estrella, filtroCrayon, filtroGrano, grano, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Crayones y garabatos: papel blanco con dibujos de crayón hechos «por los
 * chicos» (sol, espirales, estrellas, corazones, zigzags). Adentro, el mosaico en recuadros
 * redondeados con borde de color y giro alternado, como fotos pegadas a mano.
 */

const TINTA = "#2b2d42";
const COLORES = ["#ef476f", "#ffb703", "#06d6a0", "#118ab2", "#9b5de5", "#fb8500"];
const [ROJO, AMARILLO, VERDE, AZUL, VIOLETA, NARANJA] = COLORES as [string, string, string, string, string, string];

const RETRATO = centrado(CENTRO_DER, 360, 1000, 1180);
const GRUPAL = centrado(CENTRO_IZQ, 390, 1400, 930);
const MAESTRA = { x: 300, y: 1530, w: 500, h: 590 };

const DEFS = `${filtroCrayon("crayon", 7, 16)}${filtroGrano("g", 0.85)}`;

/** Un dibujito de crayón: `tipo` 0 sol, 1 espiral, 2 estrella, 3 corazón, 4 zigzag, 5 florcita. */
function dibujo(tipo: number, x: number, y: number, t: number, c: string) {
  switch (tipo) {
    case 0: {
      let rayos = "";
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        rayos += `M ${x + Math.cos(a) * t * 0.75} ${y + Math.sin(a) * t * 0.75} L ${x + Math.cos(a) * t * 1.15} ${y + Math.sin(a) * t * 1.15} `;
      }
      return `<circle cx="${x}" cy="${y}" r="${t * 0.5}" fill="${c}" fill-opacity="0.35" stroke="${c}"/><path d="${rayos}" stroke="${c}"/>`;
    }
    case 1: {
      let d = `M ${x} ${y}`;
      for (let i = 1; i < 34; i++) {
        const a = i * 0.55;
        const r = (t * i) / 34;
        d += ` L ${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}`;
      }
      return `<path d="${d}" stroke="${c}" fill="none"/>`;
    }
    case 2:
      return `<polygon points="${estrella(x, y, t)}" stroke="${c}" fill="${c}" fill-opacity="0.3"/>`;
    case 3:
      return `<path d="${corazon(x, y, t * 1.2)}" stroke="${c}" fill="${c}" fill-opacity="0.3"/>`;
    case 4: {
      let d = `M ${x - t * 1.2} ${y}`;
      for (let i = 0; i < 6; i++) d += ` l ${t * 0.4} ${i % 2 ? t * 0.45 : -t * 0.45}`;
      return `<path d="${d}" stroke="${c}" fill="none"/>`;
    }
    default: {
      let p = "";
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5;
        p += `<circle cx="${x + Math.cos(a) * t * 0.45}" cy="${y + Math.sin(a) * t * 0.45}" r="${t * 0.3}" stroke="${c}" fill="none"/>`;
      }
      return `${p}<circle cx="${x}" cy="${y}" r="${t * 0.2}" fill="${AMARILLO}" stroke="${AMARILLO}"/>`;
    }
  }
}

function garabatos(semilla: number, lugares: Array<[number, number]>, tam: [number, number] = [55, 85]) {
  const a = azar(semilla);
  let out = "";
  lugares.forEach(([x, y], i) => {
    out += dibujo((i + Math.floor(a.r() * 6)) % 6, x, y, a.entre(tam[0], tam[1]), a.elegir(COLORES));
  });
  return `<g stroke-width="17" stroke-linecap="round" stroke-linejoin="round" filter="url(#crayon)">${out}</g>`;
}

/** Rayitas de crayón (como un relleno a mano) en una franja. */
function rayado(x: number, y: number, w: number, h: number, c: string) {
  let d = "";
  for (let i = 0; i < w; i += 26) d += `M ${x + i} ${y + h} L ${x + i + h * 0.6} ${y} `;
  return `<path d="${d}" stroke="${c}" stroke-width="10" opacity="0.5" filter="url(#crayon)"/>`;
}

/** Marco de crayón doble alrededor de un rectángulo. */
function marco(r: { x: number; y: number; w: number; h: number }, c1: string, c2: string) {
  const a = agrandar(r, 46);
  const b = agrandar(r, 74);
  return `<g filter="url(#crayon)" fill="none" stroke-linejoin="round">
    <rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="70" stroke="${c1}" stroke-width="26"/>
    <rect x="${b.x + 10}" y="${b.y - 6}" width="${b.w - 14}" height="${b.h + 8}" rx="90" stroke="${c2}" stroke-width="14"/>
  </g>`;
}

export const mosaicoJardinCrayones: Modelo = {
  slug: "mosaico-jardin-crayones",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Crayones y garabatos",
  descripcion: `Carpeta 30×20 cm para jardín: papel blanco con dibujos de crayón de colores, como hechos por los chicos. El retrato grande del alumno en la tapa con un marco de crayón; la foto grupal y la seño en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Jardín",
  filtros: { estilo: "Informal", etiquetas: ["mosaico", "compañeros", "crayones", "garabatos", "dibujos", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fffef9"/>
       ${marco(RETRATO, ROJO, AZUL)}
       ${rayado(GRUPAL.x + 40, GRUPAL.y + GRUPAL.h + 50, GRUPAL.w - 80, 40, VERDE)}
       ${garabatos(11, [[190, 200], [1560, 210], [1600, 1440], [1580, 2190], [880, 2230], [1990, 560], [3400, 520], [1990, 1250], [3390, 1150], [1990, 2190], [3380, 2190], [180, 1250]], [75, 110])}
       ${grano("g", 0.05)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fffef9"/>
       ${rayado(330, 245, 1100, 34, AMARILLO)}${rayado(PLIEGUE + 340, 245, 1100, 34, VERDE)}
       ${garabatos(23, [[160, 160], [PLIEGUE - 180, 160], [PLIEGUE + 180, 160], [ANCHO - 160, 160], [140, ALTO - 130], [ANCHO - 140, ALTO - 130], [PLIEGUE - 150, ALTO - 130], [PLIEGUE + 150, ALTO - 130]], [55, 80])}
       ${grano("g", 0.05)}`,
      DEFS,
    ),

  armar: (a) => {
    const crayon = (tam: number, color = TINTA, extra = {}) => ({ familia: "Gloria Hallelujah", tam, color, ...extra });
    const mano = (tam: number, color = TINTA, extra = {}) => ({ familia: "Kalam", tam, color, peso: 700, ...extra });

    // Contratapa
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 120, 1300, 220), "¡Mi sala!", crayon(120, AZUL));
    a.forma(0, "marco_grupal", "Marco de la foto grupal", agrandar(GRUPAL, 20), { relleno: "#ffffff", borde: VIOLETA, grosor: 12, radio: 40, giro: 1.5 });
    a.foto(0, "grupal", GRUPAL, { radio: 26, giro: 1.5 });
    a.forma(0, "marco_maestra", "Marco de la seño", agrandar(MAESTRA, 18), { relleno: "#ffffff", borde: NARANJA, grosor: 12, radio: 40, giro: -4 });
    a.foto(0, "maestra", MAESTRA, { radio: 26, giro: -4 });
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 900, y: 1560, w: 640, h: 200 }, "Mi seño", crayon(110, ROJO, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Sala y jardín", { x: 900, y: 1780, w: 640, h: 280 }, "course.withSchool", "Sala - Jardín", mano(64, TINTA, { alinear: "LEFT", interlineado: 1.2 }));

    // Tapa
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER, 100, 1300, 190), "course.displayName", "Sala", crayon(100, VERDE));
    a.foto(0, "individual", RETRATO, { radio: 54 });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1680, 1400, 260), "student.fullName", "Nombre del alumno", crayon(100, ROJO, { interlineado: 1.1 }));
    a.variable(0, "colegio", "Jardín", centrado(CENTRO_DER, 1960, 1300, 120), "school.name", "Jardín", mano(64, AZUL));
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 2085, 600, 120), "2026", crayon(70, NARANJA));

    // Interior
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 75, 1300, 220), "Mis compañeros", crayon(110, AZUL));
    a.texto(1, "anio_interior", "Año", centrado(CENTRO_DER, 75, 1300, 220), "¡Sala 2026!", crayon(110, ROJO));
    mosaicoEnDosPaginas(a, 340, 1870, mano(48, TINTA), {
      frame: "rounded",
      cornerRadius: 30,
      photoAspect: 0.68,
      gapX: 54,
      gapY: 44,
      borderWidth: 12,
      borderColor: AZUL,
      tilt: 3,
      namePosition: "below",
      nameLines: 1,
      givenNames: "first",
    });
  },
};
