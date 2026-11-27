import { prisma } from "@repo/db";
import type { GearItemKind } from "@/lib/inventario/tipos";

/**
 * Clave de modelo de «Busco»: une las distintas formas de escribir el mismo equipo («Sony FE 20mm
 * F1.8 G», «SONY Sony FE 20mm f/1.8 G») para cruzar pedidos, inventarios y publicaciones.
 */

/** Topes de «Busco» (se reexportan desde `pedidos.ts`). */
export const MAX_ACTIVE_REQUESTS = 5;
export const REQUEST_DAYS = 30;
export const NOTICES_PER_WEEK = 2;
export const CANCEL_LIMIT = 5;

/** Nombres de marca que escriben las cámaras en los metadatos -> la marca de todos los días. */
const ALIAS_MARCA: Record<string, string> = {
  "nikon corporation": "nikon",
  "canon inc.": "canon",
  "sony corporation": "sony",
  "fujifilm corporation": "fujifilm",
  "olympus imaging corp.": "olympus",
  "om digital solutions": "olympus",
};

/** Minúsculas, sin acentos y con un solo espacio entre palabras. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Sin espacios, guiones, puntos ni barras. */
function compactar(s: string): string {
  return s.replace(/[\s\-./]/g, "");
}

/** La marca normalizada, con los alias resueltos («NIKON CORPORATION» -> «nikon»). */
export function makeKey(make: string): string {
  const m = normalizar(make);
  return ALIAS_MARCA[m] ?? m;
}

/**
 * Prefijos para buscar la marca en la base (`startsWith`, sin distinguir mayúsculas): la primera
 * palabra de la marca y los alias que llevan a ella. El cruce fino lo hace `modelKey` en memoria.
 */
export function makeVariants(make: string): string[] {
  const key = makeKey(make);
  const alias = Object.keys(ALIAS_MARCA).filter((a) => ALIAS_MARCA[a] === key);
  return [...new Set([key.split(" ")[0], ...alias])].filter(Boolean);
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `marca:modelo` compactado; si el modelo repite la marca al principio, se saca. */
export function modelKey(make: string, model: string): string {
  const marca = makeKey(make);
  let modelo = normalizar(model);
  for (const prefijo of new Set([normalizar(make), marca])) {
    if (!prefijo) continue;
    const re = new RegExp(`^${escaparRegex(prefijo)}(?=[\\s\\-./]|$)`);
    if (re.test(modelo)) {
      modelo = modelo.replace(re, "");
      break;
    }
  }
  return `${compactar(marca)}:${compactar(modelo)}`;
}

const MAX_MODELOS = 500;
/** Un modelo sale en la lista sólo si lo tienen al menos tantas personas distintas. */
const MIN_PERSONAS = 3;

/**
 * Marcas y modelos que el sistema ya conoce, para el `<datalist>` del pedido. PRIVACIDAD: sólo
 * sale un modelo que tienen al menos 3 personas distintas (dueños en el inventario, sin equipos
 * robados ni perdidos, y fotógrafos que lo usaron en CLF): un modelo raro o un texto con datos
 * personales cargado en un inventario no deja ver que alguien lo tiene. Por cada modelo sale la
 * forma de escribirlo más común. Nunca dice de quién es ni cuántos hay.
 */
export async function knownModels(kind?: GearItemKind): Promise<{ make: string; model: string }[]> {
  const [inventario, avistajes] = await Promise.all([
    prisma.gearItem.findMany({
      where: { ...(kind ? { kind } : {}), status: { notIn: ["STOLEN", "LOST"] } },
      distinct: ["make", "model", "ownerId"],
      select: { make: true, model: true, ownerId: true },
    }),
    // Las series de CLF sólo son de cuerpos y lentes.
    !kind || kind === "BODY" || kind === "LENS"
      ? prisma.gearSerialSighting.findMany({
          where: { ...(kind ? { kind } : {}), photographerId: { not: null } },
          distinct: ["make", "model", "photographerId"],
          select: { make: true, model: true, photographerId: true },
        })
      : Promise.resolve([] as { make: string; model: string; photographerId: number | null }[]),
  ]);

  type Grupo = { personas: Set<number>; formas: Map<string, { make: string; model: string; n: number }> };
  const porClave = new Map<string, Grupo>();
  const filas = [
    ...inventario.map((r) => ({ make: r.make, model: r.model, persona: r.ownerId })),
    ...avistajes.map((r) => ({ make: r.make, model: r.model, persona: r.photographerId })),
  ];
  for (const r of filas) {
    if (r.persona == null) continue;
    const make = r.make.trim();
    const model = r.model.trim();
    if (!make || !model) continue;
    const k = modelKey(make, model);
    const g = porClave.get(k) ?? { personas: new Set<number>(), formas: new Map() };
    porClave.set(k, g);
    g.personas.add(r.persona);
    const forma = `${make}\u0000${model}`;
    const f = g.formas.get(forma) ?? { make, model, n: 0 };
    f.n += 1;
    g.formas.set(forma, f);
  }

  const resultado: { make: string; model: string }[] = [];
  for (const g of porClave.values()) {
    if (g.personas.size < MIN_PERSONAS) continue;
    const [mejor] = [...g.formas.values()].sort(
      (a, b) => b.n - a.n || `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`, "es"),
    );
    resultado.push({ make: mejor.make, model: mejor.model });
  }
  return resultado
    .sort((a, b) =>
      `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`, "es", { sensitivity: "base" }),
    )
    .slice(0, MAX_MODELOS);
}
