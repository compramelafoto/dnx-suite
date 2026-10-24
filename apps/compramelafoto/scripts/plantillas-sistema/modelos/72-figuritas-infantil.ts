import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, SEGURIDAD, agrandar, centrado } from "../lienzo";
import { conejo, nube, oso, pollito } from "../animalitos";
import { confeti, estrella, svg } from "../texturas";
import { ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Álbum de figuritas del curso · infantil: cielo celeste, nubes, estrellitas y animalitos. Para
 * jardín y los primeros grados. Adentro, el lugar de cada compañero con su nombre; en la tercera
 * hoja, la plancha de figuritas (con la del dueño) para imprimir en autoadhesivo y recortar.
 */

const CIELO = "#d9efff";
const ROSA = "#ff8fb1";
const AMARILLO = "#ffd166";
const LILA = "#9b8cff";
const TINTA = "#2d3561";

const RETRATO = centrado(CENTRO_DER, 560, 900, 900);
const GRUPAL = centrado(CENTRO_IZQ, 380, 1360, 880);

export const figuritasInfantil: Modelo = {
  slug: "figuritas-infantil",
  serie: "mosaicos",
  nombre: "Álbum de figuritas · Infantil",
  descripcion:
    "Álbum de figuritas del curso, 30×20 cm, para jardín y primeros grados: cielo, nubes y animalitos. En la tapa, el retrato del alumno como figurita; adentro, el lugar de cada compañero con su nombre; y una tercera hoja con la plancha de figuritas (incluida la del propio alumno) para imprimir en papel autoadhesivo y recortar.",
  categoria: "Jardín",
  filtros: { estilo: "Divertido", etiquetas: ["mosaico", "compañeros", "figuritas", "álbum", "jardín", "juego"] },
  etiquetasDeFotos: { ...ETIQUETAS_MOSAICO, individual: "Foto del alumno (tapa y su figurita)" },

  fondoExterior: () =>
    svg(`<rect width="${ANCHO}" height="${ALTO}" fill="${CIELO}"/>
      ${nube(160, 120, 520, 200)}${nube(2050, 90, 460, 180)}${nube(1150, 2050, 480, 170)}${nube(2900, 2080, 460, 170)}
      ${oso(380, 2030, 210)}${conejo(PLIEGUE + 260, 2130, 140)}${pollito(ANCHO - 330, 2040, 170)}
      ${[0, 1, 2, 3].map((i) => `<polygon points="${estrella(PLIEGUE + 620 + i * 230, 2050, 36)}" fill="${[ROSA, AMARILLO, LILA, ROSA][i]}"/>`).join("")}`),

  fondoInterior: () =>
    svg(`<rect width="${ANCHO}" height="${ALTO}" fill="#fffaf0"/>
      ${confeti({ x: 40, y: 20, w: ANCHO - 80, h: 220 }, 70, [ROSA, AMARILLO, LILA, "#7cc0f5"], 7, [14, 34], [
        { x: CENTRO_IZQ - 500, y: 40, w: 1000, h: 200 },
        { x: CENTRO_DER - 760, y: 40, w: 1520, h: 200 },
      ])}
      <rect x="0" y="${ALTO - 70}" width="${ANCHO}" height="70" fill="${CIELO}"/>`),

  fondoPlancha: () =>
    svg(`<rect width="${ANCHO}" height="${ALTO}" fill="#ffffff"/>
      <rect x="0" y="0" width="${ANCHO}" height="190" fill="${CIELO}"/>`),

  armar: (a) => {
    const juego = (tam: number, color = TINTA, extra = {}) => ({ familia: "Quicksand", tam, color, peso: 700, ...extra });
    const nombres = (tam: number) => ({ familia: "Nunito", tam, color: TINTA, peso: 700, interlineado: 1.05 });

    // Contratapa
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 170, 1400, 170), "¡Nuestra sala!", juego(120, ROSA));
    a.forma(0, "marco_grupal", "Marco de la grupal", agrandar(GRUPAL, 22), { relleno: "#ffffff", radio: 30 });
    a.foto(0, "grupal", GRUPAL, { radio: 20 });
    a.texto(0, "como_se_juega", "Cómo se juega", { x: 300, y: 1370, w: PLIEGUE - 600, h: 420 },
      "Recortá las figuritas de la última hoja y pegá cada una en el lugar de tu amigo. ¿Te acordás de todos los nombres?",
      juego(62, TINTA, { interlineado: 1.3, peso: 600 }));

    // Tapa
    a.texto(0, "titulo", "Título del álbum", centrado(CENTRO_DER, 180, PLIEGUE - 300, 200), "Mi álbum de figuritas", juego(130, LILA));
    a.forma(0, "brillo", "Borde de la figurita", agrandar(RETRATO, 36), { relleno: AMARILLO, radio: 70 });
    a.forma(0, "marco", "Marco de la figurita", agrandar(RETRATO, 16), { relleno: "#ffffff", radio: 56 });
    a.foto(0, "individual", RETRATO, { radio: 46 });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1530, PLIEGUE - 300, 150), "student.fullName", "Nombre del alumno", juego(110));
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER, 1690, PLIEGUE - 300, 110), "course.withSchool", "Sala - Jardín", juego(56, ROSA));

    // Interior
    a.texto(1, "titulo_album", "Título del álbum", centrado(CENTRO_IZQ, 75, 1400, 140), "Mis amigos", juego(100, LILA));
    a.texto(1, "subtitulo", "Subtítulo", centrado(CENTRO_DER, 85, 1400, 110), "Pegá cada figurita en su lugar", juego(60, ROSA));
    mosaicoEnDosPaginas(a, 300, 1930, nombres(46), {
      frame: "rounded",
      cornerRadius: 46,
      photoAspect: 0.8,
      gapX: 44,
      gapY: 36,
      emptyPhotos: true,
      emptyFill: "#eef6ff",
      borderWidth: 6,
      borderColor: "#7cc0f5",
      namePosition: "below",
      nameLines: 1,
      givenNames: "first",
    });

    // Plancha
    a.texto(2, "titulo_plancha", "Título de la plancha", { x: SEGURIDAD + 60, y: 75, w: ANCHO - 2 * SEGURIDAD - 120, h: 120 },
      "Mis figuritas: recortalas por la línea y pegalas en el álbum", juego(70, TINTA));
    a.mosaico(2, "plancha", { x: SEGURIDAD + 60, y: 260, w: ANCHO - 2 * SEGURIDAD - 120, h: ALTO - 260 - SEGURIDAD - 60 },
      nombres(30), {
        frame: "rounded",
        cornerRadius: 46,
        photoAspect: 0.8,
        gapX: 36,
        gapY: 36,
        borderWidth: 10,
        borderColor: AMARILLO,
        namePosition: "none",
        includeOwner: true,
        sortBy: "firstName",
      });
  },
};
