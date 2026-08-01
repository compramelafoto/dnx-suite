/**
 * Config de banners automáticos del Home (ediciones publicadas + novedades estáticas).
 * Se usa cuando no hay banners custom activos.
 */

export type SystemSlidesConfig = {
  /** Si false, no se muestran slides de ediciones. */
  editionsEnabled: boolean;
  /** Si false, no se muestran slides de novedades (spotlightNews). */
  newsEnabled: boolean;
  disabledEditionIds: string[];
  disabledNewsIds: string[];
  /** Orden preferido de edition ids (los no listados van al final). */
  editionOrder: string[];
  /** Orden preferido de news ids (los no listados van al final). */
  newsOrder: string[];
};

export const DEFAULT_SYSTEM_SLIDES_CONFIG: SystemSlidesConfig = {
  editionsEnabled: true,
  newsEnabled: true,
  disabledEditionIds: [],
  disabledNewsIds: [],
  editionOrder: [],
  newsOrder: [],
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export function parseSystemSlidesConfig(raw: unknown): SystemSlidesConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SYSTEM_SLIDES_CONFIG };
  const o = raw as Record<string, unknown>;
  return {
    editionsEnabled: o.editionsEnabled === false ? false : true,
    newsEnabled: o.newsEnabled === false ? false : true,
    disabledEditionIds: asStringArray(o.disabledEditionIds),
    disabledNewsIds: asStringArray(o.disabledNewsIds),
    editionOrder: asStringArray(o.editionOrder),
    newsOrder: asStringArray(o.newsOrder),
  };
}

/** Ordena items por lista de ids; los ausentes quedan al final en orden original. */
export function orderByIds<T>(
  items: readonly T[],
  order: readonly string[],
  idOf: (item: T) => string,
): T[] {
  if (order.length === 0) return [...items];
  const index = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const ai = index.get(idOf(a));
    const bi = index.get(idOf(b));
    if (ai == null && bi == null) return 0;
    if (ai == null) return 1;
    if (bi == null) return -1;
    return ai - bi;
  });
}

export function toggleIdInList(ids: string[], id: string, enabled: boolean): string[] {
  const set = new Set(ids);
  if (enabled) set.delete(id);
  else set.add(id);
  return [...set];
}

export function moveIdInOrder(order: string[], allIds: string[], id: string, direction: "up" | "down"): string[] {
  const base = order.length > 0 ? [...order] : [...allIds];
  for (const x of allIds) {
    if (!base.includes(x)) base.push(x);
  }
  const idx = base.indexOf(id);
  if (idx < 0) return base;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= base.length) return base;
  const next = [...base];
  const tmp = next[idx]!;
  next[idx] = next[swapWith]!;
  next[swapWith] = tmp;
  return next;
}

export type SystemSlideAdminRow = {
  id: string;
  kind: "edition" | "news";
  title: string;
  subtitle: string;
  isEnabled: boolean;
};
