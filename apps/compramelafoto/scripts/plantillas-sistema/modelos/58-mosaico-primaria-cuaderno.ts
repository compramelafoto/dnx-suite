import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, centrado, girarCon, type Armador, type Rect } from "../lienzo";
import { corazon, estrella, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Cuaderno rayado: hoja de cuaderno con renglones celestes y margen rojo,
 * garabatos de birome azul y fotos pegadas con cinta de papel. Adentro, el mosaico en polaroids
 * con giro alternado, como pegadas a mano.
 */

const PAPEL = "#fdfcf6";
const RENGLON = "#a9c7e8";
const MARGEN = "#ec8a8a";
const BIROME = "#24479a";
const ROJO = "#d2463f";
const CINTAS = ["#f6d776", "#9fd8cf", "#f5b5c8"];

const PASO = 72;

/** Hoja rayada: renglones a todo lo ancho y margen doble a la izquierda de cada mitad. */
function hoja(desde: number, margenes: number[]) {
  let out = `<rect width="${ANCHO}" height="${ALTO}" fill="${PAPEL}"/>`;
  out += `<g stroke="${RENGLON}" stroke-width="4">`;
  for (let y = desde; y < ALTO - 30; y += PASO) out += `<line x1="0" y1="${y}" x2="${ANCHO}" y2="${y}"/>`;
  out += "</g>";
  for (const x of margenes) {
    out += `<line x1="${x}" y1="0" x2="${x}" y2="${ALTO}" stroke="${MARGEN}" stroke-width="5"/><line x1="${x + 14}" y1="0" x2="${x + 14}" y2="${ALTO}" stroke="${MARGEN}" stroke-width="3"/>`;
  }
  // Una sombrita suave en el doblez, como el lomo del cuaderno.
  out += `<defs><linearGradient id="lomo" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.5" stop-color="#000" stop-opacity="0.07"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>`;
  out += `<rect x="${PLIEGUE - 60}" y="0" width="120" height="${ALTO}" fill="url(#lomo)"/>`;
  return out;
}

/** Garabatos de birome: estrella, corazón, solcito, espiral, avioncito, flechita. */
function garabato(tipo: string, x: number, y: number, s: number, color = BIROME) {
  const g = `stroke="${color}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (tipo) {
    case "estrella":
      return `<polygon points="${estrella(x, y, s)}" ${g}/>`;
    case "corazon":
      return `<path d="${corazon(x, y, s * 1.4)}" ${g}/>`;
    case "sol": {
      let rayos = "";
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        rayos += `M ${(x + Math.cos(a) * s * 0.75).toFixed(1)} ${(y + Math.sin(a) * s * 0.75).toFixed(1)} L ${(x + Math.cos(a) * s * 1.1).toFixed(1)} ${(y + Math.sin(a) * s * 1.1).toFixed(1)} `;
      }
      return `<circle cx="${x}" cy="${y}" r="${s * 0.5}" ${g}/><path d="${rayos}" ${g}/><path d="M ${x - s * 0.2} ${y + s * 0.1} q ${s * 0.2} ${s * 0.2} ${s * 0.4} 0" ${g}/><circle cx="${x - s * 0.17}" cy="${y - s * 0.12}" r="5" fill="${color}"/><circle cx="${x + s * 0.17}" cy="${y - s * 0.12}" r="5" fill="${color}"/>`;
    }
    case "espiral": {
      let d = `M ${x} ${y}`;
      for (let i = 1; i <= 40; i++) {
        const a = i * 0.45;
        const r = (s * i) / 40;
        d += ` L ${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}`;
      }
      return `<path d="${d}" ${g}/>`;
    }
    case "avion":
      return `<path d="M ${x - s} ${y + s * 0.2} L ${x + s} ${y - s * 0.5} L ${x - s * 0.2} ${y + s * 0.6} Z M ${x + s} ${y - s * 0.5} L ${x - s * 0.15} ${y + s * 0.15} L ${x - s * 0.2} ${y + s * 0.6}" ${g}/><path d="M ${x - s * 1.3} ${y + s * 0.5} q ${-s * 0.6} ${s * 0.1} ${-s * 0.9} ${s * 0.6}" ${g} stroke-dasharray="14 16"/>`;
    case "flecha":
      return `<path d="M ${x - s} ${y} q ${s} ${-s * 0.8} ${s * 2} 0 m -40 -26 l 40 26 l -46 14" ${g}/>`;
    default:
      return `<text x="${x}" y="${y}" font-family="Caveat, cursive" font-size="${s * 1.6}" fill="${color}" text-anchor="middle">${tipo}</text>`;
  }
}

/** Polaroid pegada con cinta: sombra, papel blanco, la foto y un trozo de cinta arriba. */
function polaroid(a: Armador, clave: string, foto: Rect, rol: "individual" | "grupal" | "maestra", pad: number, abajo: number, giro: number, cinta: string) {
  const marco = { x: foto.x - pad, y: foto.y - pad, w: foto.w + 2 * pad, h: foto.h + pad + abajo };
  a.forma(0, `sombra_${clave}`, "Sombra de la foto", { ...marco, x: marco.x + 12, y: marco.y + 16 }, { relleno: "#5b5340", opacidad: 0.18, giro });
  a.forma(0, `marco_${clave}`, "Papel de la foto", marco, { relleno: "#ffffff", borde: "#e6e1d3", grosor: 2, giro });
  a.foto(0, rol, girarCon(foto, marco, giro), { giro });
  const t = { x: marco.x + marco.w / 2 - 150, y: marco.y - 50, w: 300, h: 86 };
  a.forma(0, `cinta_${clave}`, "Cinta", girarCon(t, marco, giro), { relleno: cinta, opacidad: 0.82, giro: giro - 4 });
}

const RETRATO = centrado(CENTRO_DER, 340, 1000, 1240);
const GRUPAL = centrado(CENTRO_IZQ, 400, 1300, 840);
const MAESTRA = { x: 330, y: 1490, w: 420, h: 520 };

export const mosaicoPrimariaCuaderno: Modelo = {
  slug: "mosaico-primaria-cuaderno",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Cuaderno rayado",
  descripcion: `Carpeta 30×20 cm para primaria: hoja de cuaderno rayada con margen rojo, garabatos de birome y fotos pegadas con cinta. El retrato del alumno en polaroid en la tapa; la foto grupal y la seño en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Primaria",
  filtros: { estilo: "Divertido", etiquetas: ["mosaico", "compañeros", "cuaderno", "polaroid", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `${hoja(180, [150, PLIEGUE + 150])}
       ${garabato("estrella", 3330, 300, 55)}
       ${garabato("sol", 2010, 2140, 75)}
       ${garabato("corazon", 3330, 2150, 50, ROJO)}
       ${garabato("espiral", 3350, 1250, 55)}
       ${garabato("avion", 1380, 1500, 75)}
       ${garabato("estrella", 1530, 2190, 40, ROJO)}
       ${garabato("flecha", 1150, 1430, 70, ROJO)}`,
    ),

  fondoInterior: () =>
    svg(
      `${hoja(330, [80, PLIEGUE + 80])}
       ${garabato("estrella", 260, 210, 42, ROJO)}
       ${garabato("corazon", 1560, 205, 40)}
       ${garabato("sol", 2030, 205, 55)}
       ${garabato("estrella", 3300, 210, 42)}
       ${garabato("espiral", 360, 2225, 45)}
       ${garabato("flecha", 1450, 2225, 60, ROJO)}
       ${garabato("avion", 2200, 2220, 60)}
       ${garabato("corazon", 3280, 2230, 40, ROJO)}`,
    ),

  armar: (a) => {
    const mano = (tam: number, color = BIROME, extra = {}) => ({ familia: "Caveat", tam, color, peso: 700, ...extra });
    const letra = (tam: number, color = BIROME, extra = {}) => ({ familia: "Patrick Hand", tam, color, ...extra });

    // Contratapa: la grupal y la seño, pegadas con cinta.
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 130, 1300, 190), "¡Nuestro grado!", mano(140, ROJO));
    polaroid(a, "grupal", GRUPAL, "grupal", 36, 110, -1.5, CINTAS[1]!);
    polaroid(a, "maestra", MAESTRA, "maestra", 26, 96, 3, CINTAS[2]!);
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 880, y: 1560, w: 760, h: 170 }, "Nuestra seño", mano(124, BIROME, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Grado y escuela", { x: 880, y: 1750, w: 760, h: 240 }, "course.withSchool", "Grado - Escuela", letra(62, "#3a3a4a", { alinear: "LEFT", interlineado: 1.15 }));

    // Tapa: el retrato en polaroid, con el nombre escrito en el papel.
    a.variable(0, "curso", "Grado", centrado(CENTRO_DER, 120, 1450, 170), "course.displayName", "Grado", mano(120, ROJO));
    const pad = 40;
    const marco = { x: RETRATO.x - pad, y: RETRATO.y - pad, w: RETRATO.w + 2 * pad, h: RETRATO.h + pad + 200 };
    a.forma(0, "sombra_retrato", "Sombra del retrato", { ...marco, x: marco.x + 14, y: marco.y + 18 }, { relleno: "#5b5340", opacidad: 0.18 });
    a.forma(0, "marco_retrato", "Papel del retrato", marco, { relleno: "#ffffff", borde: "#e6e1d3", grosor: 2 });
    a.foto(0, "individual", RETRATO);
    a.forma(0, "cinta_retrato_1", "Cinta", { x: marco.x - 70, y: marco.y + 10, w: 280, h: 84 }, { relleno: CINTAS[0]!, opacidad: 0.85, giro: -38 });
    a.forma(0, "cinta_retrato_2", "Cinta", { x: marco.x + marco.w - 210, y: marco.y + 10, w: 280, h: 84 }, { relleno: CINTAS[0]!, opacidad: 0.85, giro: 38 });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, RETRATO.y + RETRATO.h + 20, 1000, 170), "student.fullName", "Nombre del alumno", mano(118, BIROME, { interlineado: 1 }));
    a.variable(0, "colegio", "Escuela", centrado(CENTRO_DER, 1880, 1400, 110), "school.name", "Escuela", letra(70, "#3a3a4a"));
    a.texto(0, "anio_tapa", "Año", centrado(CENTRO_DER, 1990, 800, 130), "2026", mano(110, ROJO));

    // Interior: el mosaico en polaroids con giro alternado.
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 100, 1200, 180), "Mis compañeros", mano(140, BIROME));
    a.texto(1, "anio", "Año", centrado(CENTRO_DER, 100, 1200, 180), "Ciclo lectivo 2026", mano(124, ROJO));
    mosaicoEnDosPaginas(a, 330, 1800, letra(44, "#2a3f7a", { interlineado: 1.05 }), {
      frame: "polaroid",
      photoAspect: 0.8,
      gapX: 46,
      gapY: 40,
      tilt: 2.5,
      shadow: { dx: 6, dy: 9, color: "#d6cfbd" },
      namePosition: "below",
      nameLines: 2,
      givenNames: "first",
    });
  },
};
