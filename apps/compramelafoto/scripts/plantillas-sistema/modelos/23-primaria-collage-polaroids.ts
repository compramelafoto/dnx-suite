import { ALTO, ANCHO, Armador, CENTRO_DER, CENTRO_IZQ, PLIEGUE, centrado, girarCon, type RolFoto, type Rect } from "../lienzo";
import { filtroGrano, grano, puntos, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Primaria · Collage de polaroids: la tapa es la foto grupal a sangre; adentro, un tablero de
 * corcho con cuatro polaroids inclinadas (individual, libre, con amigos y con la seño). Cinco
 * fotos en total; el listado va en la contratapa.
 */

const TINTA = "#2d2a26";
const ROJO = "#e4572e";
const CORCHO = "#c99a63";

type Polaroid = { rol: RolFoto; marco: Rect; giro: number; epigrafe: string };

/** Polaroid: marco blanco, foto arriba y epígrafe abajo, inclinados juntos. */
function polaroid(marco: Rect, altoFoto: number) {
  const borde = Math.round(marco.w * 0.05);
  return {
    foto: { x: marco.x + borde, y: marco.y + borde, w: marco.w - 2 * borde, h: altoFoto },
    epigrafe: { x: marco.x + borde, y: marco.y + borde + altoFoto + 20, w: marco.w - 2 * borde, h: marco.h - altoFoto - 2 * borde - 20 },
  };
}

const POLAROIDS: Polaroid[] = [
  { rol: "individual", marco: { x: 150, y: 150, w: 860, h: 1170 }, giro: -4, epigrafe: "¡Este soy yo!" },
  { rol: "libre", marco: { x: 860, y: 1260, w: 720, h: 940 }, giro: 5, epigrafe: "Un día genial" },
  { rol: "amigos", marco: { x: 1960, y: 170, w: 1400, h: 1110 }, giro: 3, epigrafe: "Con mis amigos" },
  { rol: "maestra", marco: { x: 2290, y: 1300, w: 1050, h: 900 }, giro: -3, epigrafe: "Con mi seño" },
];

const ALTOS: Record<string, number> = { individual: 920, libre: 720, amigos: 880, maestra: 690 };

function cinta(cx: number, cy: number, giro: number, color = "#f3e2a9") {
  return `<rect x="${cx - 120}" y="${cy - 34}" width="240" height="68" fill="${color}" opacity="0.85" transform="rotate(${giro} ${cx} ${cy})"/>`;
}

const CHINCHES = ["#e4572e", "#2e86ab", "#f6c23e", "#53a548"];

const FOTO_GRU: Rect = { x: PLIEGUE, y: 0, w: PLIEGUE, h: 1420 };

export const primariaCollagePolaroids: Modelo = {
  slug: "primaria-collage-polaroids",
  serie: "variadas",
  nombre: "Librito Primaria · Collage de polaroids",
  descripcion:
    "Librito 30×20 cm para primaria: la foto grupal a sangre en la tapa y, adentro, un tablero de corcho con cuatro polaroids (foto individual, foto libre, con amigos y con la seño). Cinco fotos; listado del curso en la contratapa.",
  categoria: "Primaria",
  filtros: { estilo: "Informal", orientacion: "vertical", etiquetas: ["collage", "polaroid", "amigos", "maestra", "foto a sangre"] },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#f6efe3"/>
       <rect x="0" y="0" width="${PLIEGUE}" height="${ALTO}" fill="#efe4d0"/>
       ${puntos({ x: 80, y: 80, w: PLIEGUE - 160, h: ALTO - 160 }, 46, 3, "#c8b493", 0.6)}
       <rect x="160" y="420" width="${PLIEGUE - 320}" height="1720" rx="20" fill="#fffdf7"/>
       ${cinta(300, 430, -12)}${cinta(PLIEGUE - 300, 430, 10, "#bfe0d7")}
       <rect x="${PLIEGUE}" y="1420" width="${PLIEGUE}" height="${ALTO - 1420}" fill="${ROJO}"/>
       ${grano("g", 0.05)}`,
      filtroGrano("g", 0.85),
    ),

  fondoInterior: () => {
    let tablero = `<rect width="${ANCHO}" height="${ALTO}" fill="${CORCHO}"/>`;
    for (const p of POLAROIDS) {
      const cx = p.marco.x + p.marco.w / 2;
      const cy = p.marco.y + p.marco.h / 2;
      tablero += `<rect x="${p.marco.x + 22}" y="${p.marco.y + 30}" width="${p.marco.w}" height="${p.marco.h}" fill="#000" opacity="0.22" transform="rotate(${p.giro} ${cx} ${cy})"/>`;
    }
    return svg(
      `${tablero}
       <rect width="${ANCHO}" height="${ALTO}" filter="url(#corcho)" opacity="0.5" style="mix-blend-mode:multiply"/>`,
      `<filter id="corcho" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="3" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.30  0 0 0 0 0.15  0 0 0 0.9 0"/></filter>`,
    );
  },

  armar: (a: Armador) => {
    // Tapa: la grupal a sangre y una franja roja con los datos
    a.foto(0, "grupal", FOTO_GRU);
    a.texto(0, "titulo", "Título", centrado(CENTRO_DER, 1480, 1500, 240), "Nuestro año", {
      familia: "Permanent Marker", tam: 170, color: "#ffffff",
    });
    a.variable(0, "colegio", "Nombre de la escuela", centrado(CENTRO_DER, 1740, 1500, 220), "school.name", "Nombre de la escuela", {
      familia: "Patrick Hand", tam: 92, color: "#ffffff", interlineado: 1.1,
    });
    a.variable(0, "curso", "Grado", centrado(CENTRO_DER, 1970, 1500, 140), "course.displayName", "Grado", {
      familia: "Patrick Hand", tam: 76, color: "#ffe8dc",
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 2120, 1500, 130), "2026", { familia: "Permanent Marker", tam: 80, color: "#ffffff" });

    // Contratapa: el listado en una hoja pegada con cinta
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 160, 1400, 220), "Mi grado", {
      familia: "Permanent Marker", tam: 140, color: ROJO,
    });
    a.listado(0, { x: 240, y: 560, w: PLIEGUE - 480, h: 1500 }, { familia: "Patrick Hand", tam: 70, color: TINTA, interlineado: 1.3 }, 2);

    // Interior: las cuatro polaroids
    for (const [i, p] of POLAROIDS.entries()) {
      const { foto, epigrafe } = polaroid(p.marco, ALTOS[p.rol]!);
      a.forma(1, `marco_${p.rol}`, `Marco ${p.epigrafe}`, p.marco, { relleno: "#ffffff", giro: p.giro });
      a.foto(1, p.rol, girarCon(foto, p.marco, p.giro), { giro: p.giro });
      a.texto(1, `epigrafe_${p.rol}`, `Epígrafe ${p.rol}`, girarCon(epigrafe, p.marco, p.giro), p.epigrafe, {
        familia: "Permanent Marker", tam: 72, color: TINTA,
      }, p.giro);
      const pin = girarCon(centrado(p.marco.x + p.marco.w / 2, p.marco.y - 10, 64, 64), p.marco, p.giro);
      a.forma(1, `chinche_${p.rol}`, "Chinche", pin, { relleno: CHINCHES[i]!, circulo: true, borde: "#00000030", grosor: 4 });
    }
    // Una tarjeta con el nombre, abajo a la izquierda
    a.forma(1, "tarjeta", "Tarjeta del nombre", { x: 150, y: 1500, w: 650, h: 600 }, { relleno: "#fff6c9", giro: -2 });
    a.variable(1, "alumno", "Nombre del alumno", { x: 190, y: 1560, w: 570, h: 330 }, "student.fullName", "Nombre del alumno", {
      familia: "Permanent Marker", tam: 92, color: ROJO, interlineado: 1.1,
    }, -2);
    a.variable(1, "curso", "Grado", { x: 190, y: 1910, w: 570, h: 150 }, "course.displayName", "Grado", {
      familia: "Patrick Hand", tam: 64, color: TINTA,
    }, -2);
  },
};
