import { prisma } from "@repo/db";
import { getSignedFileUrl } from "@/lib/archivos";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import type { GearItemKind } from "@/lib/inventario/tipos";
import {
  MONTURAS,
  PROVINCIAS,
  type GearListingCondition,
  type GearListingUsageSeal,
} from "@/lib/publicaciones/catalogos";
import {
  computeTrust,
  declaredItems,
  usageSealText,
  type TrustLevel,
} from "@/lib/publicaciones/confianza";
import { findActiveReportForSerial } from "@/lib/publicaciones/denuncia-activa";
import { maskSerial } from "@/lib/publicaciones/reglas";

/**
 * Catálogo público: lo que ve cualquiera, con o sin sesión. Las consultas piden campos uno por
 * uno (`select`) para que nunca salgan del servidor el correo, el teléfono, el apellido, la serie
 * completa, la factura ni las notas de revisión.
 */

export const PAGE_SIZE = 24;
const SIGNED_URL_SECONDS = 3600;

export type CatalogFilters = {
  kind?: GearItemKind;
  make?: string;
  mount?: string;
  minPrice?: number;
  maxPrice?: number;
  province?: string;
  page: number;
};

export type PublicListing = {
  id: number;
  kind: GearItemKind;
  make: string;
  model: string;
  mount: string | null;
  priceArs: number;
  priceUsdRef: number | null;
  condition: GearListingCondition;
  description: string | null;
  accessories: string | null;
  province: string;
  city: string;
  serialMasked: string | null;
  usageSealText: string | null;
  trust: { level: TrustLevel; verified: string[] };
  declared: string[];
  shutterText: string | null;
  sellerFirstName: string;
  sellerVerified: true;
  photoUrls: string[];
  publishedAt: Date;
};

const MILES = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** «$ 1.850.000»: pesos enteros con separador de miles. */
export function formatPesos(n: number): string {
  return `$ ${MILES.format(n)}`;
}

/** «US$ 1.500»: la referencia en dólares que carga el vendedor. */
export function formatDolares(n: number): string {
  return `US$ ${MILES.format(n)}`;
}

type Params = Record<string, string | string[] | undefined>;

function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** `priceArs` es `Int` de 32 bits: un valor mayor rompería la consulta. */
const MAX_INT4 = 2_147_483_647;
/** Más allá no hay nada que mirar, y `skip` crecería sin límite. */
export const MAX_PAGE = 1000;

/** Entero sin signo ni decimales dentro de `max`; cualquier otra cosa se ignora. */
function enteroPositivo(v: string | undefined, max = MAX_INT4): number | undefined {
  const t = v?.trim();
  if (!t || !/^\d{1,10}$/.test(t)) return undefined;
  const n = Number(t);
  return n <= max ? n : undefined;
}

export function parseCatalogFilters(sp: Params): CatalogFilters {
  const f: CatalogFilters = { page: 1 };

  const kind = primero(sp.kind);
  if (kind && Object.prototype.hasOwnProperty.call(KIND_LABELS, kind)) f.kind = kind as GearItemKind;

  const make = primero(sp.make)?.trim();
  if (make) f.make = make.slice(0, 60);

  const mount = primero(sp.mount);
  if (mount && MONTURAS.includes(mount)) f.mount = mount;

  const province = primero(sp.province);
  if (province && PROVINCIAS.includes(province)) f.province = province;

  const minPrice = enteroPositivo(primero(sp.minPrice));
  if (minPrice !== undefined) f.minPrice = minPrice;
  const maxPrice = enteroPositivo(primero(sp.maxPrice));
  if (maxPrice !== undefined) f.maxPrice = maxPrice;

  const page = enteroPositivo(primero(sp.page), MAX_PAGE);
  if (page !== undefined && page >= 1) f.page = page;

  return f;
}

/** Sólo los campos que pueden llegar a una pantalla pública. */
const SELECT = {
  id: true,
  kind: true,
  make: true,
  model: true,
  mount: true,
  priceArs: true,
  priceUsdRef: true,
  condition: true,
  description: true,
  accessories: true,
  province: true,
  city: true,
  serialPhotoKey: true,
  declaredFirstOwner: true,
  includesCharger: true,
  batteriesCount: true,
  includesManual: true,
  includesBox: true,
  usageSeal: true,
  usageSince: true,
  usagePhotosCount: true,
  publishedAt: true,
  createdAt: true,
  sellerId: true,
  seller: { select: { name: true } },
  // La clave de la factura sólo se usa para saber si existe; nunca sale en el objeto público.
  gearItem: { select: { photoKeys: true, serialNormalized: true, purchaseProofKey: true } },
} as const;

type Row = {
  id: number;
  kind: GearItemKind;
  make: string;
  model: string;
  mount: string | null;
  priceArs: number;
  priceUsdRef: number | null;
  condition: GearListingCondition;
  description: string | null;
  accessories: string | null;
  province: string;
  city: string;
  serialPhotoKey: string | null;
  declaredFirstOwner: boolean;
  includesCharger: boolean;
  batteriesCount: number | null;
  includesManual: boolean;
  includesBox: boolean;
  usageSeal: GearListingUsageSeal;
  usageSince: Date | null;
  usagePhotosCount: number | null;
  publishedAt: Date | null;
  createdAt: Date;
  sellerId: number;
  seller: { name: string | null };
  gearItem: { photoKeys: string[]; serialNormalized: string | null; purchaseProofKey: string | null };
};

export function sellerFirstName(name: string | null | undefined): string {
  const palabra = name?.trim().split(/\s+/)[0];
  if (!palabra) return "Vendedor";
  return palabra.charAt(0).toLocaleUpperCase("es-AR") + palabra.slice(1);
}

/** Firma las fotos del equipo (sin la de la serie). Si el almacenamiento falla, sigue sin fotos. */
async function signPhotos(row: Row, max?: number): Promise<string[]> {
  const keys = row.gearItem.photoKeys.filter((k) => k !== row.serialPhotoKey).slice(0, max);
  try {
    return await Promise.all(keys.map((k) => getSignedFileUrl(k, SIGNED_URL_SECONDS)));
  } catch (error) {
    console.error("[catalogo] No se pudieron firmar las fotos de la publicación", row.id, error);
    return [];
  }
}

async function toPublic(
  row: Row,
  opts: { maxPhotos?: number; noActiveReport: boolean },
): Promise<PublicListing> {
  const trust = computeTrust({
    usageSeal: row.usageSeal,
    hasPurchaseProof: row.gearItem.purchaseProofKey != null,
    shutterVerified: false,
    noActiveReport: opts.noActiveReport,
  });
  return {
    id: row.id,
    kind: row.kind,
    make: row.make,
    model: row.model,
    mount: row.mount,
    priceArs: row.priceArs,
    priceUsdRef: row.priceUsdRef,
    condition: row.condition,
    description: row.description,
    accessories: row.accessories,
    province: row.province,
    city: row.city,
    serialMasked: maskSerial(row.gearItem.serialNormalized),
    usageSealText: usageSealText(row.usageSeal, row.usageSince, row.usagePhotosCount),
    trust: { level: trust.level, verified: trust.verified },
    declared: declaredItems(row),
    // Lo reemplaza el módulo de contador de disparos cuando exista.
    shutterText: row.kind === "BODY" ? "Cantidad de disparos: no verificada" : null,
    sellerFirstName: sellerFirstName(row.seller.name),
    sellerVerified: true,
    photoUrls: await signPhotos(row, opts.maxPhotos),
    publishedAt: row.publishedAt ?? row.createdAt,
  };
}

/** Sólo vendedores con la identidad aprobada HOY: si se la revocan, sus publicaciones no salen. */
const VENDEDOR_VERIFICADO = { identityVerification: { is: { status: "APPROVED" } } } as const;

function whereFor(f: CatalogFilters) {
  const where: Record<string, unknown> = { status: "PUBLISHED", seller: VENDEDOR_VERIFICADO };
  if (f.kind) where.kind = f.kind;
  if (f.make) where.make = { contains: f.make, mode: "insensitive" };
  if (f.mount) where.mount = f.mount;
  if (f.province) where.province = f.province;
  if (f.minPrice !== undefined || f.maxPrice !== undefined) {
    const price: Record<string, number> = {};
    if (f.minPrice !== undefined) price.gte = f.minPrice;
    if (f.maxPrice !== undefined) price.lte = f.maxPrice;
    where.priceArs = price;
  }
  return where;
}

/**
 * Publicadas, 24 por página, las más nuevas primero. En el listado se firma sólo la primera foto.
 * No se revisan denuncias fila por fila: el cruce diario retiene las publicaciones con una
 * denuncia activa, y la ficha (`getPublicListing`) la revisa en vivo antes de mostrarse.
 */
export async function searchListings(
  f: CatalogFilters,
): Promise<{ items: PublicListing[]; total: number }> {
  const where = whereFor(f);
  const [rows, total] = await Promise.all([
    prisma.gearListing.findMany({
      where,
      select: SELECT,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE,
      skip: (Math.max(1, f.page) - 1) * PAGE_SIZE,
    }),
    prisma.gearListing.count({ where }),
  ]);
  const items = await Promise.all(
    (rows as Row[]).map((r) => toPublic(r, { maxPhotos: 1, noActiveReport: true })),
  );
  return { items, total };
}

/**
 * `null` si no existe, no está publicada (pausada, en revisión, vendida, cerrada), el vendedor
 * ya no tiene la identidad aprobada o la serie tiene una denuncia activa de otra persona (se
 * revisa en vivo: entre una corrida del cruce y la siguiente la ficha no puede decir «sin
 * denuncias» si las hay).
 */
export async function getPublicListing(id: number): Promise<PublicListing | null> {
  const row = (await prisma.gearListing.findFirst({
    where: { id, status: "PUBLISHED", seller: VENDEDOR_VERIFICADO },
    select: SELECT,
  })) as Row | null;
  if (!row) return null;
  const serial = row.gearItem.serialNormalized;
  if (serial && (await findActiveReportForSerial(serial, row.sellerId))) return null;
  return toPublic(row, { noActiveReport: true });
}

/** Cuenta la visita de una persona con sesión. No cuenta al vendedor y nunca tira error. */
export async function recordView(listingId: number, userId: number): Promise<void> {
  try {
    const listing = await prisma.gearListing.findFirst({
      where: { id: listingId },
      select: { sellerId: true },
    });
    if (!listing || listing.sellerId === userId) return;
    const now = new Date();
    await prisma.gearListingView.upsert({
      where: { listingId_userId: { listingId, userId } },
      create: { listingId, userId, lastViewedAt: now },
      update: { count: { increment: 1 }, lastViewedAt: now },
    });
  } catch (error) {
    console.error("[catalogo] No se pudo registrar la vista", listingId, error);
  }
}
