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

/**
 * Marcas y modelos que el sistema ya conoce (inventarios y series vistas en CLF), sin repetir el
 * mismo modelo, para el `<datalist>` del pedido. Nunca dice de quién es cada equipo.
 */
export async function knownModels(kind?: GearItemKind): Promise<{ make: string; model: string }[]> {
  const where = kind ? { kind } : {};
  const consulta = {
    where,
    distinct: ["make", "model"] as Array<"make" | "model">,
    select: { make: true, model: true },
    orderBy: [{ make: "asc" as const }, { model: "asc" as const }],
    take: MAX_MODELOS,
  };
  const [inventario, avistajes] = await Promise.all([
    prisma.gearItem.findMany(consulta),
    // Las series de CLF sólo son de cuerpos y lentes.
    !kind || kind === "BODY" || kind === "LENS"
      ? prisma.gearSerialSighting.findMany({ ...consulta, where: kind ? { kind } : {} })
      : Promise.resolve([] as { make: string; model: string }[]),
  ]);

  const porClave = new Map<string, { make: string; model: string }>();
  for (const r of [...inventario, ...avistajes]) {
    const make = r.make.trim();
    const model = r.model.trim();
    if (!make || !model) continue;
    const k = modelKey(make, model);
    if (!porClave.has(k)) porClave.set(k, { make, model });
  }
  return [...porClave.values()]
    .sort((a, b) =>
      `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`, "es", { sensitivity: "base" }),
    )
    .slice(0, MAX_MODELOS);
}
