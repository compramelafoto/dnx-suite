import "server-only";
import { Prisma, prisma } from "@repo/db";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { bundleLabel, computeBundleDiscount, isValidBundlePromo, type ClientBundle, type StoreBundle } from "./bundle";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * La promo "N por $X" de la tienda, si está completa (categoría, cantidad y precio). Una a medio
 * cargar no existe: no se muestra ni se descuenta.
 */
export async function loadStoreBundle(workspaceId: string, db: Db = prisma): Promise<StoreBundle | null> {
  const s = await db.storeSettings.findUnique({
    where: { workspaceId },
    select: { bundleCategoryId: true, bundleQty: true, bundlePriceArs: true, bundleLabel: true },
  });
  if (!s?.bundleCategoryId || s.bundleQty == null || s.bundlePriceArs == null) return null;
  const promo = { qty: s.bundleQty, priceMinor: decimalArsToMinor(s.bundlePriceArs) };
  if (!isValidBundlePromo(promo)) return null;
  return { ...promo, categoryId: s.bundleCategoryId, label: s.bundleLabel?.trim() ?? "" };
}

/** De estos productos, los que entran en la promo (son de su categoría, en este negocio). */
export async function bundleEligibleProductIds(
  workspaceId: string,
  categoryId: string,
  productIds: readonly string[],
  db: Db = prisma,
): Promise<Set<string>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Set();
  const filas = await db.product.findMany({
    where: { workspaceId, categoryId, id: { in: ids } },
    select: { id: true },
  });
  return new Set(filas.map((f) => f.id));
}

/**
 * El descuento de la promo para las líneas de PRODUCTO de un pedido (las obras nunca entran).
 * Precios y cantidades son los ya revisados por el servidor.
 */
export async function bundleDiscountForProductLines(
  workspaceId: string,
  lines: readonly { productId: string; unitPriceMinor: number; qty: number }[],
  db: Db = prisma,
): Promise<number> {
  if (lines.length === 0) return 0;
  const promo = await loadStoreBundle(workspaceId, db);
  if (!promo) return 0;
  const elegibles = await bundleEligibleProductIds(
    workspaceId,
    promo.categoryId,
    lines.map((l) => l.productId),
    db,
  );
  return computeBundleDiscount(
    promo,
    lines.filter((l) => elegibles.has(l.productId)),
  ).discountMinor;
}

/**
 * La promo para mostrar en la tienda (carrito, checkout, vitrina y ficha): el texto ya armado y
 * qué productos online entran. Nunca tira la tienda: si falla (p. ej. la migración todavía no se
 * aplicó), la tienda se ve sin promo; el pedido igual la calcula del lado del servidor.
 */
export async function loadClientBundle(workspaceId: string): Promise<ClientBundle | null> {
  try {
    const promo = await loadStoreBundle(workspaceId);
    if (!promo) return null;
    const productos = await prisma.product.findMany({
      where: { workspaceId, categoryId: promo.categoryId, storeListing: { is: { sellOnline: true } } },
      select: { id: true },
    });
    if (productos.length === 0) return null;
    return {
      qty: promo.qty,
      priceMinor: promo.priceMinor,
      label: bundleLabel(promo, formatMinorArs),
      productIds: productos.map((p) => p.id),
    };
  } catch (error) {
    console.warn("[fotoffice][tienda] no se pudo leer la promo", {
      workspaceId,
      error: error instanceof Error ? error.name : typeof error,
    });
    return null;
  }
}
