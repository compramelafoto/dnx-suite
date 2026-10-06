import "server-only";
import { cache } from "react";
import { Prisma, prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { STORE_MODULE_KEY } from "./constants";
import { lineKey } from "./cart/line-key";
import { checkArtworkCartLines, loadArtworkCartCatalog } from "./artworks/storefront";
import {
  buildStoreProductCard,
  buildStoreProductDetail,
  checkCartLines,
  sumReserved,
  type CartLineInput,
  type CartProblem,
  type StoreProductCard,
  type StoreProductDetail,
  isArtworkLineInput,
  isProductLineInput,
  isSellableOnline,
  type StorefrontProductRow,
  type ValidatedLine,
} from "./storefront";

/**
 * Las lecturas de la tienda pública. Nunca piden sesión: las usa quien entra a
 * `/w/<negocio>/tienda` sin cuenta. Todas filtran por `workspaceId`, también en el producto
 * (el listado y el producto tienen cada uno el suyo y no se confía en que coincidan).
 *
 * Qué es público: producto activo, con ficha online (`sellOnline`), y de sus talles sólo los
 * activos. Lo que se decide con esas filas vive en `storefront.ts`, que es puro y está probado.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export type StoreSettingsRow = {
  isOpen: boolean;
  pickupAddress: string | null;
  pickupHours: string | null;
  pickupInstructions: string | null;
  returnsPolicy: string | null;
  notifyEmail: string | null;
};

export type OpenStore = { workspace: { id: string; slug: string; name: string }; settings: StoreSettingsRow };

/**
 * La tienda de una institución, si está abierta al público: módulo encendido y `isOpen`. Si no,
 * `null` y la página responde 404 (igual que el menú del sitio, que la esconde cerrada).
 * `cache` porque el layout y la página la piden en el mismo request.
 */
export const loadOpenStore = cache(async function loadOpenStore(workspaceSlug: string): Promise<OpenStore | null> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, publicSlug: true, commercialName: true },
  });
  if (!branding) return null;
  // La tienda vende el catálogo y el stock de Ventas: sin Ventas no hay tienda (ver `access.ts`).
  const [tienda, ventas] = await Promise.all([
    isModuleEnabledForWorkspace(branding.workspaceId, STORE_MODULE_KEY),
    isModuleEnabledForWorkspace(branding.workspaceId, SALES_MODULE_KEY),
  ]);
  if (!tienda || !ventas) return null;

  const settings = await prisma.storeSettings.findUnique({
    where: { workspaceId: branding.workspaceId },
    select: {
      isOpen: true,
      pickupAddress: true,
      pickupHours: true,
      pickupInstructions: true,
      returnsPolicy: true,
      notifyEmail: true,
    },
  });
  if (!settings?.isOpen) return null;

  return {
    workspace: { id: branding.workspaceId, slug: branding.publicSlug, name: branding.commercialName },
    settings,
  };
});

export type StoreWorkspace = {
  workspace: { id: string; slug: string; name: string };
  pickup: { pickupAddress: string | null; pickupHours: string | null; pickupInstructions: string | null } | null;
  /** La propia de la institución, o `null` (= `DEFAULT_RETURNS_POLICY`, ver `effectiveReturnsPolicy`). */
  returnsPolicy: string | null;
};

/**
 * La institución de una dirección pública, SIN exigir que la tienda esté abierta. La usan la
 * página de un pedido, el botón de arrepentimiento y los términos: quien compró tiene que poder
 * ver su pedido, arrepentirse y leer las condiciones aunque la tienda después se cierre o se
 * apague el módulo. Vender sí exige `loadOpenStore`.
 */
export const loadStoreWorkspace = cache(async function loadStoreWorkspace(
  workspaceSlug: string,
): Promise<StoreWorkspace | null> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, publicSlug: true, commercialName: true },
  });
  if (!branding) return null;
  const settings = await prisma.storeSettings.findUnique({
    where: { workspaceId: branding.workspaceId },
    select: { pickupAddress: true, pickupHours: true, pickupInstructions: true, returnsPolicy: true },
  });
  return {
    workspace: { id: branding.workspaceId, slug: branding.publicSlug, name: branding.commercialName },
    pickup: settings
      ? {
          pickupAddress: settings.pickupAddress,
          pickupHours: settings.pickupHours,
          pickupInstructions: settings.pickupInstructions,
        }
      : null,
    returnsPolicy: settings?.returnsPolicy ?? null,
  };
});

/**
 * Unidades retenidas por pedidos que esperan el pago, por clave de línea (`lineKey`).
 *
 * Cuentan sólo los `PENDING_PAYMENT` con la retención vigente (`holdExpiresAt > now`): un pedido
 * vencido deja de retener aunque el proceso que lo marca EXPIRED todavía no haya pasado.
 * `excludeOrderId` sirve al acreditar un pago: ese pedido no compite contra su propia retención.
 */
export async function reservedQtyByKey(
  workspaceId: string,
  db: Db = prisma,
  opts: { excludeOrderId?: string; now?: Date } = {},
): Promise<Map<string, number>> {
  const now = opts.now ?? new Date();
  const items = await db.storeOrderItem.findMany({
    where: {
      order: {
        workspaceId,
        status: "PENDING_PAYMENT",
        holdExpiresAt: { gt: now },
        ...(opts.excludeOrderId ? { id: { not: opts.excludeOrderId } } : {}),
      },
    },
    select: { productId: true, variantId: true, qty: true },
  });
  return sumReserved(items);
}

const productoPublico = (workspaceId: string) => ({ workspaceId, isActive: true });

const SELECT_FILA = {
  slug: true,
  onlineTitle: true,
  onlineDescription: true,
  sizeChartImageUrl: true,
  maxPerOrder: true,
  product: {
    select: {
      id: true,
      name: true,
      description: true,
      priceArs: true,
      tracksStock: true,
      stockQty: true,
      imageUrl: true,
      category: { select: { id: true, name: true } },
      // Todos los talles, activos o no: con talles y ninguno activo, el producto no se vende.
      _count: { select: { variants: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { url: true, alt: true } },
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, priceArs: true, stockQty: true },
      },
    },
  },
} satisfies Prisma.ProductStoreListingSelect;

type FilaListado = Prisma.ProductStoreListingGetPayload<{ select: typeof SELECT_FILA }>;

function aFila(f: FilaListado): StorefrontProductRow {
  const { product, ...listing } = f;
  const { _count, ...resto } = product;
  return { ...resto, variantCount: _count.variants, listing };
}

/** La vitrina: orden elegido por el negocio (`sortOrder`) y, a igualdad, por nombre. */
export async function listStoreProducts(
  workspaceId: string,
  opts: { categoryId?: string } = {},
): Promise<StoreProductCard[]> {
  const [filas, reserved] = await Promise.all([
    prisma.productStoreListing.findMany({
      where: {
        workspaceId,
        sellOnline: true,
        product: { ...productoPublico(workspaceId), ...(opts.categoryId ? { categoryId: opts.categoryId } : {}) },
      },
      orderBy: [{ sortOrder: "asc" }, { product: { name: "asc" } }],
      select: SELECT_FILA,
    }),
    reservedQtyByKey(workspaceId),
  ]);
  return filas
    .map(aFila)
    .filter(isSellableOnline)
    .map((f) => buildStoreProductCard(f, reserved));
}

/** Las categorías que tienen al menos un producto público, para el filtro de la vitrina. */
export async function listStoreCategories(workspaceId: string): Promise<{ id: string; name: string }[]> {
  return prisma.productCategory.findMany({
    where: {
      workspaceId,
      isActive: true,
      products: { some: { ...productoPublico(workspaceId), storeListing: { is: { sellOnline: true } } } },
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

/** La ficha de un producto por su dirección pública; `null` si no existe o no es público. */
export async function getStoreProduct(workspaceId: string, slug: string): Promise<StoreProductDetail | null> {
  const fila = await prisma.productStoreListing.findFirst({
    where: { workspaceId, slug, sellOnline: true, product: productoPublico(workspaceId) },
    select: SELECT_FILA,
  });
  if (!fila) return null;
  const row = aFila(fila);
  if (!isSellableOnline(row)) return null;
  const reserved = await reservedQtyByKey(workspaceId);
  return buildStoreProductDetail(row, reserved);
}

/**
 * Los productos comprables de una lista de ids, por id: activos, con ficha online y que se pueden
 * vender (`isSellableOnline`). Lo que falta del mapa es, para el carrito, "ya no está a la venta".
 * La usan la revalidación del carrito y la creación del pedido (dentro de su transacción).
 */
export async function loadCartCatalog(
  workspaceId: string,
  productIds: readonly string[],
  db: Db = prisma,
): Promise<Map<string, StorefrontProductRow>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map();
  const filas = await db.productStoreListing.findMany({
    where: { workspaceId, sellOnline: true, productId: { in: ids }, product: productoPublico(workspaceId) },
    select: SELECT_FILA,
  });
  return new Map(filas.map(aFila).filter(isSellableOnline).map((r) => [r.id, r]));
}

/**
 * Revalida un carrito: precio, existencia, canal y disponibilidad. No retiene nada (eso lo hace el
 * checkout al crear el pedido). La usan el carrito, para avisar antes, y el checkout.
 *
 * Los productos y las obras se revisan cada uno con sus reglas (`checkCartLines` y
 * `checkArtworkCartLines`: obra publicada, de una organización vinculada, con permiso del autor y
 * en un formato activo que su resolución alcanza, al precio del formato). El resultado vuelve en
 * el orden en que llegaron las líneas.
 */
export async function validateCartLines(
  workspaceId: string,
  lines: CartLineInput[],
  db: Db = prisma,
): Promise<{ lines: ValidatedLine[]; problems: CartProblem[] }> {
  if (lines.length === 0) return { lines: [], problems: [] };
  const productos = lines.filter(isProductLineInput);
  const obras = lines.filter(isArtworkLineInput);

  const [deProductos, deObras] = await Promise.all([
    productos.length === 0
      ? { lines: [], problems: [] }
      : Promise.all([
          loadCartCatalog(
            workspaceId,
            productos.map((l) => l.productId),
            db,
          ),
          reservedQtyByKey(workspaceId, db),
        ]).then(([catalogo, reserved]) => checkCartLines(catalogo, productos, reserved)),
    obras.length === 0
      ? { lines: [], problems: [] }
      : loadArtworkCartCatalog(
          workspaceId,
          obras.map((l) => l.artworkListingId),
          db,
        ).then((catalogo) => checkArtworkCartLines(catalogo, obras)),
  ]);

  const orden = new Map<string, number>();
  lines.forEach((l, i) => {
    const key = lineKey(l);
    if (!orden.has(key)) orden.set(key, i);
  });
  const enOrden = <T extends { key: string }>(xs: T[]) =>
    xs.sort((a, b) => (orden.get(a.key) ?? 0) - (orden.get(b.key) ?? 0));
  return {
    lines: enOrden<ValidatedLine>([...deProductos.lines, ...deObras.lines]),
    problems: enOrden([...deProductos.problems, ...deObras.problems]),
  };
}
