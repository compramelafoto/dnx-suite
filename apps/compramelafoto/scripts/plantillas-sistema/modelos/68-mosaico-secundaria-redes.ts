import { ALTO, ANCHO, CENTRO_DER, PLIEGUE, centrado } from "../lienzo";
import { svg } from "../texturas";
import { ANCHO_MOSAICO, DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Redes sociales: la tapa es un perfil (avatar con aro de color, nombre,
 * contadores y destacados), la contratapa una publicación con la foto grupal, y adentro los
 * compañeros en círculos como «historias». Íconos genéricos dibujados, sin marcas reales.
 */

const TINTA = "#1c1c1e";
const GRIS = "#8e8e93";
const LINEA = "#e3e3e6";
const BLANCO = "#ffffff";
const FONDO = "#fafafa";
const AZUL = "#2f80ed";
const MAGENTA = "#e1306c";

const AVATAR = centrado(CENTRO_DER, 360, 760, 760);
const POST = { x: 190, y: 400, w: PLIEGUE - 190 - 230, h: 1080 };
const TUTOR = { x: 230, y: 1800, w: 300, h: 300 };
const X_MOSAICO_IZQ = 129;
const X_MOSAICO_DER = ANCHO - 129 - ANCHO_MOSAICO;

const DEFS = `
  <linearGradient id="aro" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#ffc947"/><stop offset="0.4" stop-color="#f5713b"/><stop offset="0.7" stop-color="#e1306c"/><stop offset="1" stop-color="#8a3ab9"/>
  </linearGradient>`;

const aro = (cx: number, cy: number, r: number, grosor: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#aro)" stroke-width="${grosor}"/>`;

/** Íconos genéricos de una publicación: corazón, globito, avioncito y marcador. */
function acciones(x: number, y: number, ancho: number) {
  const s = `stroke="${TINTA}" stroke-width="9" fill="none" stroke-linejoin="round" stroke-linecap="round"`;
  return `<path d="M ${x + 40} ${y + 62} C ${x - 10} ${y + 30}, ${x + 5} ${y - 12}, ${x + 40} ${y + 12} C ${x + 75} ${y - 12}, ${x + 90} ${y + 30}, ${x + 40} ${y + 62} Z" fill="${MAGENTA}" stroke="${MAGENTA}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M ${x + 165} ${y + 30} a 34 32 0 1 1 18 28 l -24 8 z" ${s}/>
    <path d="M ${x + 280} ${y} l 74 0 l -42 70 l -6 -40 z M ${x + 306} ${y + 30} l 48 -30" ${s}/>
    <path d="M ${x + ancho - 50} ${y} h 46 v 66 l -23 -18 l -23 18 z" ${s}/>`;
}

/** Contador del perfil (número arriba, rótulo abajo) dibujado en el fondo. */
function contador(cx: number, y: number, numero: string, rotulo: string) {
  return `<text x="${cx}" y="${y}" font-family="Montserrat" font-weight="700" font-size="78" fill="${TINTA}" text-anchor="middle">${numero}</text>
    <text x="${cx}" y="${y + 66}" font-family="Montserrat" font-size="42" fill="${GRIS}" text-anchor="middle">${rotulo}</text>`;
}

/** Destacado: círculo con borde gris y un ícono simple adentro. */
function destacado(cx: number, cy: number, icono: string, rotulo: string) {
  return `<circle cx="${cx}" cy="${cy}" r="88" fill="${BLANCO}" stroke="${LINEA}" stroke-width="8"/>
    <g stroke="${TINTA}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round">${icono}</g>
    <text x="${cx}" y="${cy + 150}" font-family="Montserrat" font-size="38" fill="${TINTA}" text-anchor="middle">${rotulo}</text>`;
}

export const mosaicoSecundariaRedes: Modelo = {
  slug: "mosaico-secundaria-redes",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Redes sociales",
  descripcion: `Carpeta 30×20 cm para secundaria con estética de redes: la tapa es el perfil del alumno (retrato redondo con aro de color, contadores y destacados) y la contratapa una publicación con la foto grupal y el tutor. Adentro, los compañeros en círculos como historias. Sin marcas reales. ${DESCRIPCION_MOSAICO}`,
  categoria: "Secundaria",
  filtros: { estilo: "Moderno", etiquetas: ["mosaico", "compañeros", "redes sociales", "perfil", "historias", "tutor"] },
  etiquetasDeFotos: { ...ETIQUETAS_MOSAICO, maestra: "Foto del tutor o la tutora" },

  fondoExterior: () => {
    const cxA = CENTRO_DER;
    const cyA = AVATAR.y + AVATAR.h / 2;
    const yDest = 1930;
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}"/>
       <rect x="${PLIEGUE}" width="${PLIEGUE}" height="${ALTO}" fill="${BLANCO}"/>
       <!-- tapa: barra superior del perfil -->
       <line x1="${PLIEGUE + 200}" y1="250" x2="${ANCHO - 200}" y2="250" stroke="${LINEA}" stroke-width="4"/>
       <path d="M ${ANCHO - 330} 150 h 60 M ${ANCHO - 330} 175 h 60 M ${ANCHO - 330} 200 h 60" stroke="${TINTA}" stroke-width="9" stroke-linecap="round"/>
       ${aro(cxA, cyA, AVATAR.w / 2 + 34, 22)}
       <circle cx="${cxA}" cy="${cyA}" r="${AVATAR.w / 2 + 14}" fill="${BLANCO}"/>
       ${contador(PLIEGUE + 420, 1580, "24", "compañeros")}
       ${contador(CENTRO_DER, 1580, "∞", "recuerdos")}
       ${contador(ANCHO - 420, 1580, "1", "curso")}
       <line x1="${PLIEGUE + 200}" y1="1720" x2="${ANCHO - 200}" y2="1720" stroke="${LINEA}" stroke-width="4"/>
       ${destacado(PLIEGUE + 420, yDest, `<path d="M ${PLIEGUE + 380} ${yDest + 25} l 40 -60 l 40 60 z"/><circle cx="${PLIEGUE + 455}" cy="${yDest - 30}" r="12"/>`, "Viajes")}
       ${destacado(PLIEGUE + 420 + 465, yDest, `<rect x="${PLIEGUE + 840}" y="${yDest - 25}" width="90" height="60" rx="8"/><path d="M ${PLIEGUE + 840} ${yDest - 25} l 45 30 l 45 -30"/>`, "Recreos")}
       ${destacado(PLIEGUE + 420 + 930, yDest, `<polygon points="${PLIEGUE + 1350},${yDest - 42} ${PLIEGUE + 1362},${yDest - 8} ${PLIEGUE + 1398},${yDest - 8} ${PLIEGUE + 1369},${yDest + 12} ${PLIEGUE + 1380},${yDest + 46} ${PLIEGUE + 1350},${yDest + 25} ${PLIEGUE + 1320},${yDest + 46} ${PLIEGUE + 1331},${yDest + 12} ${PLIEGUE + 1302},${yDest - 8} ${PLIEGUE + 1338},${yDest - 8}"/>`, "Actos")}
       <!-- contratapa: tarjeta de publicación -->
       <rect x="${POST.x - 40}" y="160" width="${POST.w + 80}" height="${ALTO - 260}" rx="36" fill="${BLANCO}" stroke="${LINEA}" stroke-width="4"/>
       ${aro(POST.x + 70, 285, 62, 10)}
       <circle cx="${POST.x + 70}" cy="285" r="50" fill="#d9dde3"/>
       <circle cx="${POST.x + 70}" cy="272" r="20" fill="${GRIS}"/><path d="M ${POST.x + 36} 320 q 34 -40 68 0" fill="${GRIS}"/>
       <circle cx="${POST.x + POST.w - 70}" cy="285" r="7" fill="${TINTA}"/><circle cx="${POST.x + POST.w - 40}" cy="285" r="7" fill="${TINTA}"/><circle cx="${POST.x + POST.w - 10}" cy="285" r="7" fill="${TINTA}"/>
       ${acciones(POST.x, POST.y + POST.h + 50, POST.w)}
       ${aro(TUTOR.x + TUTOR.w / 2, TUTOR.y + TUTOR.h / 2, TUTOR.w / 2 + 22, 12)}`,
      DEFS,
    );
  },

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${BLANCO}"/>
       <line x1="${X_MOSAICO_IZQ}" y1="340" x2="${X_MOSAICO_IZQ + ANCHO_MOSAICO}" y2="340" stroke="${LINEA}" stroke-width="4"/>
       <line x1="${X_MOSAICO_DER}" y1="340" x2="${X_MOSAICO_DER + ANCHO_MOSAICO}" y2="340" stroke="${LINEA}" stroke-width="4"/>
       <circle cx="${X_MOSAICO_IZQ + 22}" cy="232" r="22" fill="url(#aro)"/>`,
      DEFS,
    ),

  armar: (a) => {
    const sans = (tam: number, color = TINTA, extra = {}) => ({ familia: "Montserrat", tam, color, alinear: "LEFT" as const, ...extra });

    // Contratapa: la publicación con la grupal y el tutor.
    a.texto(0, "usuario_post", "Usuario de la publicación", { x: POST.x + 160, y: 230, w: 900, h: 70 }, "nuestro.curso", sans(50, TINTA, { peso: 700 }));
    a.foto(0, "grupal", POST);
    a.texto(0, "me_gusta", "Me gusta", { x: POST.x, y: POST.y + POST.h + 150, w: POST.w, h: 70 }, "Les gusta a todo el curso", sans(46, TINTA, { peso: 700 }));
    a.foto(0, "maestra", TUTOR, { mascara: "circle" });
    a.texto(0, "titulo_maestra", "Título del tutor", { x: TUTOR.x + TUTOR.w + 80, y: 1840, w: 860, h: 90 }, "Nuestro tutor", sans(64, TINTA, { peso: 700 }));
    a.variable(0, "curso_contratapa", "Curso y colegio", { x: TUTOR.x + TUTOR.w + 80, y: 1940, w: 860, h: 170 }, "course.withSchool", "Curso - Colegio", sans(42, GRIS, { interlineado: 1.3 }));

    // Tapa: el perfil.
    a.texto(0, "encabezado", "Encabezado del perfil", { x: PLIEGUE + 200, y: 140, w: 1000, h: 90 }, "Perfil", sans(66, TINTA, { peso: 700 }));
    a.foto(0, "individual", AVATAR, { mascara: "circle" });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1180, 1400, 130), "student.fullName", "Nombre del alumno", sans(96, TINTA, { peso: 700, alinear: "CENTER" }));
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1320, 1300, 70), "course.displayName", "Curso", sans(48, AZUL, { peso: 600, alinear: "CENTER" }));
    a.variable(0, "colegio", "Colegio", centrado(CENTRO_DER, 1395, 1300, 70), "school.name", "Colegio", sans(42, GRIS, { alinear: "CENTER" }));

    // Interior: los compañeros como historias.
    a.texto(1, "titulo_mosaico", "Título del mosaico", { x: X_MOSAICO_IZQ + 70, y: 180, w: 1300, h: 110 }, "Historias del curso", sans(84, TINTA, { peso: 700 }));
    a.texto(1, "anio", "Año", { x: X_MOSAICO_DER, y: 200, w: ANCHO_MOSAICO, h: 80 }, "Ciclo lectivo 2026", sans(48, GRIS, { alinear: "RIGHT" }));
    mosaicoEnDosPaginas(a, 440, 1770, { familia: "Montserrat", tam: 34, color: TINTA, peso: 500, interlineado: 1.1 }, {
      frame: "circle",
      gapX: 150,
      gapY: 36,
      borderWidth: 12,
      borderColor: MAGENTA,
      namePosition: "below",
      nameLines: 2,
      givenNames: "all",
    });
  },
};
