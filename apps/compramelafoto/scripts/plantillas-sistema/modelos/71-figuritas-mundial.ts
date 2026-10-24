import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, SEGURIDAD, agrandar, centrado } from "../lienzo";
import { estrella, svg } from "../texturas";
import { ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Álbum de figuritas del curso · estilo «álbum del Mundial» (sin marcas): verde de cancha, franjas
 * celestes y doradas. Adentro, el lugar vacío de cada compañero con su nombre; en la tercera hoja,
 * la plancha de figuritas (con la del dueño) para imprimir en autoadhesivo y recortar.
 */

const VERDE = "#0f6b3a";
const VERDE_CLARO = "#1b8a4e";
const CELESTE = "#75b7e8";
const DORADO = "#e6b422";
const BLANCO = "#ffffff";
const TINTA = "#0b2a1a";

const RETRATO = centrado(CENTRO_DER, 520, 920, 1226);
const GRUPAL = centrado(CENTRO_IZQ, 360, 1380, 900);

function cancha() {
  let franjas = "";
  for (let i = 0; i < 12; i++) {
    franjas += `<rect x="${i * (ANCHO / 12)}" y="0" width="${ANCHO / 12}" height="${ALTO}" fill="${i % 2 ? VERDE : VERDE_CLARO}"/>`;
  }
  return `${franjas}
    <circle cx="${CENTRO_IZQ}" cy="${ALTO / 2}" r="320" fill="none" stroke="${BLANCO}" stroke-opacity="0.18" stroke-width="14"/>
    <circle cx="${CENTRO_DER}" cy="${ALTO / 2}" r="320" fill="none" stroke="${BLANCO}" stroke-opacity="0.18" stroke-width="14"/>`;
}

function guarda(y: number) {
  return `<rect x="0" y="${y}" width="${ANCHO}" height="70" fill="${CELESTE}"/><rect x="0" y="${y + 70}" width="${ANCHO}" height="22" fill="${DORADO}"/>`;
}

function estrellas(cx: number, cy: number) {
  return [-160, 0, 160].map((d) => `<polygon points="${estrella(cx + d, cy, 50)}" fill="${DORADO}"/>`).join("");
}

export const figuritasMundial: Modelo = {
  slug: "figuritas-mundial",
  serie: "mosaicos",
  nombre: "Álbum de figuritas · Estilo mundial",
  descripcion: `Álbum de figuritas del curso, 30×20 cm, estilo álbum de fútbol (sin marcas). En la tapa, el retrato del alumno como figurita brillante; adentro, el lugar de cada compañero con su nombre para pegar su figurita; y una tercera hoja con la plancha de figuritas (incluida la del propio alumno) para imprimir en papel autoadhesivo y recortar. Juego: pegar cada figurita y aprender los nombres.`,
  categoria: "Primaria",
  filtros: { estilo: "Divertido", etiquetas: ["mosaico", "compañeros", "figuritas", "álbum", "fútbol", "juego"] },
  etiquetasDeFotos: { ...ETIQUETAS_MOSAICO, individual: "Foto del alumno (tapa y su figurita)" },

  fondoExterior: () =>
    svg(`${cancha()}${guarda(2140)}
      <rect x="${PLIEGUE + 120}" y="150" width="${PLIEGUE - 240}" height="220" rx="30" fill="${TINTA}" opacity="0.85"/>
      ${estrellas(CENTRO_DER, 1960)}`),

  fondoInterior: () =>
    svg(`<rect width="${ANCHO}" height="${ALTO}" fill="#f4f8f2"/>
      <rect x="0" y="0" width="${ANCHO}" height="250" fill="${VERDE}"/>${guarda(225)}
      <rect x="0" y="${ALTO - 60}" width="${ANCHO}" height="60" fill="${VERDE}"/>`),

  fondoPlancha: () =>
    svg(`<rect width="${ANCHO}" height="${ALTO}" fill="#ffffff"/>
      <rect x="0" y="0" width="${ANCHO}" height="200" fill="${VERDE}"/>
      <rect x="0" y="200" width="${ANCHO}" height="18" fill="${DORADO}"/>`),

  armar: (a) => {
    const titulo = (tam: number, color = BLANCO, extra = {}) => ({ familia: "Anton", tam, color, ...extra });
    const texto = (tam: number, color = TINTA, extra = {}) => ({ familia: "Montserrat", tam, color, peso: 600, ...extra });

    // Contratapa: la grupal y cómo se juega.
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 140, 1400, 170), "NUESTRO EQUIPO", titulo(130));
    a.forma(0, "marco_grupal", "Marco de la grupal", agrandar(GRUPAL, 20), { relleno: BLANCO });
    a.foto(0, "grupal", GRUPAL);
    a.texto(0, "como_se_juega", "Cómo se juega", { x: 280, y: 1360, w: PLIEGUE - 560, h: 520 },
      "¿Cómo se juega? Recortá las figuritas de la última hoja y pegá cada una en el lugar de tu compañero. ¡Sin mirar el nombre de atrás!",
      texto(66, BLANCO, { interlineado: 1.3, peso: 500 }));
    a.variable(0, "curso_contratapa", "Curso y colegio", centrado(CENTRO_IZQ, 1920, 1400, 160), "course.withSchool", "Curso - Colegio", texto(60, DORADO));

    // Tapa: el retrato como figurita brillante.
    a.texto(0, "titulo", "Título del álbum", centrado(CENTRO_DER, 170, PLIEGUE - 300, 180), "ÁLBUM DE FIGURITAS", titulo(150, DORADO));
    a.forma(0, "brillo", "Borde dorado de la figurita", agrandar(RETRATO, 40), { relleno: DORADO, radio: 40 });
    a.forma(0, "marco", "Marco blanco de la figurita", agrandar(RETRATO, 18), { relleno: BLANCO, radio: 24 });
    a.foto(0, "individual", RETRATO, { radio: 16 });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1790, PLIEGUE - 300, 140), "student.fullName", "Nombre del alumno", titulo(110));
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 2160, PLIEGUE - 400, 110), "course.displayName", "Curso", texto(64, TINTA, { peso: 700 }));

    // Interior: el lugar de cada compañero.
    a.texto(1, "titulo_album", "Título del álbum", centrado(CENTRO_IZQ, 75, 1400, 140), "MIS COMPAÑEROS", titulo(110));
    a.texto(1, "subtitulo", "Subtítulo", centrado(CENTRO_DER, 80, 1400, 120), "Pegá cada figurita en su lugar", texto(64, BLANCO));
    mosaicoEnDosPaginas(a, 330, 1900, texto(42, TINTA, { interlineado: 1.05 }), {
      frame: "rounded",
      cornerRadius: 22,
      photoAspect: 0.75,
      gapX: 40,
      gapY: 34,
      emptyPhotos: true,
      emptyFill: "#dfeee0",
      borderWidth: 6,
      borderColor: VERDE,
      namePosition: "below",
      nameLines: 2,
      givenNames: "first",
    });

    // Plancha: las figuritas con la del dueño, sin nombre, con línea de corte.
    a.texto(2, "titulo_plancha", "Título de la plancha", { x: SEGURIDAD + 60, y: 75, w: ANCHO - 2 * SEGURIDAD - 120, h: 130 },
      "FIGURITAS · recortá por la línea y pegalas en tu álbum", titulo(84));
    a.mosaico(2, "plancha", { x: SEGURIDAD + 60, y: 280, w: ANCHO - 2 * SEGURIDAD - 120, h: ALTO - 280 - SEGURIDAD - 60 },
      texto(30), {
        frame: "rounded",
        cornerRadius: 22,
        photoAspect: 0.75,
        gapX: 36,
        gapY: 36,
        borderWidth: 10,
        borderColor: DORADO,
        shadow: null,
        namePosition: "none",
        includeOwner: true,
        sortBy: "lastName",
      });
  },
};
