import { caras, panelDeFondo } from "../apaisado";
import { ALTO, ANCHO, agrandar } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Clásico · Marco dorado (apaisado): marfil con doble filete dorado y tipografías con serifa. Tapa
 * con la foto individual y el nombre del colegio; contratapa con el listado; adentro, la grupal y
 * la foto con la maestra.
 */

const MARFIL = "#fbf6ea";
const ORO = "#b8933f";
const AZUL = "#1d2a44";

const T_IND = { x: 260, y: 330, w: 820, h: 1110 };
const I_GRU = { x: 300, y: 300, w: 1760, h: 1100 };
const I_MAE = { x: 210, y: 2030, w: 1060, h: 1260 };

/** Doble filete dorado a `d` del borde de una cara leída derecha (w × h). */
function filetes(w: number, h: number, d: number, arriba = d) {
  return `<rect x="${d}" y="${arriba}" width="${w - 2 * d}" height="${h - arriba - d}" fill="none" stroke="${ORO}" stroke-width="10"/>
    <rect x="${d + 26}" y="${arriba + 26}" width="${w - 2 * d - 52}" height="${h - arriba - d - 52}" fill="none" stroke="${ORO}" stroke-width="3"/>`;
}

function marcoFoto(r: { x: number; y: number; w: number; h: number }) {
  const a = agrandar(r, 30);
  const b = agrandar(r, 12);
  return `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="${ORO}"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${MARFIL}"/>`;
}

function adorno(cx: number, cy: number, ancho: number) {
  return `<line x1="${cx - ancho / 2}" y1="${cy}" x2="${cx - 40}" y2="${cy}" stroke="${ORO}" stroke-width="4"/>
    <line x1="${cx + 40}" y1="${cy}" x2="${cx + ancho / 2}" y2="${cy}" stroke="${ORO}" stroke-width="4"/>
    <rect x="${cx - 18}" y="${cy - 18}" width="36" height="36" fill="${ORO}" transform="rotate(45 ${cx} ${cy})"/>`;
}

const defs = () => filtroGrano("g", 0.8);

export const clasicoApaisadoDorado: Modelo = {
  slug: "clasico-apaisado-dorado",
  serie: "variadas",
  nombre: "Librito Clásico · Marco dorado apaisado",
  descripcion:
    "Librito 30×20 cm apaisado (se lee de costado), clásico: fondo marfil con doble filete dorado y tipografías con serifa. Foto individual y nombre del colegio en la tapa, listado en la contratapa; adentro, la foto grupal y la foto con la maestra.",
  categoria: "Formal",
  filtros: { estilo: "Clásico", orientacion: "horizontal", etiquetas: ["dorado", "maestra", "apaisado", "clásico"] },

  fondoExterior: () => {
    const tapa = panelDeFondo("tapa");
    const contra = panelDeFondo("contratapa");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${MARFIL}"/>
       ${tapa.svg(`${filetes(2362, 1771, 90, 130)}${marcoFoto(T_IND)}${adorno(1670, 800, 700)}`)}
       ${contra.svg(`${filetes(2362, 1771, 90, 130)}${adorno(1181, 440, 900)}`)}
       ${grano("g", 0.05)}`,
      defs(),
    );
  },

  fondoInterior: () => {
    const i = panelDeFondo("interior");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${MARFIL}"/>
       ${i.svg(`${filetes(2362, 1771, 90)}
         <g transform="translate(0 1771)">${filetes(2362, 1772, 90)}</g>
         ${marcoFoto(I_GRU)}${marcoFoto(I_MAE)}${adorno(1780, 2470, 600)}`)}
       ${grano("g", 0.05)}`,
      defs(),
    );
  },

  armar: (a) => {
    const { tapa, contratapa, interior } = caras(a);

    // Tapa
    tapa.foto("individual", T_IND);
    tapa.variable("colegio", "Nombre del colegio", { x: 1190, y: 380, w: 960, h: 360 }, "school.name", "Nombre del colegio", {
      familia: "Playfair Display", tam: 96, color: AZUL, peso: 700, interlineado: 1.15,
    });
    tapa.texto("titulo", "Título", { x: 1190, y: 870, w: 960, h: 190 }, "Recuerdo escolar", { familia: "Parisienne", tam: 130, color: ORO });
    tapa.texto("anio", "Año", { x: 1190, y: 1070, w: 960, h: 130 }, "2026", { familia: "Libre Baskerville", tam: 84, color: AZUL });
    tapa.variable("alumno", "Nombre del alumno", { x: 1190, y: 1240, w: 960, h: 210 }, "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 78, color: AZUL, italica: true, interlineado: 1.15,
    });

    // Contratapa
    contratapa.texto("titulo_listado", "Título del listado", { x: 200, y: 220, w: 1960, h: 190 }, "Compañeros", {
      familia: "Parisienne", tam: 140, color: ORO,
    });
    contratapa.listado({ x: 260, y: 520, w: 1840, h: 1070 }, { familia: "Libre Baskerville", tam: 54, color: AZUL, interlineado: 1.4 }, 3);

    // Interior arriba: la grupal
    interior.texto("titulo_grupal", "Título foto grupal", { x: 200, y: 130, w: 1960, h: 150 }, "Nuestro curso", {
      familia: "Parisienne", tam: 110, color: ORO,
    });
    interior.foto("grupal", I_GRU);
    interior.variable("curso_colegio", "Curso y colegio", { x: 200, y: 1450, w: 1960, h: 140 }, "course.withSchool", "Curso - Colegio", {
      familia: "Playfair Display", tam: 64, color: AZUL, italica: true,
    });

    // Interior abajo: la maestra
    interior.foto("maestra", I_MAE);
    interior.texto("titulo_maestra", "Título foto con la maestra", { x: 1360, y: 2230, w: 820, h: 200 }, "Con mi maestra", {
      familia: "Parisienne", tam: 120, color: ORO,
    });
    interior.texto("frase_maestra", "Frase", { x: 1360, y: 2540, w: 820, h: 500 }, "Gracias por cada enseñanza y por creer en nosotros.", {
      familia: "Libre Baskerville", tam: 60, color: AZUL, italica: true, interlineado: 1.4,
    });
  },
};
