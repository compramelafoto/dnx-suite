import type { PhotoPromptInspirationType } from "./types";
import { INITIAL_SOURCE_PREFIX } from "./types";

export type InitialThemeSeed = {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
};

export type InitialSubthemeSeed = {
  themeSlug: "cine";
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
};

export type InitialPromptSeed = {
  sourceKey: string;
  title: string;
  description: string;
  themeSlug: string;
  subthemeSlug?: string;
  inspirationType?: PhotoPromptInspirationType;
  inspirationLabel?: string;
  inspirationNotes?: string;
  tags: string[];
  difficulty: "MEDIUM";
  language: "es";
  universal: true;
};

export const INITIAL_THEMES: InitialThemeSeed[] = [
  { name: "Luz", slug: "luz", description: "Relación entre luz, sombra e iluminación.", sortOrder: 1 },
  { name: "Color", slug: "color", description: "Dominancia, contraste y emoción del color.", sortOrder: 2 },
  { name: "Movimiento", slug: "movimiento", description: "Acción, velocidad y ritmo visual.", sortOrder: 3 },
  { name: "Vida cotidiana", slug: "vida-cotidiana", description: "Gestos y momentos del día a día.", sortOrder: 4 },
  { name: "Formas y geometría", slug: "formas-y-geometria", description: "Formas, líneas y estructuras.", sortOrder: 5 },
  { name: "Perspectiva", slug: "perspectiva", description: "Punto de vista, escala y profundidad.", sortOrder: 6 },
  { name: "Texturas y detalles", slug: "texturas-y-detalles", description: "Superficies, detalles e imperfecciones.", sortOrder: 7 },
  { name: "Contrastes", slug: "contrastes", description: "Oposiciones visuales y conceptuales.", sortOrder: 8 },
  { name: "Concepto y emoción", slug: "concepto-y-emocion", description: "Ideas y estados de ánimo.", sortOrder: 9 },
  { name: "Creatividad", slug: "creatividad", description: "Juego visual y ambigüedad.", sortOrder: 10 },
  { name: "Cine", slug: "cine", description: "Lenguaje cinematográfico como inspiración editorial.", sortOrder: 11 },
];

export const INITIAL_CINE_SUBTHEMES: InitialSubthemeSeed[] = [
  { themeSlug: "cine", name: "Director", slug: "director", description: "Lenguaje visual de dirección (referencia editorial).", sortOrder: 1 },
  { themeSlug: "cine", name: "Película", slug: "pelicula", description: "Referencia editorial a una obra (no afiliación oficial).", sortOrder: 2 },
  { themeSlug: "cine", name: "Género", slug: "genero", description: "Atmósfera de género cinematográfico.", sortOrder: 3 },
  { themeSlug: "cine", name: "Composición cinematográfica", slug: "composicion-cinematografica", description: "Encuadre, geometría y equilibrio de escena.", sortOrder: 4 },
  { themeSlug: "cine", name: "Iluminación cinematográfica", slug: "iluminacion-cinematografica", description: "Luz y sombra con clima de cine.", sortOrder: 5 },
  { themeSlug: "cine", name: "Narrativa cinematográfica", slug: "narrativa-cinematografica", description: "Antes/después y atmósfera narrativa.", sortOrder: 6 },
];

function sk(n: number): string {
  return `${INITIAL_SOURCE_PREFIX}_${String(n).padStart(2, "0")}`;
}

function p(
  n: number,
  title: string,
  description: string,
  themeSlug: string,
  extra?: Partial<InitialPromptSeed>,
): InitialPromptSeed {
  return {
    sourceKey: sk(n),
    title,
    description,
    themeSlug,
    tags: [themeSlug],
    difficulty: "MEDIUM",
    language: "es",
    universal: true,
    ...extra,
  };
}

/**
 * Catálogo inicial DNX — 55 consignas exactas (ETAPA 13).
 * Seed: status=DRAFT, language=es, universal=true.
 */
export const INITIAL_PROMPTS: InitialPromptSeed[] = [
  // Luz 01–05
  p(1, "Entre luces y sombras", "Crear una imagen donde la relación entre luz y sombra sea protagonista.", "luz"),
  p(2, "Un rayo de luz", "Encontrar una escena donde una fuente de luz destaque un elemento particular.", "luz"),
  p(3, "Contraluz", "Construir una fotografía utilizando la luz detrás del sujeto.", "luz"),
  p(4, "La luz transforma", "Fotografiar algo cotidiano que cambie completamente gracias a la iluminación.", "luz"),
  p(5, "Reflejos de luz", "Utilizar agua, vidrio, metal u otra superficie para trabajar con reflejos.", "luz"),

  // Color 06–10
  p(6, "Un color protagonista", "Realizar una fotografía donde un único color domine visualmente.", "color"),
  p(7, "Contraste de colores", "Encontrar dos o más colores que generen una tensión visual fuerte.", "color"),
  p(8, "Color inesperado", "Descubrir un elemento cuyo color destaque dentro de su entorno.", "color"),
  p(9, "Una paleta natural", "Construir una imagen utilizando colores encontrados espontáneamente.", "color"),
  p(10, "Color y emoción", "Crear una fotografía donde el color ayude a transmitir un estado de ánimo.", "color"),

  // Movimiento 11–15
  p(11, "Movimiento detenido", "Congelar una acción en el instante preciso.", "movimiento"),
  p(12, "El movimiento se siente", "Crear una imagen donde el movimiento sea evidente.", "movimiento"),
  p(13, "Algo pasa rápido", "Fotografiar una situación relacionada con velocidad.", "movimiento"),
  p(14, "Movimiento humano", "Mostrar una acción cotidiana mediante el cuerpo o sus gestos.", "movimiento"),
  p(15, "Ritmo", "Encontrar repetición o secuencia que produzca sensación de movimiento.", "movimiento"),

  // Vida cotidiana 16–20
  p(16, "Un gesto", "Fotografiar un gesto capaz de contar algo sin palabras.", "vida-cotidiana"),
  p(17, "Manos que cuentan historias", "Utilizar las manos como protagonistas.", "vida-cotidiana"),
  p(18, "Una pausa", "Encontrar un momento de descanso o espera.", "vida-cotidiana"),
  p(19, "Encuentro", "Representar el encuentro entre personas, objetos o situaciones.", "vida-cotidiana"),
  p(20, "La vida sucede", "Capturar un momento cotidiano que normalmente pasaría desapercibido.", "vida-cotidiana"),

  // Formas y geometría 21–25
  p(21, "Geometría cotidiana", "Encontrar formas geométricas dentro del entorno.", "formas-y-geometria"),
  p(22, "Líneas que conducen", "Utilizar líneas para dirigir visualmente la mirada.", "formas-y-geometria"),
  p(23, "Simetría", "Construir una composición basada en equilibrio o simetría.", "formas-y-geometria"),
  p(24, "Repetición", "Encontrar elementos repetidos y convertirlos en protagonistas.", "formas-y-geometria"),
  p(25, "Una forma dentro de otra", "Buscar una composición donde diferentes formas dialoguen.", "formas-y-geometria"),

  // Perspectiva 26–30
  p(26, "Desde abajo", "Fotografiar utilizando un punto de vista bajo.", "perspectiva"),
  p(27, "Desde arriba", "Construir una imagen mirando hacia abajo.", "perspectiva"),
  p(28, "Otra escala", "Hacer que algo pequeño parezca grande o viceversa.", "perspectiva"),
  p(29, "Punto de vista inesperado", "Fotografiar algo cotidiano desde una posición poco habitual.", "perspectiva"),
  p(30, "Cerca y lejos", "Crear profundidad utilizando distintos planos.", "perspectiva"),

  // Texturas y detalles 31–35
  p(31, "Textura", "Crear una fotografía donde podamos imaginar cómo se siente una superficie.", "texturas-y-detalles"),
  p(32, "El pequeño detalle", "Encontrar algo que normalmente pasaría inadvertido.", "texturas-y-detalles"),
  p(33, "Huellas del tiempo", "Fotografiar señales de uso, desgaste, envejecimiento o transformación.", "texturas-y-detalles"),
  p(34, "Patrones naturales", "Encontrar repetición o estructura dentro del entorno.", "texturas-y-detalles"),
  p(35, "Imperfección", "Convertir un defecto o irregularidad en protagonista.", "texturas-y-detalles"),

  // Contrastes 36–40
  p(36, "Nuevo y viejo", "Mostrar elementos que representen distintas épocas o estados.", "contrastes"),
  p(37, "Grande y pequeño", "Construir una imagen basada en la diferencia de escala.", "contrastes"),
  p(38, "Orden y caos", "Encontrar ambos conceptos conviviendo.", "contrastes"),
  p(39, "Quietud y movimiento", "Representar simultáneamente algo estático y algo dinámico.", "contrastes"),
  p(40, "Natural y artificial", "Mostrar el encuentro entre naturaleza y elementos creados por personas.", "contrastes"),

  // Concepto y emoción 41–45
  p(41, "Soledad", "Interpretar visualmente la idea de estar solo.", "concepto-y-emocion"),
  p(42, "Alegría", "Representar alegría sin necesidad de mostrar un rostro.", "concepto-y-emocion"),
  p(43, "Espera", "Crear una imagen que transmita que algo todavía no ocurrió.", "concepto-y-emocion"),
  p(44, "Libertad", "Interpretar libremente el concepto de libertad.", "concepto-y-emocion"),
  p(45, "Misterio", "Crear una fotografía que deje una pregunta abierta.", "concepto-y-emocion"),

  // Creatividad 46–50
  p(46, "Dentro de un marco", "Utilizar elementos del entorno para crear un marco dentro de la fotografía.", "creatividad"),
  p(47, "Reflejo", "Hacer del reflejo el protagonista.", "creatividad"),
  p(48, "Algo no es lo que parece", "Crear una fotografía visualmente ambigua.", "creatividad"),
  p(49, "Dos mundos", "Mostrar dos situaciones diferentes coexistiendo en una misma imagen.", "creatividad"),
  p(50, "Una historia en una foto", "Construir una fotografía que invite a imaginar qué ocurrió antes o después.", "creatividad"),

  // Cine 51–55
  p(
    51,
    "Simetría de película",
    "Construí una escena con composición frontal, geometría marcada, equilibrio visual y una estética cuidadosamente ordenada. Inspirate en un lenguaje visual; no copies escenas exactas ni presentes afiliación oficial.",
    "cine",
    {
      subthemeSlug: "composicion-cinematografica",
      inspirationType: "DIRECTOR",
      inspirationLabel: "Wes Anderson",
      inspirationNotes:
        "Referencia editorial a un lenguaje visual. No almacenar fotogramas/posters protegidos. No afiliación oficial.",
      tags: ["cine", "director", "composicion"],
    },
  ),
  p(
    52,
    "Sombras de suspenso",
    "Creá una fotografía donde las sombras, el encuadre y aquello que queda fuera de campo generen tensión o misterio. Inspirate en un lenguaje visual; no copies escenas exactas.",
    "cine",
    {
      subthemeSlug: "iluminacion-cinematografica",
      inspirationType: "GENRE",
      inspirationLabel: "Suspenso / Film Noir",
      inspirationNotes: "Referencia editorial de género. No afiliación oficial.",
      tags: ["cine", "genero", "sombras"],
    },
  ),
  p(
    53,
    "Un instante de película",
    "Fotografiá una situación cotidiana de manera que parezca un fotograma extraído de una película. La imagen debe hacernos imaginar qué ocurrió antes y qué sucederá después.",
    "cine",
    {
      subthemeSlug: "narrativa-cinematografica",
      inspirationType: "VISUAL_STYLE",
      inspirationLabel: "Fotograma cinematográfico",
      inspirationNotes: "Estilo visual editorial; no copiar escenas protegidas.",
      tags: ["cine", "narrativa", "fotograma"],
    },
  ),
  p(
    54,
    "Luz de otro mundo",
    "Utilizá color, iluminación, reflejos o contraste para transformar un lugar cotidiano en una escena con atmósfera fantástica o de ciencia ficción.",
    "cine",
    {
      subthemeSlug: "iluminacion-cinematografica",
      inspirationType: "GENRE",
      inspirationLabel: "Ciencia ficción / Fantasía",
      inspirationNotes: "Referencia editorial de género. No afiliación oficial.",
      tags: ["cine", "genero", "atmosfera"],
    },
  ),
  p(
    55,
    "La ciudad como protagonista",
    "Construí una fotografía donde el entorno tenga tanta importancia como las personas u objetos que aparecen en él. Buscá una atmósfera cinematográfica mediante luz, escala, profundidad y composición.",
    "cine",
    {
      subthemeSlug: "narrativa-cinematografica",
      inspirationType: "VISUAL_STYLE",
      inspirationLabel: "Cine urbano",
      inspirationNotes: "Estilo visual editorial; no afiliación oficial.",
      tags: ["cine", "ciudad", "narrativa"],
    },
  ),
];

if (INITIAL_PROMPTS.length !== 55) {
  throw new Error(`INITIAL_PROMPTS debe tener 55 items, tiene ${INITIAL_PROMPTS.length}`);
}
