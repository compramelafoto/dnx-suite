import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Armador, type Rect } from "../lienzo";
import { svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import { FECHA_FALLBACK, caliz, degradadoLuz, degradadoOro, filete, manojoEspigas, racimo } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Comunión del curso: marfil con espigas de trigo y racimos de uvas suaves en
 * las esquinas y un cáliz dorado en la tapa. Adentro, los compañeros de catequesis en círculos
 * con borde dorado; en la contratapa, el grupo y la catequista.
 */

const MARFIL = "#fbf7ee";
const ORO = "#c9a24f";
const ORO_OSCURO = "#8f6b2c";
const SEPIA = "#5b4a2e";
const TRIGO = "#d9c08a";
const UVA = "#b8a5c8";
const HOJA = "#b9c79a";

const DEFS = `${degradadoOro("oro")}${degradadoLuz("luz", "#fff3cf", 0.9)}`;

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${MARFIL}"/>
    <rect x="40" y="40" width="${PLIEGUE - 80}" height="${ALTO - 80}" fill="none" stroke="${TRIGO}" stroke-width="3"/>
    <rect x="${PLIEGUE + 40}" y="40" width="${PLIEGUE - 80}" height="${ALTO - 80}" fill="none" stroke="${TRIGO}" stroke-width="3"/>`;
}

/** Espigas y uvas en una esquina de abajo, tenues. `lado` 1 = esquina izquierda, -1 = derecha. */
function rincon(x: number, y: number, lado: 1 | -1, escala = 1) {
  return `<g opacity="0.75">
    ${manojoEspigas(x, y, 360 * escala, TRIGO, lado * 28)}
    ${racimo(x + lado * 210 * escala, y - 190 * escala, 200 * escala, UVA, HOJA)}
  </g>`;
}

/** Retrato redondo con aro dorado y filete blanco. */
function fotoRedonda(a: Armador, clave: string, rol: "individual" | "grupal" | "maestra", r: Rect) {
  a.forma(0, `aro_${clave}`, "Aro dorado", agrandar(r, 26), { relleno: ORO, circulo: true });
  a.forma(0, `filete_${clave}`, "Filete blanco", agrandar(r, 12), { relleno: "#ffffff", circulo: true });
  a.foto(0, rol, r, { mascara: "circle" });
}

/** Foto rectangular con filete dorado fino. */
function fotoConFilete(a: Armador, clave: string, rol: "individual" | "grupal" | "maestra", r: Rect) {
  a.forma(0, `marco_${clave}`, "Filete dorado", agrandar(r, 22), { relleno: ORO, radio: 6 });
  a.forma(0, `paspartu_${clave}`, "Paspartú", agrandar(r, 16), { relleno: "#ffffff", radio: 3 });
  a.foto(0, rol, r);
}

const RETRATO = centrado(CENTRO_DER, 600, 980, 980);
const GRUPAL = centrado(CENTRO_IZQ, 390, 1240, 800);
const MAESTRA = centrado(560, 1430, 560, 560);

export const mosaicoReligiosoComunion: Modelo = {
  slug: "mosaico-religioso-comunion",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Comunión del curso",
  descripcion: `Carpeta 30×20 cm de Primera Comunión para el grupo de catequesis: marfil con espigas de trigo y uvas suaves, cáliz dorado y retratos en círculo con aro dorado. El retrato del chico en la tapa; la foto del grupo y la catequista en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Religioso",
  filtros: { estilo: "Clásico", evento: "Primera Comunión", etiquetas: ["mosaico", "compañeros", "comunión", "catequesis", "espigas", "uvas", "cáliz"] },
  etiquetasDeFotos: { ...ETIQUETAS_MOSAICO, maestra: "Foto de la catequista" },

  fondoExterior: () =>
    svg(
      `${papel()}
       <circle cx="${CENTRO_DER}" cy="230" r="240" fill="url(#luz)"/>
       ${caliz(CENTRO_DER, 150, 120, "url(#oro)")}
       ${rincon(PLIEGUE + 170, ALTO - 110, 1, 0.85)}
       ${rincon(ANCHO - 170, ALTO - 110, -1, 0.85)}
       ${rincon(170, ALTO - 110, 1, 0.7)}
       ${filete(CENTRO_IZQ, 300, 520, ORO, 3)}
       ${filete(CENTRO_DER, 1830, 520, ORO, 3)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${papel()}
       ${manojoEspigas(260, 300, 220, TRIGO, -30)}
       ${manojoEspigas(PLIEGUE - 260, 300, 220, TRIGO, 30)}
       ${racimo(PLIEGUE + 260, 150, 140, UVA, HOJA)}
       ${racimo(ANCHO - 260, 150, 140, UVA, HOJA)}
       ${filete(CENTRO_IZQ, 2230, 700, ORO, 3)}
       ${filete(CENTRO_DER, 2230, 700, ORO, 3)}`,
      DEFS,
    ),

  armar: (a) => {
    const vibes = (tam: number, color = ORO_OSCURO, extra = {}) => ({ familia: "Great Vibes", tam, color, ...extra });
    const lora = (tam: number, color = SEPIA, extra = {}) => ({ familia: "Lora", tam, color, ...extra });

    // Contratapa.
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 110, 1300, 190), "Nuestro grupo", vibes(150));
    fotoConFilete(a, "grupal", "grupal", GRUPAL);
    fotoRedonda(a, "maestra", "maestra", MAESTRA);
    a.texto(0, "titulo_maestra", "Título de la catequista", { x: 920, y: 1530, w: 720, h: 170 }, "Nuestra catequista", vibes(116, ORO_OSCURO, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Curso y colegio", { x: 920, y: 1720, w: 720, h: 220 }, "course.withSchool", "Curso - Colegio o parroquia", lora(50, SEPIA, { alinear: "LEFT", interlineado: 1.3, italica: true }));

    // Tapa.
    a.texto(0, "titulo_tapa", "Título de la tapa", centrado(CENTRO_DER, 400, 1300, 170), "Mi Primera Comunión", vibes(124));
    fotoRedonda(a, "retrato", "individual", RETRATO);
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1650, 1400, 150), "student.fullName", "Nombre del alumno", lora(96, SEPIA, { interlineado: 1 }));
    a.variable(0, "fecha", "Fecha", centrado(CENTRO_DER, 1870, 1000, 90), "event.dateFormatted", FECHA_FALLBACK, lora(50, ORO_OSCURO, { italica: true }));
    a.variable(0, "colegio", "Colegio o parroquia", centrado(CENTRO_DER, 1970, 1200, 90), "school.name", "Colegio o parroquia", lora(50, SEPIA));

    // Interior.
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 110, 1000, 180), "Mis compañeros", vibes(140));
    a.texto(1, "anio", "Año", centrado(CENTRO_DER, 110, 1000, 180), "Comunión 2026", vibes(130));
    mosaicoEnDosPaginas(a, 350, 1800, lora(36, SEPIA, { interlineado: 1.1 }), {
      frame: "circle",
      gapX: 30,
      gapY: 34,
      borderWidth: 8,
      borderColor: ORO,
      shadow: null,
      namePosition: "below",
      nameLines: 2,
      givenNames: "first",
    });
  },
};
