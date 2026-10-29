import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, SEGURIDAD, agrandar, centrado } from "../lienzo";
import { estrella, svg } from "../texturas";
import { birrete, cielo } from "../productos/adornos";
import { ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Álbum de figuritas del curso · egresados: negro y dorado con estrellas y birretes. Para
 * la promoción. Como los otros álbumes: el lugar de cada compañero adentro y la plancha para recortar.
 */

const NOCHE = "#151515";
const CELESTE = "#d4af37";
const AMARILLO = "#f1d77a";
const BLANCO = "#ffffff";

const RETRATO = centrado(CENTRO_DER, 560, 900, 900);
const GRUPAL = centrado(CENTRO_IZQ, 380, 1360, 880);

export const figuritasEgresados: Modelo = {
  slug: "figuritas-egresados",
  serie: "figuritas",
  nombre: "Álbum de figuritas · Egresados",
  descripcion:
    "Álbum de figuritas del curso, 30×20 cm, para egresados: negro y dorado con estrellas. En la tapa, el retrato del alumno como figurita; adentro, el lugar de cada compañero con su nombre; y una tercera hoja con la plancha de figuritas (incluida la del propio alumno) para imprimir en papel autoadhesivo y recortar.",
  categoria: "Egresados",
  filtros: { estilo: "Divertido", etiquetas: ["mosaico", "compañeros", "figuritas", "álbum", "egresados", "promoción", "dorado"] },
  etiquetasDeFotos: { ...ETIQUETAS_MOSAICO, individual: "Foto del alumno (tapa y su figurita)" },

  fondoExterior: () =>
    svg(`<rect width="${ANCHO}" height="${ALTO}" fill="${NOCHE}"/>
      ${cielo({ x: 0, y: 0, w: ANCHO, h: ALTO }, 160, [BLANCO, CELESTE, AMARILLO], 73, [8, 26], [
        agrandar(RETRATO, 80),
        agrandar(GRUPAL, 60),
        // Los textos: títulos, cómo se juega, nombre y curso.
        { x: 150, y: 90, w: ANCHO - 300, h: 260 },
        { x: 250, y: 1330, w: PLIEGUE - 500, h: 520 },
        { x: PLIEGUE + 100, y: 1500, w: PLIEGUE - 200, h: 340 },
      ])}
      ${birrete(360, 2030, 150, "#2a2a2a", CELESTE, -12)}${birrete(ANCHO - 330, 2060, 130, "#2a2a2a", CELESTE, 14)}
    `),

  fondoInterior: () =>
    svg(`<rect width="${ANCHO}" height="${ALTO}" fill="#fbf8f1"/>
      <rect x="0" y="0" width="${ANCHO}" height="250" fill="${NOCHE}"/>
      ${cielo({ x: 0, y: 0, w: ANCHO, h: 250 }, 60, [BLANCO, CELESTE, AMARILLO], 74, [6, 18], [
        { x: CENTRO_IZQ - 520, y: 40, w: 1040, h: 190 },
        { x: CENTRO_DER - 760, y: 40, w: 1520, h: 190 },
      ])}
      <rect x="0" y="${ALTO - 70}" width="${ANCHO}" height="70" fill="${NOCHE}"/>`),

  fondoPlancha: () =>
    svg(`<rect width="${ANCHO}" height="${ALTO}" fill="#ffffff"/>
      <rect x="0" y="0" width="${ANCHO}" height="190" fill="${NOCHE}"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<polygon points="${estrella(200 + i * 620, 95, 26)}" fill="${AMARILLO}"/>`).join("")}`),

  armar: (a) => {
    const juego = (tam: number, color = NOCHE, extra = {}) => ({ familia: "Montserrat", tam, color, peso: 800, ...extra });
    const nombres = (tam: number) => ({ familia: "Nunito", tam, color: NOCHE, peso: 700, interlineado: 1.05 });

    // Contratapa
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 170, 1400, 170), "Nuestra promoción", juego(100, CELESTE));
    a.forma(0, "marco_grupal", "Marco de la grupal", agrandar(GRUPAL, 22), { relleno: CELESTE, radio: 30 });
    a.foto(0, "grupal", GRUPAL, { radio: 20 });
    a.texto(0, "como_se_juega", "Cómo se juega", { x: 300, y: 1370, w: PLIEGUE - 600, h: 420 },
      "Recortá las figuritas de la última hoja y pegá cada una en el lugar de tu compañero. ¡Completá la promo!",
      juego(60, BLANCO, { interlineado: 1.3, peso: 600 }));

    // Tapa
    a.texto(0, "titulo", "Título del álbum", centrado(CENTRO_DER, 180, PLIEGUE - 300, 200), "Álbum de la promo", juego(120, AMARILLO));
    a.forma(0, "brillo", "Borde de la figurita", agrandar(RETRATO, 36), { relleno: CELESTE, radio: 70 });
    a.forma(0, "marco", "Marco de la figurita", agrandar(RETRATO, 16), { relleno: BLANCO, radio: 56 });
    a.foto(0, "individual", RETRATO, { radio: 46 });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1530, PLIEGUE - 300, 150), "student.fullName", "Nombre del alumno", juego(100, BLANCO));
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1690, PLIEGUE - 300, 110), "course.withSchool", "Curso - Colegio", juego(54, CELESTE, { peso: 600 }));

    // Interior
    a.texto(1, "titulo_album", "Título del álbum", centrado(CENTRO_IZQ, 75, 1400, 140), "Mis compañeros", juego(90, AMARILLO));
    a.texto(1, "subtitulo", "Subtítulo", centrado(CENTRO_DER, 85, 1400, 110), "Pegá cada figurita en su lugar", juego(56, CELESTE, { peso: 600 }));
    mosaicoEnDosPaginas(a, 300, 1930, nombres(46), {
      frame: "rounded",
      cornerRadius: 46,
      photoAspect: 0.8,
      gapX: 44,
      gapY: 36,
      emptyPhotos: true,
      emptyFill: "#f4efe2",
      borderWidth: 6,
      borderColor: NOCHE,
      namePosition: "below",
      nameLines: 1,
      givenNames: "first",
    });

    // Plancha
    a.texto(2, "titulo_plancha", "Título de la plancha", { x: SEGURIDAD + 60, y: 75, w: ANCHO - 2 * SEGURIDAD - 120, h: 120 },
      "Mis figuritas: recortalas por la línea y pegalas en el álbum", juego(66, BLANCO));
    a.mosaico(2, "plancha", { x: SEGURIDAD + 60, y: 260, w: ANCHO - 2 * SEGURIDAD - 120, h: ALTO - 260 - SEGURIDAD - 60 },
      nombres(30), {
        frame: "rounded",
        cornerRadius: 46,
        photoAspect: 0.8,
        gapX: 36,
        gapY: 36,
        borderWidth: 10,
        borderColor: CELESTE,
        namePosition: "none",
        includeOwner: true,
        sortBy: "firstName",
      });
  },
};
