import type { Tema } from "./tema";

/**
 * Los estilos que el fotógrafo elige para un evento.
 *
 * Cada uno son cuatro colores, una tipografía y una textura: se aplican a la puerta del
 * invitado y a la pantalla del salón. Siguen siendo **datos**, no un motor.
 *
 * Están agrupados en familias porque el fotógrafo no busca "un violeta": busca "algo para
 * unos quince" o "algo para un congreso". La familia es la pregunta que trae en la cabeza.
 *
 * **Cuatro tipografías y no una por estilo.** El invitado las descarga con datos móviles
 * en un salón lleno de gente, y cada familia extra son kilobytes que paga él. Cada una
 * hace algo que las otras no: la sans para casi todo, la serif donde el papel importa,
 * la de cartel para leerse de lejos proyectada, y la manuscrita para lo informal.
 */

export type FamiliaDeEstilo = "fiesta" | "clasico" | "sobrio";

export type Plantilla = {
  clave: string;
  nombre: string;
  familia: FamiliaDeEstilo;
  /** Para qué evento se pensó, en la voz del fotógrafo que la elige. */
  descripcion: string;
  tokens: Tema;
};

export const FAMILIAS: { clave: FamiliaDeEstilo; nombre: string; ayuda: string }[] = [
  { clave: "fiesta", nombre: "Fiesta", ayuda: "Quince, cumpleaños, casamientos de noche." },
  { clave: "clasico", nombre: "Clásico", ayuda: "Bodas, egresos, actos. Elegante y tranquilo." },
  { clave: "sobrio", nombre: "Sobrio", ayuda: "Empresas, congresos, lanzamientos." },
];

const SANS = "var(--slf-font)";
const SERIF = "var(--slf-font-serif)";
const CARTEL = "var(--slf-font-cartel)";
const MANO = "var(--slf-font-mano)";

export const PLANTILLAS: Plantilla[] = [
  // ─── Fiesta ──────────────────────────────────────────────────────────────────
  {
    clave: "luces",
    nombre: "Luces",
    familia: "fiesta",
    descripcion: "Quince. La pista con las luces prendidas, no el vestido.",
    tokens: {
      fondo: "#14091F",
      texto: "#FFFFFF",
      acento: "#FF5C97",
      textoSobreAcento: "#14091F",
      tipografia: SANS,
      textura: "destellos",
    },
  },
  {
    clave: "pista",
    nombre: "Pista",
    familia: "fiesta",
    descripcion: "Quince y cumpleaños de 18. Letra de cartel, para leerse desde el fondo.",
    tokens: {
      fondo: "#0B0A2A",
      texto: "#FFFFFF",
      acento: "#00E5C7",
      textoSobreAcento: "#04121B",
      tipografia: CARTEL,
      textura: "confeti",
    },
  },
  {
    clave: "velitas",
    nombre: "Velitas",
    familia: "fiesta",
    descripcion: "Cumpleaños. El momento en que se apaga la luz y quedan las velas.",
    tokens: {
      fondo: "#0E1B33",
      texto: "#FFF6E8",
      acento: "#FFC24A",
      textoSobreAcento: "#0E1B33",
      tipografia: SANS,
      textura: "estrellas",
    },
  },
  {
    clave: "globos",
    nombre: "Globos",
    familia: "fiesta",
    descripcion: "Cumpleaños de chicos. Manuscrita y clara, como una tarjeta hecha a mano.",
    tokens: {
      fondo: "#1B2E5B",
      texto: "#FFFFFF",
      acento: "#FFD166",
      textoSobreAcento: "#1B2E5B",
      tipografia: MANO,
      textura: "globos",
    },
  },
  {
    clave: "neon",
    nombre: "Neón",
    familia: "fiesta",
    descripcion: "Después de medianoche. Negro y un violeta que se ve de lejos.",
    tokens: {
      fondo: "#0A0A0F",
      texto: "#F5F3FF",
      acento: "#A855F7",
      textoSobreAcento: "#0A0A0F",
      tipografia: CARTEL,
      textura: "destellos",
    },
  },

  // ─── Clásico ─────────────────────────────────────────────────────────────────
  {
    clave: "jardin-de-noche",
    nombre: "Jardín de noche",
    familia: "clasico",
    descripcion: "Bodas. El verde del follaje a las once de la noche, con dorado apagado.",
    tokens: {
      fondo: "#10261F",
      texto: "#F4EFE6",
      acento: "#C9A227",
      textoSobreAcento: "#10261F",
      tipografia: SERIF,
      textura: "trama",
    },
  },
  {
    clave: "porcelana",
    nombre: "Porcelana",
    familia: "clasico",
    descripcion: "Bodas de día y civiles. Claro, en vez del fondo oscuro de siempre.",
    tokens: {
      fondo: "#F6F1EA",
      texto: "#1E1916",
      acento: "#8E5F47",
      textoSobreAcento: "#FFFFFF",
      tipografia: SERIF,
      textura: "lunares",
    },
  },
  {
    clave: "pizarron",
    nombre: "Pizarrón",
    familia: "clasico",
    descripcion: "Egresos y actos escolares. El verde del aula y el dorado del diploma.",
    tokens: {
      fondo: "#1C3A32",
      texto: "#F3F1E7",
      acento: "#E4C05A",
      textoSobreAcento: "#1C3A32",
      tipografia: SERIF,
      textura: "trama",
    },
  },
  {
    clave: "vino",
    nombre: "Vino",
    familia: "clasico",
    descripcion: "Aniversarios y cenas. Bordó profundo con dorado viejo.",
    tokens: {
      fondo: "#2B1118",
      texto: "#F7EFE9",
      acento: "#D4A24C",
      textoSobreAcento: "#2B1118",
      tipografia: SERIF,
      textura: "estrellas",
    },
  },

  // ─── Sobrio ──────────────────────────────────────────────────────────────────
  {
    clave: "senaletica",
    nombre: "Señalética",
    familia: "sobrio",
    descripcion: "Congresos y eventos de empresa. Como la cartelería de un predio.",
    tokens: {
      fondo: "#232A2E",
      texto: "#F2F4F3",
      acento: "#3DD68C",
      textoSobreAcento: "#0B1F17",
      tipografia: SANS,
      textura: "trama",
    },
  },
  {
    clave: "oficina",
    nombre: "Oficina",
    familia: "sobrio",
    descripcion: "Lanzamientos y capacitaciones. Claro y neutro, se lleva bien con logos.",
    tokens: {
      fondo: "#F4F6F8",
      texto: "#141A21",
      acento: "#2563EB",
      textoSobreAcento: "#FFFFFF",
      tipografia: SANS,
      textura: "lunares",
    },
  },
  {
    clave: "tinta",
    nombre: "Tinta",
    familia: "sobrio",
    descripcion: "Lo más serio. Gris casi negro, sin dibujo ni color de más.",
    tokens: {
      fondo: "#17191C",
      texto: "#E9EBEE",
      acento: "#9AA4B2",
      textoSobreAcento: "#17191C",
      tipografia: SANS,
      textura: "ninguna",
    },
  },
  {
    clave: "sin-tema",
    nombre: "Sin tema",
    familia: "sobrio",
    descripcion: "Para cuando el evento pone su propia portada y no quiere competencia.",
    tokens: {
      fondo: "#1A1A1A",
      texto: "#FAFAFA",
      acento: "#EDEDED",
      textoSobreAcento: "#1A1A1A",
      tipografia: SANS,
      textura: "ninguna",
    },
  },
];

export function plantillaPorClave(clave: string): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.clave === clave);
}

/** Las plantillas de una familia, en el orden en que se definieron. */
export function plantillasDeFamilia(familia: FamiliaDeEstilo): Plantilla[] {
  return PLANTILLAS.filter((p) => p.familia === familia);
}
