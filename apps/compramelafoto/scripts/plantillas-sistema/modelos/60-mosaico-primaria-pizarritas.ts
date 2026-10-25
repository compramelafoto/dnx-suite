import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, agrandar, centrado, type Armador, type Rect } from "../lienzo";
import { azar, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Pizarritas de madera: tablas de madera clara con vetas y nudos, y
 * pizarritas verdes con marco de madera colgadas para los títulos. Adentro, los retratos derechos
 * con el nombre en tiza sobre una cinta verde pizarra, como un cartelito debajo de cada foto.
 */

const TIZA = "#f4f1e6";
const AMARILLO = "#ffe58a";
const ROSA = "#ffc1d1";
const PIZARRA = "#2f4a3a";
const MARCO = "#8b5a2b";

const TABLAS = ["#d3a26f", "#c99863", "#d8aa79", "#c6935d", "#cf9e6a"];

/** Tablas horizontales con vetas, uniones y algún nudo. */
function madera(semilla: number) {
  const a = azar(semilla);
  const alto = ALTO / 9;
  let out = "";
  for (let i = 0; i < 9; i++) {
    const y = i * alto;
    out += `<rect x="0" y="${y.toFixed(1)}" width="${ANCHO}" height="${(alto + 1).toFixed(1)}" fill="${TABLAS[i % TABLAS.length]}"/>`;
    // Vetas: líneas onduladas finas a lo largo de la tabla.
    let vetas = "";
    for (let k = 0; k < 11; k++) {
      const yy = y + a.entre(14, alto - 14);
      let d = `M -20 ${yy.toFixed(1)}`;
      for (let x = -20; x < ANCHO + 200; x += a.entre(260, 520)) {
        d += ` q ${a.entre(80, 200).toFixed(0)} ${a.entre(-14, 14).toFixed(1)} ${a.entre(260, 420).toFixed(0)} ${a.entre(-6, 6).toFixed(1)}`;
      }
      vetas += `<path d="${d}" stroke-width="${a.entre(2, 6).toFixed(1)}" opacity="${a.entre(0.12, 0.32).toFixed(2)}"/>`;
    }
    out += `<g stroke="#7a4a22" fill="none">${vetas}</g>`;
    // Un nudo de vez en cuando.
    if (a.r() < 0.6) {
      const nx = a.entre(200, ANCHO - 200);
      const ny = y + alto / 2 + a.entre(-30, 30);
      for (let r = 4; r >= 1; r--) {
        out += `<ellipse cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" rx="${(r * 26).toFixed(0)}" ry="${(r * 9).toFixed(0)}" fill="none" stroke="#7a4a22" stroke-width="3" opacity="${(0.15 + (4 - r) * 0.07).toFixed(2)}"/>`;
      }
      out += `<ellipse cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" rx="18" ry="7" fill="#6b3f1c" opacity="0.5"/>`;
    }
    // Uniones de la tabla: una ranura oscura arriba y un brillo abajo.
    out += `<rect x="0" y="${(y - 3).toFixed(1)}" width="${ANCHO}" height="6" fill="#5e3a1b" opacity="0.55"/><rect x="0" y="${(y + 3).toFixed(1)}" width="${ANCHO}" height="3" fill="#f3d3a5" opacity="0.45"/>`;
    const corte = a.entre(300, ANCHO - 300);
    out += `<rect x="${corte.toFixed(1)}" y="${y.toFixed(1)}" width="5" height="${alto.toFixed(1)}" fill="#5e3a1b" opacity="0.45"/>`;
  }
  // Viñeta suave en los bordes.
  out += `<defs><radialGradient id="vin" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#3a220d" stop-opacity="0"/><stop offset="1" stop-color="#3a220d" stop-opacity="0.35"/></radialGradient></defs><rect width="${ANCHO}" height="${ALTO}" fill="url(#vin)"/>`;
  return out;
}

/** Pizarrita verde con marco de madera; `colgada` le pone el cordel y el clavito. */
function pizarrita(r: Rect, semilla: number, colgada = false) {
  const a = azar(semilla);
  const m = 34;
  let manchas = "";
  for (let i = 0; i < 6; i++) {
    manchas += `<ellipse cx="${(r.x + a.entre(0.1, 0.9) * r.w).toFixed(1)}" cy="${(r.y + a.entre(0.2, 0.8) * r.h).toFixed(1)}" rx="${(r.w * a.entre(0.08, 0.2)).toFixed(1)}" ry="${(r.h * a.entre(0.05, 0.12)).toFixed(1)}" fill="#ffffff" opacity="0.045"/>`;
  }
  const cordel = colgada
    ? `<path d="M ${r.x + r.w * 0.2} ${r.y} L ${r.x + r.w / 2} ${r.y - 70} L ${r.x + r.w * 0.8} ${r.y}" stroke="#e8dcc0" stroke-width="7" fill="none"/><circle cx="${r.x + r.w / 2}" cy="${r.y - 70}" r="13" fill="#8a8f96"/><circle cx="${r.x + r.w / 2 - 4}" cy="${r.y - 74}" r="4" fill="#d7dbe0"/>`
    : "";
  return `${cordel}
    <rect x="${r.x + 10}" y="${r.y + 16}" width="${r.w}" height="${r.h}" rx="16" fill="#3a220d" opacity="0.35"/>
    <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="16" fill="${MARCO}"/>
    <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${m / 2}" rx="8" fill="#b07a42"/>
    <rect x="${r.x + m}" y="${r.y + m}" width="${r.w - 2 * m}" height="${r.h - 2 * m}" rx="6" fill="${PIZARRA}"/>
    <rect x="${r.x + m}" y="${r.y + m}" width="${r.w - 2 * m}" height="10" fill="#000000" opacity="0.25"/>
    ${manchas}`;
}

/** Tiza y borrador apoyados sobre la madera. */
function tizas(x: number, y: number) {
  return `<rect x="${x}" y="${y}" width="150" height="34" rx="14" fill="${TIZA}" transform="rotate(-6 ${x} ${y})"/>
    <rect x="${x + 190}" y="${y + 6}" width="120" height="34" rx="14" fill="${AMARILLO}" transform="rotate(4 ${x + 190} ${y})"/>
    <rect x="${x + 350}" y="${y - 2}" width="100" height="34" rx="14" fill="${ROSA}" transform="rotate(-3 ${x + 350} ${y})"/>
    <rect x="${x + 500}" y="${y - 40}" width="260" height="62" rx="10" fill="#a0683a"/>
    <rect x="${x + 500}" y="${y + 18}" width="260" height="38" rx="8" fill="#5c6168"/>
    <rect x="${x + 500}" y="${y - 40}" width="260" height="14" rx="7" fill="#c48a52"/>`;
}

/** Foto con marco de madera y un listón claro adentro. */
function fotoEnMarco(a: Armador, clave: string, rol: "individual" | "grupal" | "maestra", r: Rect, grosor: number) {
  const fuera = agrandar(r, grosor);
  a.forma(0, `sombra_${clave}`, "Sombra del marco", { ...fuera, x: fuera.x + 12, y: fuera.y + 18 }, { relleno: "#3a220d", opacidad: 0.35, radio: 10 });
  a.forma(0, `marco_${clave}`, "Marco de madera", fuera, { relleno: MARCO, radio: 10 });
  a.forma(0, `liston_${clave}`, "Listón del marco", agrandar(r, 12), { relleno: "#f1e4c8" });
  a.foto(0, rol, r);
}

// Tapa.
const CARTEL_CURSO = centrado(CENTRO_DER, 110, 1150, 230);
const RETRATO = centrado(CENTRO_DER, 470, 860, 1080);
const CARTEL_NOMBRE = centrado(CENTRO_DER, 1680, 1380, 560);
// Contratapa.
const CARTEL_TITULO = centrado(CENTRO_IZQ, 110, 1150, 230);
const GRUPAL = centrado(CENTRO_IZQ, 470, 1280, 820);
const MAESTRA = { x: 250, y: 1490, w: 420, h: 520 };
const CARTEL_SENO = { x: 760, y: 1530, w: 880, h: 460 };
// Interior.
const CARTEL_IZQ = centrado(CENTRO_IZQ, 80, 1060, 220);
const CARTEL_DER = centrado(CENTRO_DER, 80, 1060, 220);

export const mosaicoPrimariaPizarritas: Modelo = {
  slug: "mosaico-primaria-pizarritas",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Pizarritas de madera",
  descripcion: `Carpeta 30×20 cm para primaria: tablas de madera con pizarritas verdes escritas en tiza. El retrato del alumno con marco de madera en la tapa; la foto grupal y la seño en la contratapa. Adentro, cada compañero con su nombre en tiza sobre un cartelito verde. ${DESCRIPCION_MOSAICO}`,
  categoria: "Primaria",
  filtros: { estilo: "Clásico", etiquetas: ["mosaico", "compañeros", "madera", "pizarra", "tiza", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `${madera(60)}
       ${pizarrita(CARTEL_TITULO, 1, true)}
       ${pizarrita(CARTEL_CURSO, 2, true)}
       ${pizarrita(CARTEL_NOMBRE, 3)}
       ${pizarrita(CARTEL_SENO, 4)}`,
    ),

  fondoInterior: () =>
    svg(
      `${madera(61)}
       ${pizarrita(CARTEL_IZQ, 5)}
       ${pizarrita(CARTEL_DER, 6)}
       ${tizas(250, 2240)}
       ${tizas(2600, 2240)}`,
    ),

  armar: (a) => {
    const tiza = (tam: number, color = TIZA, extra = {}) => ({ familia: "Schoolbell", tam, color, ...extra });

    // Contratapa.
    a.texto(0, "titulo_grupal", "Título de la contratapa", agrandar(CARTEL_TITULO, -40), "¡Nuestro grado!", tiza(116, AMARILLO));
    fotoEnMarco(a, "grupal", "grupal", GRUPAL, 40);
    fotoEnMarco(a, "maestra", "maestra", MAESTRA, 30);
    a.texto(0, "titulo_maestra", "Título de la seño", { x: CARTEL_SENO.x + 70, y: CARTEL_SENO.y + 60, w: CARTEL_SENO.w - 140, h: 150 }, "Nuestra seño", tiza(110, ROSA));
    a.variable(0, "curso_contratapa", "Grado y escuela", { x: CARTEL_SENO.x + 70, y: CARTEL_SENO.y + 220, w: CARTEL_SENO.w - 140, h: 190 }, "course.withSchool", "Grado - Escuela", tiza(58, TIZA, { interlineado: 1.2 }));

    // Tapa.
    a.variable(0, "curso", "Grado", agrandar(CARTEL_CURSO, -40), "course.displayName", "Grado", tiza(104, AMARILLO));
    fotoEnMarco(a, "retrato", "individual", RETRATO, 44);
    a.variable(0, "alumno", "Nombre del alumno", { x: CARTEL_NOMBRE.x + 70, y: CARTEL_NOMBRE.y + 70, w: CARTEL_NOMBRE.w - 140, h: 190 }, "student.fullName", "Nombre del alumno", tiza(130, TIZA, { interlineado: 1 }));
    a.variable(0, "colegio", "Escuela", { x: CARTEL_NOMBRE.x + 70, y: CARTEL_NOMBRE.y + 280, w: CARTEL_NOMBRE.w - 140, h: 110 }, "school.name", "Escuela", tiza(66, ROSA));
    a.texto(0, "anio_tapa", "Año", { x: CARTEL_NOMBRE.x + 70, y: CARTEL_NOMBRE.y + 390, w: CARTEL_NOMBRE.w - 140, h: 110 }, "2026", tiza(76, AMARILLO));

    // Interior.
    a.texto(1, "titulo_mosaico", "Título del mosaico", agrandar(CARTEL_IZQ, -40), "Mis compañeros", tiza(108, AMARILLO));
    a.texto(1, "anio", "Año", agrandar(CARTEL_DER, -40), "Ciclo lectivo 2026", tiza(96, TIZA));
    mosaicoEnDosPaginas(a, 350, 1790, tiza(42, TIZA, { interlineado: 1.05 }), {
      frame: "rect",
      photoAspect: 0.8,
      gapX: 44,
      gapY: 30,
      borderWidth: 12,
      borderColor: "#f1e4c8",
      shadow: { dx: 8, dy: 12, color: "#5a3618" },
      namePosition: "below",
      nameLines: 2,
      nameBackground: PIZARRA,
      givenNames: "first",
    });
  },
};
