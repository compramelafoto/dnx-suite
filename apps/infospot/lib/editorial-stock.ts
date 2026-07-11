/**
 * Imágenes editoriales temporales (libres) mientras no haya coberturas reales.
 * Locales en /public/editorial-stock — nunca placeholders grises.
 * Temas con energía: deporte, recitales, running, festivales, gente.
 */

export const EDITORIAL_STOCK = [
  {
    id: "football",
    src: "/editorial-stock/football.jpg",
    alt: "Partido de fútbol en estadio",
    theme: "deporte",
  },
  {
    id: "running",
    src: "/editorial-stock/running.jpg",
    alt: "Corredores en competencia",
    theme: "running",
  },
  {
    id: "motorsport",
    src: "/editorial-stock/motorsport.jpg",
    alt: "Automovilismo en pista",
    theme: "automovilismo",
  },
  {
    id: "concert",
    src: "/editorial-stock/concert.jpg",
    alt: "Público en un recital",
    theme: "recitales",
  },
  {
    id: "culture",
    src: "/editorial-stock/culture.jpg",
    alt: "Escena cultural",
    theme: "cultura",
  },
  {
    id: "festival",
    src: "/editorial-stock/festival.jpg",
    alt: "Festival al aire libre",
    theme: "festivales",
  },
  {
    id: "photography",
    src: "/editorial-stock/photography.jpg",
    alt: "Fotógrafo en cobertura",
    theme: "fotografía",
  },
  {
    id: "nature",
    src: "/editorial-stock/nature.jpg",
    alt: "Paisaje natural",
    theme: "naturaleza",
  },
  {
    id: "people",
    src: "/editorial-stock/people.jpg",
    alt: "Personas en un evento",
    theme: "gente",
  },
  {
    id: "stadium",
    src: "/editorial-stock/stadium.jpg",
    alt: "Estadio durante un evento",
    theme: "deporte",
  },
] as const;

export type EditorialStockId = (typeof EDITORIAL_STOCK)[number]["id"];
export type EditorialStockItem = (typeof EDITORIAL_STOCK)[number];

/** Pool de portada: acción y emoción (nunca escenas de oficina/notebook). */
const ENERGETIC_IDS: EditorialStockId[] = [
  "concert",
  "running",
  "football",
  "stadium",
  "festival",
  "motorsport",
  "people",
  "photography",
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function byId(id: EditorialStockId): EditorialStockItem {
  return EDITORIAL_STOCK.find((item) => item.id === id) ?? EDITORIAL_STOCK[0]!;
}

function fromPool(seed: string, pool: EditorialStockId[]): EditorialStockItem {
  const index = hashSeed(seed) % pool.length;
  return byId(pool[index]!);
}

/** Elige una foto editorial estable a partir de un seed (id/slug). */
export function pickEditorialStock(seed: string): EditorialStockItem {
  const index = hashSeed(seed) % EDITORIAL_STOCK.length;
  return EDITORIAL_STOCK[index]!;
}

/**
 * Stock temático con energía según categoría/título.
 * Evita naturaleza estática como primera opción de portada.
 */
export function pickThematicStock(
  seed: string,
  hint?: string | null,
): EditorialStockItem {
  const h = (hint || "").toLowerCase();

  if (
    h.includes("deport") ||
    h.includes("fútbol") ||
    h.includes("futbol") ||
    h.includes("clásico") ||
    h.includes("clasico")
  ) {
    return fromPool(seed, ["football", "stadium", "running", "motorsport"]);
  }
  if (
    h.includes("run") ||
    h.includes("marat") ||
    h.includes("carrera") ||
    h.includes("trail")
  ) {
    return fromPool(seed, ["running", "people", "stadium"]);
  }
  if (
    h.includes("auto") ||
    h.includes("motor") ||
    h.includes("rally") ||
    h.includes("tc")
  ) {
    return fromPool(seed, ["motorsport", "stadium"]);
  }
  if (
    h.includes("recital") ||
    h.includes("música") ||
    h.includes("musica") ||
    h.includes("concierto") ||
    h.includes("show")
  ) {
    return fromPool(seed, ["concert", "festival", "people"]);
  }
  if (h.includes("festival") || h.includes("feria")) {
    return fromPool(seed, ["festival", "people", "culture"]);
  }
  if (h.includes("cultur") || h.includes("arte")) {
    return fromPool(seed, ["culture", "festival", "people", "concert"]);
  }
  if (h.includes("foto")) {
    return fromPool(seed, ["photography", "people", "concert"]);
  }
  if (h.includes("evento") || h.includes("agenda")) {
    return fromPool(seed, ["concert", "festival", "running", "people"]);
  }

  return fromPool(seed, ENERGETIC_IDS);
}

/** Portada: siempre energía visual (acción, no contemplación). */
export function pickHeroStock(
  seed: string,
  hint?: string | null,
): EditorialStockItem {
  const h = (hint || "").toLowerCase();
  if (
    h.includes("deport") ||
    h.includes("fútbol") ||
    h.includes("futbol") ||
    h.includes("clásico") ||
    h.includes("clasico")
  ) {
    return fromPool(seed, ["football", "stadium", "running", "motorsport"]);
  }
  if (h.includes("run") || h.includes("marat") || h.includes("carrera")) {
    return fromPool(seed, ["running", "stadium", "people"]);
  }
  if (h.includes("cultur") || h.includes("arte") || h.includes("feria")) {
    return fromPool(seed, ["festival", "concert", "culture"]);
  }
  if (h.includes("foto")) {
    return fromPool(seed, ["photography", "concert", "festival"]);
  }
  // Default portada: recital / deporte / festival — nunca notebook ni paisaje quieto.
  return fromPool(seed, [
    "concert",
    "running",
    "football",
    "stadium",
    "festival",
    "motorsport",
  ]);
}

/** Resuelve cover real. Sin foto: null (no inyectar stock anónimo en producción). */
export function resolveEditorialImageUrl(
  url: string | null | undefined,
): string | null {
  if (url && url.trim()) return url;
  return null;
}

export function resolveEditorialImageAlt(
  alt: string | null | undefined,
  seed: string,
  hint?: string | null,
): string {
  if (alt && alt.trim()) return alt;
  return pickThematicStock(seed, hint).alt;
}
