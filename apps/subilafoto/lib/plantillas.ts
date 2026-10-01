import type { Tema } from "./tema";

/**
 * Las seis plantillas del lanzamiento (capítulo 8).
 *
 * Cada una son cuatro colores y una tipografía: se aplican a la puerta del invitado y a la
 * pantalla del salón. Deliberadamente pocas y buenas, en vez de una biblioteca mediocre.
 *
 * Dos familias tipográficas, no seis: el invitado las descarga con datos móviles en un
 * salón lleno de gente. La serif se reserva para los dos casos donde el papel importa
 * —la invitación de casamiento y el diploma— y el resto lleva la de la marca.
 */

export type Plantilla = {
  clave: string;
  nombre: string;
  /** Para qué evento se pensó, en la voz del fotógrafo que la elige. */
  descripcion: string;
  tokens: Tema;
};

const MONTSERRAT = "var(--slf-font)";
const SERIF = "var(--slf-font-serif)";

export const PLANTILLAS: Plantilla[] = [
  {
    clave: "jardin-de-noche",
    nombre: "Jardín de noche",
    descripcion: "Bodas. El verde del follaje a las once de la noche, con dorado apagado.",
    tokens: {
      fondo: "#10261F",
      texto: "#F4EFE6",
      acento: "#C9A227",
      textoSobreAcento: "#10261F",
      tipografia: SERIF,
    },
  },
  {
    clave: "luces",
    nombre: "Luces",
    descripcion: "Fiestas de quince. La pista con las luces prendidas, no el vestido.",
    tokens: {
      fondo: "#14091F",
      texto: "#FFFFFF",
      acento: "#FF5C97",
      textoSobreAcento: "#14091F",
      tipografia: MONTSERRAT,
    },
  },
  {
    clave: "velitas",
    nombre: "Velitas",
    descripcion: "Cumpleaños. El momento en que se apaga la luz y quedan las velas.",
    tokens: {
      fondo: "#0E1B33",
      texto: "#FFF6E8",
      acento: "#FFC24A",
      textoSobreAcento: "#0E1B33",
      tipografia: MONTSERRAT,
    },
  },
  {
    clave: "senaletica",
    nombre: "Señalética",
    descripcion: "Congresos y eventos de empresa. Sobrio, como la cartelería de un predio.",
    tokens: {
      fondo: "#232A2E",
      texto: "#F2F4F3",
      acento: "#3DD68C",
      textoSobreAcento: "#0B1F17",
      tipografia: MONTSERRAT,
    },
  },
  {
    clave: "pizarron",
    nombre: "Pizarrón",
    descripcion: "Egresos y actos escolares. El verde del aula y el dorado del diploma.",
    tokens: {
      fondo: "#1C3A32",
      texto: "#F3F1E7",
      acento: "#E4C05A",
      textoSobreAcento: "#1C3A32",
      tipografia: SERIF,
    },
  },
  {
    clave: "sin-tema",
    nombre: "Sin tema",
    descripcion: "Para cuando el evento pone su propia portada y no quiere competencia.",
    tokens: {
      fondo: "#1A1A1A",
      texto: "#FAFAFA",
      acento: "#EDEDED",
      textoSobreAcento: "#1A1A1A",
      tipografia: MONTSERRAT,
    },
  },
];

export function plantillaPorClave(clave: string): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.clave === clave);
}
