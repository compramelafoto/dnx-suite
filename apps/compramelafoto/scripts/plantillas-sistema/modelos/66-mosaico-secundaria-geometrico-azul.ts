import { ALTO, ANCHO, PLIEGUE, type Rect } from "../lienzo";
import { puntos, svg } from "../texturas";
import { ANCHO_MOSAICO, DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Geométrico azul y amarillo: azul marino y amarillo en formas planas
 * (triángulos, círculos, tramas de puntos), como las viñetas modernas. Retratos con la sombra
 * corrida amarilla, en la tapa y en el mosaico.
 */

const MARINO = "#14213d";
const AMARILLO = "#ffc727";
const HUESO = "#f6f4ef";
const CELESTE = "#9fb4d8";

const RETRATO: Rect = { x: PLIEGUE + 230, y: 300, w: 900, h: 1150 };
const GRUPAL: Rect = { x: 240, y: 420, w: 1260, h: 840 };
const TUTOR: Rect = { x: 240, y: 1470, w: 420, h: 520 };
const SOMBRA = 40;
const X_MOSAICO_IZQ = 129;
const X_MOSAICO_DER = ANCHO - 129 - ANCHO_MOSAICO;

const corrido = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w, h: r.h });

export const mosaicoSecundariaGeometricoAzul: Modelo = {
  slug: "mosaico-secundaria-geometrico-azul",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Geométrico azul y amarillo",
  descripcion: `Carpeta 30×20 cm para secundaria, moderna: formas geométricas en azul marino y amarillo y letras condensadas. El retrato grande del alumno con sombra amarilla en la tapa; la foto grupal y el tutor en la contratapa. Adentro, cada compañero con su sombra corrida amarilla. ${DESCRIPCION_MOSAICO}`,
  categoria: "Secundaria",
  filtros: { estilo: "Moderno", etiquetas: ["mosaico", "compañeros", "geométrico", "azul", "amarillo", "tutor"] },
  etiquetasDeFotos: { ...ETIQUETAS_MOSAICO, maestra: "Foto del tutor o la tutora" },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${HUESO}"/>
       <rect x="${PLIEGUE}" width="${PLIEGUE}" height="${ALTO}" fill="${MARINO}"/>
       <circle cx="${ANCHO + 40}" cy="${ALTO + 40}" r="620" fill="${AMARILLO}"/>
       <circle cx="${ANCHO + 40}" cy="${ALTO + 40}" r="440" fill="none" stroke="${MARINO}" stroke-width="24"/>
       <polygon points="${ANCHO},0 ${ANCHO - 420},0 ${ANCHO},420" fill="${AMARILLO}"/>
       ${puntos({ x: ANCHO - 620, y: 520, w: 380, h: 330 }, 55, 9, CELESTE, 0.45)}
       <rect x="${RETRATO.x}" y="200" width="200" height="20" fill="${AMARILLO}"/>
       <polygon points="0,${ALTO} 0,${ALTO - 560} 560,${ALTO}" fill="${MARINO}"/>
       <polygon points="0,${ALTO} 0,${ALTO - 300} 300,${ALTO}" fill="${AMARILLO}"/>
       <circle cx="${PLIEGUE - 260}" cy="${ALTO - 230}" r="90" fill="none" stroke="${AMARILLO}" stroke-width="22"/>
       ${puntos({ x: 1340, y: 130, w: 280, h: 160 }, 55, 9, MARINO, 0.3)}`,
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${HUESO}"/>
       <rect x="0" y="0" width="${ANCHO}" height="330" fill="${MARINO}"/>
       <polygon points="${PLIEGUE - 380},0 ${PLIEGUE - 160},0 ${PLIEGUE - 380},330" fill="${AMARILLO}"/>
       <circle cx="${ANCHO - 230}" cy="165" r="70" fill="none" stroke="${AMARILLO}" stroke-width="18"/>
       ${puntos({ x: ANCHO - 700, y: 110, w: 330, h: 110 }, 55, 8, CELESTE, 0.5)}
       <rect x="${X_MOSAICO_IZQ}" y="${ALTO - 105}" width="260" height="18" fill="${AMARILLO}"/>
       <rect x="${X_MOSAICO_DER + ANCHO_MOSAICO - 260}" y="${ALTO - 105}" width="260" height="18" fill="${MARINO}"/>`,
    ),

  armar: (a) => {
    const cond = (tam: number, color = MARINO, extra = {}) => ({ familia: "Oswald", tam, color, alinear: "LEFT" as const, mayus: "uppercase" as const, interlineado: 1, ...extra });
    const sans = (tam: number, color = MARINO, extra = {}) => ({ familia: "Montserrat", tam, color, peso: 600, alinear: "LEFT" as const, ...extra });

    // Contratapa: la grupal y el tutor con su sombra amarilla.
    a.texto(0, "titulo_grupal", "Título de la contratapa", { x: GRUPAL.x, y: 170, w: 1200, h: 190 }, "Nuestro curso", cond(160));
    a.forma(0, "sombra_grupal", "Sombra de la grupal", corrido(GRUPAL, SOMBRA), { relleno: AMARILLO });
    a.foto(0, "grupal", GRUPAL);
    a.forma(0, "sombra_maestra", "Sombra del tutor", corrido(TUTOR, 28), { relleno: MARINO });
    a.foto(0, "maestra", TUTOR);
    a.texto(0, "titulo_maestra", "Título del tutor", { x: TUTOR.x + TUTOR.w + 110, y: 1530, w: 820, h: 140 }, "Nuestro tutor", cond(118));
    a.forma(0, "raya_maestra", "Raya del tutor", { x: TUTOR.x + TUTOR.w + 115, y: 1700, w: 150, h: 18 }, { relleno: AMARILLO });
    a.variable(0, "curso_contratapa", "Curso y colegio", { x: TUTOR.x + TUTOR.w + 110, y: 1760, w: 820, h: 230 }, "course.withSchool", "Curso - Colegio", sans(48, MARINO, { peso: 500, interlineado: 1.3 }));

    // Tapa: el retrato con sombra amarilla y los datos.
    a.forma(0, "sombra_retrato", "Sombra del retrato", corrido(RETRATO, SOMBRA), { relleno: AMARILLO });
    a.foto(0, "individual", RETRATO);
    a.texto(0, "anio", "Año", { x: RETRATO.x, y: 1540, w: 700, h: 80 }, "Ciclo lectivo 2026", sans(48, AMARILLO, { mayus: "uppercase" }));
    a.variable(0, "alumno", "Nombre del alumno", { x: RETRATO.x - 6, y: 1630, w: 1300, h: 190 }, "student.fullName", "Nombre del alumno", cond(170, HUESO));
    a.variable(0, "curso", "Curso", { x: RETRATO.x, y: 1850, w: 1000, h: 90 }, "course.displayName", "Curso", sans(58, AMARILLO, { peso: 700 }));
    a.variable(0, "colegio", "Colegio", { x: RETRATO.x, y: 1960, w: 880, h: 160 }, "school.name", "Colegio", sans(46, HUESO, { peso: 500, interlineado: 1.25 }));

    // Interior: banda marino con los títulos y el mosaico con sombra corrida.
    a.texto(1, "titulo_mosaico", "Título del mosaico", { x: X_MOSAICO_IZQ, y: 85, w: 1200, h: 170 }, "Compañeros", cond(150, HUESO));
    a.variable(1, "curso_mosaico", "Curso", { x: X_MOSAICO_DER, y: 125, w: 1000, h: 90 }, "course.displayName", "Curso", sans(56, AMARILLO, { peso: 700 }));
    mosaicoEnDosPaginas(a, 440, 1770, { familia: "Montserrat", tam: 34, color: MARINO, peso: 600, interlineado: 1.1 }, {
      frame: "rect",
      photoAspect: 0.78,
      gapX: 46,
      gapY: 34,
      borderWidth: 0,
      shadow: { dx: 14, dy: 14, color: AMARILLO },
      namePosition: "below",
      nameLines: 2,
      givenNames: "all",
    });
  },
};
