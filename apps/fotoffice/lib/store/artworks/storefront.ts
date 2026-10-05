/**
 * Las obras en la tienda pública (spec O3, O8, O13, §5.5; plan Task 8).
 *
 * Una obra es pública SÓLO si se cumplen las cuatro cosas, y se vuelve a comprobar en cada
 * lectura (la vidriera, la ficha y el carrito):
 * 1. su ficha (`ArtworkListing`) está PUBLISHED en este workspace;
 * 2. su concurso es de una organización de FotoRank vinculada al workspace (la misma regla que
 *    `isContestLinked`, resuelta de una vez para todas las obras);
 * 3. el permiso del autor la deja vender (`isSellable`: avisado por las bases, o aceptado);
 * 4. hay al menos un formato activo que la resolución del original alcanza (`eligibleFormats`).
 *
 * Al navegador llegan sólo datos de FOTOFFICE: el id y la dirección de la ficha, los formatos y
 * la vista previa guardada en nuestro R2. Nunca el autor (`authorUserId`) ni ids de FotoRank: el
 * filtro por concurso usa una clave pública armada con la dirección del concurso.
 *
 * Las decisiones son funciones puras (probadas con datos a mano); las consultas son una capa
 * fina que acepta una base falsa. Toda consulta lleva `workspaceId`.
 */
import "server-only";

import { cache } from "react";

import { prisma, type Prisma } from "@repo/db";

import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";

import { CART_MAX_ARTWORK_QTY } from "../cart/constants";
import { lineKey } from "../cart/line-key";
import type { ArtworkCartLineInput, CartProblem, ValidatedArtworkLine } from "../storefront";
import { isSellable } from "./consent-basis";
import { DEFAULT_DPI } from "./format-form";
import { printFormatLabel } from "./format-label";
import { eligibleFormats, needsBorders } from "./resolution";

type Db = Pick<
  Prisma.TransactionClient,
  "artworkListing" | "artworkConsent" | "printFormat" | "storePrintSettings" | "workspaceContestOrganizationLink"
>;

/** Obras por página en la vidriera. */
export const PUBLIC_ARTWORKS_PAGE_SIZE = 24;

type Decimalish = { toString(): string };

// ── Filas (lo mínimo que leen las decisiones) ───────────────────────────────

export type ArtworkListingRow = {
  id: string;
  slug: string;
  status: string;
  entryId: string;
  title: string;
  authorDisplayName: string | null;
  awardLabel: string | null;
  previewUrl: string;
  previewWidth: number;
  previewHeight: number;
  originalWidth: number;
  originalHeight: number;
  contest: { id: string; slug: string; title: string; organizationId: string };
};

export type PrintFormatRow = {
  id: string;
  name: string;
  kind: string;
  widthCm: number;
  heightCm: number;
  priceArs: Decimalish;
  isActive: boolean;
};

export type ConsentRow = { basis: string; status: string; notifiedAt: Date | null };

export type PublicArtworkContext = {
  linkedOrganizationIds: ReadonlySet<string>;
  /** Formatos del workspace, en el orden de la institución. Los inactivos se descartan igual. */
  formats: readonly PrintFormatRow[];
  minDpi: number;
  /** Permiso del autor por obra de FotoRank (`entryId`). */
  consents: ReadonlyMap<string, ConsentRow>;
};

// ── Lo que ve el comprador ──────────────────────────────────────────────────

export type PublicArtworkFormat = {
  id: string;
  name: string;
  kind: string;
  widthCm: number;
  heightCm: number;
  priceMinor: number;
  /** La proporción del formato no es la de la foto: se imprime completa, con bordes. */
  needsBorders: boolean;
};

export type PublicArtworkDetail = {
  listingId: string;
  slug: string;
  title: string;
  authorDisplayName: string | null;
  awardLabel: string | null;
  contestTitle: string;
  imageUrl: string;
  previewWidth: number;
  previewHeight: number;
  /** El más barato de los formatos disponibles (para "desde"). */
  fromPriceMinor: number;
  formats: PublicArtworkFormat[];
};

export type PublicArtworkCard = Omit<PublicArtworkDetail, "formats"> & {
  contestKey: string;
  /** Cuántos formatos se ofrecen: con más de uno, el precio se lee "desde". */
  formatsCount: number;
};

export type PublicContestChip = { key: string; title: string; count: number };

export type PublicArtworksPage = {
  artworks: PublicArtworkCard[];
  /** Concursos con al menos una obra pública, para el filtro. */
  contests: PublicContestChip[];
  /** El concurso filtrado; `null` = todos (o una clave que no existe). */
  contest: PublicContestChip | null;
  page: number;
  totalPages: number;
  total: number;
};

// ── Decisiones (puras) ──────────────────────────────────────────────────────

/** Los formatos que se ofrecen para una obra: activos y que la resolución del original alcanza. */
export function publicArtworkFormats(
  original: { width: number; height: number },
  formats: readonly PrintFormatRow[],
  minDpi: number,
): PublicArtworkFormat[] {
  const activos = formats.filter((f) => f.isActive);
  return eligibleFormats(original, activos, minDpi).map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.kind,
    widthCm: f.widthCm,
    heightCm: f.heightCm,
    priceMinor: decimalArsToMinor(f.priceArs),
    needsBorders: needsBorders(original, f),
  }));
}

/**
 * La ficha pública de una obra, o `null` si no se puede mostrar ni vender (las cuatro reglas del
 * encabezado). Devuelve aparte el concurso (con su id de FotoRank) para uso del servidor.
 */
export function decidePublicArtwork(
  row: ArtworkListingRow,
  ctx: PublicArtworkContext,
): { artwork: PublicArtworkDetail; contest: ArtworkListingRow["contest"] } | null {
  if (row.status !== "PUBLISHED") return null;
  if (!ctx.linkedOrganizationIds.has(row.contest.organizationId)) return null;
  if (!isSellable(ctx.consents.get(row.entryId) ?? null)) return null;
  const formats = publicArtworkFormats({ width: row.originalWidth, height: row.originalHeight }, ctx.formats, ctx.minDpi);
  if (formats.length === 0) return null;
  return {
    contest: row.contest,
    artwork: {
      listingId: row.id,
      slug: row.slug,
      title: row.title,
      authorDisplayName: row.authorDisplayName?.trim() ? row.authorDisplayName.trim() : null,
      awardLabel: row.awardLabel?.trim() ? row.awardLabel.trim() : null,
      contestTitle: row.contest.title,
      imageUrl: row.previewUrl,
      previewWidth: row.previewWidth,
      previewHeight: row.previewHeight,
      fromPriceMinor: Math.min(...formats.map((f) => f.priceMinor)),
      formats,
    },
  };
}

/**
 * La clave pública de cada concurso para el filtro (`?concurso=<clave>`): su dirección en
 * FotoRank. Dos organizaciones vinculadas pueden tener un concurso con la misma dirección: al
 * segundo (por id, para que sea estable) se le agrega `-2`, y así.
 */
export function contestKeys(contests: readonly { id: string; slug: string }[]): Map<string, string> {
  const unicos = [...new Map(contests.map((c) => [c.id, c])).values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const usadas = new Set<string>();
  const out = new Map<string, string>();
  for (const c of unicos) {
    const base = c.slug || "concurso";
    let key = base;
    for (let n = 2; usadas.has(key); n++) key = `${base}-${n}`;
    usadas.add(key);
    out.set(c.id, key);
  }
  return out;
}

/** Arma la página de la vidriera a partir de las obras ya decididas como públicas, en orden. */
export function buildPublicArtworksPage(
  publicas: readonly { artwork: PublicArtworkDetail; contest: { id: string; slug: string; title: string } }[],
  opts: { contest?: string | null; page?: number },
): PublicArtworksPage {
  const claves = contestKeys(publicas.map((p) => p.contest));
  const chips = new Map<string, PublicContestChip>();
  for (const p of publicas) {
    const key = claves.get(p.contest.id)!;
    const chip = chips.get(key);
    if (chip) chip.count++;
    else chips.set(key, { key, title: p.contest.title, count: 1 });
  }
  const contests = [...chips.values()].sort((a, b) => a.title.localeCompare(b.title, "es"));
  const contest = opts.contest ? (chips.get(opts.contest) ?? null) : null;

  const filtradas = contest ? publicas.filter((p) => claves.get(p.contest.id) === contest.key) : publicas;
  const total = filtradas.length;
  const totalPages = Math.max(1, Math.ceil(total / PUBLIC_ARTWORKS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1) || 1), totalPages);
  const artworks = filtradas
    .slice((page - 1) * PUBLIC_ARTWORKS_PAGE_SIZE, page * PUBLIC_ARTWORKS_PAGE_SIZE)
    .map(({ artwork, contest: c }) => {
      const { formats, ...card } = artwork;
      return { ...card, contestKey: claves.get(c.id)!, formatsCount: formats.length };
    });
  return { artworks, contests, contest, page, totalPages, total };
}

/**
 * Revalida las obras de un carrito contra las obras públicas (`catalog`, por id de ficha). Igual
 * que con los productos: lo que no se puede comprar se quita con un aviso; lo que sí, sale con
 * el título, el formato, la imagen y el PRECIO DEL FORMATO del servidor, y la cantidad acotada a
 * 20 copias por formato. Las obras no tienen stock.
 */
export function checkArtworkCartLines(
  catalog: ReadonlyMap<string, PublicArtworkDetail>,
  input: readonly ArtworkCartLineInput[],
): { lines: ValidatedArtworkLine[]; problems: CartProblem[] } {
  const unidas: ArtworkCartLineInput[] = [];
  const porClave = new Map<string, ArtworkCartLineInput>();
  for (const l of input) {
    const key = lineKey(l);
    const previa = porClave.get(key);
    if (previa) previa.qty += Number.isFinite(l.qty) ? l.qty : 0;
    else {
      const copia = { ...l };
      porClave.set(key, copia);
      unidas.push(copia);
    }
  }

  const lines: ValidatedArtworkLine[] = [];
  const problems: CartProblem[] = [];
  for (const l of unidas) {
    const key = lineKey(l);
    const obra = catalog.get(l.artworkListingId);
    if (!obra) {
      problems.push({ key, message: `${l.name?.trim() || "Una obra"} ya no está a la venta.` });
      continue;
    }
    const formato = obra.formats.find((f) => f.id === l.printFormatId);
    if (!formato) {
      problems.push({ key, message: `El formato elegido de ${obra.title} ya no está disponible. Elegí otro.` });
      continue;
    }
    const etiqueta = `${obra.title} (${formato.name})`;
    let qty = Number.isFinite(l.qty) ? Math.max(1, Math.floor(l.qty)) : 1;
    if (qty > CART_MAX_ARTWORK_QTY) {
      qty = CART_MAX_ARTWORK_QTY;
      problems.push({
        key,
        message: `Se pueden comprar hasta ${CART_MAX_ARTWORK_QTY} copias de ${etiqueta}: ajustamos la cantidad.`,
      });
    }
    if (l.unitPriceMinor !== undefined && l.unitPriceMinor !== formato.priceMinor) {
      problems.push({ key, message: `El precio de ${etiqueta} cambió: ahora es ${formatMinorArs(formato.priceMinor)}.` });
    }
    lines.push({
      kind: "artwork",
      key,
      artworkListingId: obra.listingId,
      printFormatId: formato.id,
      slug: obra.slug,
      title: obra.title,
      formatName: printFormatLabel(formato),
      imageUrl: obra.imageUrl,
      unitPriceMinor: formato.priceMinor,
      qty,
      available: null,
      maxQty: CART_MAX_ARTWORK_QTY,
    });
  }
  return { lines, problems };
}

// ── Consultas ───────────────────────────────────────────────────────────────

const LISTING_SELECT = {
  id: true,
  slug: true,
  status: true,
  entryId: true,
  title: true,
  authorDisplayName: true,
  awardLabel: true,
  previewUrl: true,
  previewWidth: true,
  previewHeight: true,
  originalWidth: true,
  originalHeight: true,
  contest: { select: { id: true, slug: true, title: true, organizationId: true } },
} as const;

const FORMAT_SELECT = {
  id: true,
  name: true,
  kind: true,
  widthCm: true,
  heightCm: true,
  priceArs: true,
  isActive: true,
} as const;

/**
 * Las obras públicas del workspace, en el orden de la institución (y las más recientes primero).
 * `filtro` acota la consulta (una dirección o unos ids); las reglas se aplican igual a todas.
 */
async function publicArtworks(
  workspaceId: string,
  filtro: { slug?: string; ids?: readonly string[]; /** Corta en la primera obra pública. */ primera?: boolean },
  db: Db,
): Promise<{ artwork: PublicArtworkDetail; contest: ArtworkListingRow["contest"] }[]> {
  const vinculos = await db.workspaceContestOrganizationLink.findMany({
    where: { workspaceId },
    select: { organizationId: true },
  });
  if (vinculos.length === 0) return [];
  const organizaciones = vinculos.map((v) => v.organizationId);

  const [filas, formatos, ajustes] = await Promise.all([
    db.artworkListing.findMany({
      where: {
        workspaceId,
        status: "PUBLISHED",
        contest: { organizationId: { in: organizaciones } },
        ...(filtro.slug !== undefined ? { slug: filtro.slug } : {}),
        ...(filtro.ids !== undefined ? { id: { in: [...filtro.ids] } } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }, { id: "asc" }],
      select: LISTING_SELECT,
    }),
    db.printFormat.findMany({
      where: { workspaceId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: FORMAT_SELECT,
    }),
    db.storePrintSettings.findUnique({ where: { workspaceId }, select: { minDpi: true } }),
  ]);
  if (filas.length === 0 || formatos.length === 0) return [];

  const consents = await db.artworkConsent.findMany({
    where: { workspaceId, entryId: { in: filas.map((f) => f.entryId) } },
    select: { entryId: true, basis: true, status: true, notifiedAt: true },
  });
  const ctx: PublicArtworkContext = {
    linkedOrganizationIds: new Set(organizaciones),
    formats: formatos,
    minDpi: ajustes?.minDpi ?? DEFAULT_DPI,
    consents: new Map(consents.map((c) => [c.entryId, c])),
  };
  const out: { artwork: PublicArtworkDetail; contest: ArtworkListingRow["contest"] }[] = [];
  for (const f of filas) {
    const r = decidePublicArtwork(f, ctx);
    if (!r) continue;
    out.push(r);
    if (filtro.primera) break;
  }
  return out;
}

/** La vidriera de obras: una página de 24, con el filtro por concurso (`contest` = clave pública). */
export async function loadPublicArtworks(
  workspaceId: string,
  opts: { contest?: string | null; page?: number } = {},
  db: Db = prisma,
): Promise<PublicArtworksPage> {
  return buildPublicArtworksPage(await publicArtworks(workspaceId, {}, db), opts);
}

/**
 * Si hay al menos una obra pública: el menú de la tienda muestra "Obras" sólo entonces. Corre en
 * cada página de la tienda, así que primero descarta lo barato (sin vínculos, sin formatos
 * activos, sin ninguna obra publicada de un concurso vinculado) y recién después decide obra por
 * obra, hasta la primera pública. `cache`: una sola vez por request.
 */
export const hasPublicArtworks = cache(async function hasPublicArtworks(
  workspaceId: string,
  db: Db = prisma,
): Promise<boolean> {
  const vinculos = await db.workspaceContestOrganizationLink.findMany({
    where: { workspaceId },
    select: { organizationId: true },
  });
  if (vinculos.length === 0) return false;
  const [formato, obra] = await Promise.all([
    db.printFormat.findFirst({ where: { workspaceId, isActive: true }, select: { id: true } }),
    db.artworkListing.findFirst({
      where: {
        workspaceId,
        status: "PUBLISHED",
        contest: { organizationId: { in: vinculos.map((v) => v.organizationId) } },
      },
      select: { id: true },
    }),
  ]);
  if (!formato || !obra) return false;
  return (await publicArtworks(workspaceId, { primera: true }, db)).length > 0;
});

/**
 * `hasPublicArtworks` para el marco de la tienda: si falla (la migración de obras sin aplicar, la
 * base que no responde), las obras no se ofrecen pero la tienda de productos —y el checkout—
 * siguen andando. El log no lleva datos personales: el workspace y el tipo de error.
 */
export async function storeShowsArtworks(
  workspaceId: string,
  check: (workspaceId: string) => Promise<boolean> = (id) => hasPublicArtworks(id),
): Promise<boolean> {
  try {
    return await check(workspaceId);
  } catch (error) {
    console.error("[fotoffice][tienda] no se pudo decidir si hay obras a la venta", {
      workspaceId,
      error: error instanceof Error ? error.name : "desconocido",
    });
    return false;
  }
}

/** La ficha de una obra por su dirección; `null` si no existe o no es pública (sin decir por qué). */
export async function getPublicArtwork(
  workspaceId: string,
  slug: string,
  db: Db = prisma,
): Promise<PublicArtworkDetail | null> {
  const [r] = await publicArtworks(workspaceId, { slug }, db);
  return r?.artwork ?? null;
}

/** Las obras públicas de una lista de fichas, por id. Lo que falta es "ya no está a la venta". */
export async function loadArtworkCartCatalog(
  workspaceId: string,
  listingIds: readonly string[],
  db: Db = prisma,
): Promise<Map<string, PublicArtworkDetail>> {
  const ids = [...new Set(listingIds)];
  if (ids.length === 0) return new Map();
  const publicas = await publicArtworks(workspaceId, { ids }, db);
  return new Map(publicas.map((p) => [p.artwork.listingId, p.artwork]));
}
