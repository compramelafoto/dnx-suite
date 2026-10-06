import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { availableQty, effectiveUnitPriceMinor } from "./availability";
import { CART_MAX_QTY } from "./cart/constants";
import { lineKey } from "./cart/line-key";
import type { ArtworkCartLine, ProductCartLine } from "./cart/types";

/**
 * Lo que ve el comprador en la tienda pública, armado a partir de las filas de la base. Módulo
 * PURO: las consultas viven en `repository.ts`, y acá sólo se decide qué se muestra.
 *
 * Reglas que se repiten en todo el archivo:
 * - Un producto con talles activos se vende SÓLO por sus talles (su stock vive en cada talle); si
 *   tiene talles y ninguno activo, no se vende (`isSellableOnline`).
 * - Lo disponible es el stock menos lo que retienen los pedidos esperando el pago
 *   (`reserved`, clave `lineKey`). `null` = el producto no controla stock: sin límite.
 * - El precio del talle manda; si no tiene, hereda el del producto.
 */

type Decimalish = { toString(): string };

/** La forma mínima de un producto público. `variants` trae SÓLO los talles activos, ordenados. */
export type StorefrontProductRow = {
  id: string;
  name: string;
  description: string | null;
  priceArs: Decimalish;
  tracksStock: boolean;
  stockQty: number;
  imageUrl: string | null;
  category: { id: string; name: string } | null;
  /** Cuántos talles tiene en total, activos o no. */
  variantCount: number;
  listing: {
    slug: string;
    onlineTitle: string | null;
    onlineDescription: string | null;
    sizeChartImageUrl: string | null;
    maxPerOrder: number | null;
  };
  /** Galería ordenada: la primera es la principal. */
  images: { url: string; alt: string | null }[];
  variants: { id: string; name: string; priceArs: Decimalish | null; stockQty: number }[];
};

export type StoreProductCard = {
  productId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  fromPriceMinor: number;
  soldOut: boolean;
  categoryName: string | null;
};

export type StoreVariantOption = { id: string; name: string; priceMinor: number; available: number | null };

export type StoreProductDetail = {
  productId: string;
  slug: string;
  title: string;
  description: string | null;
  categoryName: string | null;
  images: { url: string; alt: string | null }[];
  sizeChartImageUrl: string | null;
  maxPerOrder: number | null;
  /** Sin talles: el precio. Con talles: el más bajo (para "desde"). */
  priceMinor: number;
  /** Disponible del producto cuando NO tiene talles; con talles, `null` y manda cada talle. */
  available: number | null;
  variants: StoreVariantOption[];
  soldOut: boolean;
};

/**
 * Lo que llega para revalidar: del carrito (con precio y nombre) o del checkout (sin ellos).
 * Sin `kind` es un producto (el checkout y los carritos de antes de las obras).
 */
export type ProductCartLineInput = {
  kind?: "product";
  productId: string;
  variantId: string | null;
  qty: number;
  unitPriceMinor?: number;
  name?: string;
};

/** Una obra en un formato. Del navegador sólo valen el listing, el formato y la cantidad. */
export type ArtworkCartLineInput = {
  kind: "artwork";
  artworkListingId: string;
  printFormatId: string;
  qty: number;
  unitPriceMinor?: number;
  name?: string;
};

export type CartLineInput = ProductCartLineInput | ArtworkCartLineInput;

export function isArtworkLineInput(l: CartLineInput): l is ArtworkCartLineInput {
  return l.kind === "artwork";
}

export function isProductLineInput(l: CartLineInput): l is ProductCartLineInput {
  return l.kind !== "artwork";
}

type Revalidacion = {
  key: string;
  /** `null` = sin límite de stock. */
  available: number | null;
  /** Lo máximo que puede llevar esta línea (stock, máximo por compra y tope del carrito). */
  maxQty: number;
};

/** Una línea que se puede comprar ahora, con los datos y el precio del servidor. */
export type ValidatedProductLine = ProductCartLine & Revalidacion;
/** Una obra en un formato que se puede comprar ahora (las obras no tienen stock: `available` null). */
export type ValidatedArtworkLine = ArtworkCartLine & Revalidacion & { available: null };
export type ValidatedLine = ValidatedProductLine | ValidatedArtworkLine;

export type CartProblem = { key: string; message: string };

/**
 * Si el producto se puede comprar online. Uno que tiene talles pero ninguno activo NO: su stock
 * vive en los talles, y venderlo como producto suelto descontaría un stock que no existe.
 */
export function isSellableOnline(row: StorefrontProductRow): boolean {
  return row.variantCount === 0 || row.variants.length > 0;
}

/** Suma las cantidades retenidas por clave de línea. Los ítems de productos borrados no cuentan. */
export function sumReserved(
  items: { productId: string | null; variantId: string | null; qty: number }[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    if (!it.productId) continue;
    const key = lineKey({ productId: it.productId, variantId: it.variantId });
    out.set(key, (out.get(key) ?? 0) + it.qty);
  }
  return out;
}

function limpio(texto: string | null | undefined): string | null {
  const t = texto?.trim();
  return t ? t : null;
}

function titulo(row: StorefrontProductRow): string {
  return limpio(row.listing.onlineTitle) ?? row.name;
}

function galeria(row: StorefrontProductRow): { url: string; alt: string | null }[] {
  if (row.images.length > 0) return row.images;
  return row.imageUrl ? [{ url: row.imageUrl, alt: null }] : [];
}

function precioProducto(row: StorefrontProductRow): number {
  return decimalArsToMinor(row.priceArs);
}

function disponible(row: StorefrontProductRow, key: string, stockQty: number, reserved: Map<string, number>) {
  return availableQty({ stockQty, tracksStock: row.tracksStock, reservedQty: reserved.get(key) ?? 0 });
}

function opcionesDeTalle(row: StorefrontProductRow, reserved: Map<string, number>): StoreVariantOption[] {
  const base = precioProducto(row);
  return row.variants.map((v) => ({
    id: v.id,
    name: v.name,
    priceMinor: effectiveUnitPriceMinor(base, v.priceArs ? decimalArsToMinor(v.priceArs) : null),
    available: disponible(row, lineKey({ productId: row.id, variantId: v.id }), v.stockQty, reserved),
  }));
}

/** Resumen de precio y disponibilidad que comparten la tarjeta y la ficha. */
function resumen(row: StorefrontProductRow, reserved: Map<string, number>) {
  if (row.variants.length === 0) {
    const available = disponible(row, lineKey({ productId: row.id, variantId: null }), row.stockQty, reserved);
    return { priceMinor: precioProducto(row), available, variants: [], soldOut: available === 0 };
  }
  const variants = opcionesDeTalle(row, reserved);
  return {
    priceMinor: Math.min(...variants.map((v) => v.priceMinor)),
    available: null,
    variants,
    soldOut: variants.every((v) => v.available === 0),
  };
}

export function buildStoreProductCard(row: StorefrontProductRow, reserved: Map<string, number>): StoreProductCard {
  const r = resumen(row, reserved);
  return {
    productId: row.id,
    slug: row.listing.slug,
    title: titulo(row),
    imageUrl: galeria(row)[0]?.url ?? null,
    fromPriceMinor: r.priceMinor,
    soldOut: r.soldOut,
    categoryName: row.category?.name ?? null,
  };
}

export function buildStoreProductDetail(row: StorefrontProductRow, reserved: Map<string, number>): StoreProductDetail {
  const r = resumen(row, reserved);
  return {
    productId: row.id,
    slug: row.listing.slug,
    title: titulo(row),
    description: limpio(row.listing.onlineDescription) ?? limpio(row.description),
    categoryName: row.category?.name ?? null,
    images: galeria(row),
    sizeChartImageUrl: row.listing.sizeChartImageUrl,
    maxPerOrder: row.listing.maxPerOrder,
    priceMinor: r.priceMinor,
    available: r.available,
    variants: r.variants,
    soldOut: r.soldOut,
  };
}

/**
 * Cuántas unidades más se pueden agregar desde la ficha: lo disponible menos lo que ya está en el
 * carrito para ese talle, el máximo por compra menos lo que ya hay de ese producto (todos sus
 * talles), y el tope del carrito. Nunca negativo.
 */
export function maxAddableQty(input: {
  available: number | null;
  maxPerOrder: number | null;
  inCartLine: number;
  inCartProduct: number;
}): number {
  const porStock = input.available === null ? Infinity : input.available - input.inCartLine;
  const porCompra = input.maxPerOrder === null ? Infinity : input.maxPerOrder - input.inCartProduct;
  const porCarrito = CART_MAX_QTY - input.inCartLine;
  return Math.max(0, Math.min(porStock, porCompra, porCarrito));
}

/**
 * Revalida los PRODUCTOS de un carrito contra el catálogo público (las obras las revalida
 * `checkArtworkCartLines`, en `artworks/storefront.ts`). No reserva nada: sólo dice qué se puede comprar
 * ahora y qué cambió. Las líneas que no se pueden comprar se quitan; las que se pueden, salen con
 * el precio y los nombres del servidor y la cantidad acotada. Cada ajuste deja un aviso.
 *
 * `catalog` trae SÓLO productos públicos (activos y a la venta online), por id.
 */
export function checkCartLines(
  catalog: Map<string, StorefrontProductRow>,
  input: readonly ProductCartLineInput[],
  reserved: Map<string, number>,
): { lines: ValidatedProductLine[]; problems: CartProblem[] } {
  // Las repetidas se unen primero: validar dos veces la misma línea contaría el stock dos veces.
  const unidas: ProductCartLineInput[] = [];
  const porClave = new Map<string, ProductCartLineInput>();
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

  const lines: ValidatedProductLine[] = [];
  const problems: CartProblem[] = [];
  const usadoPorProducto = new Map<string, number>();

  for (const l of unidas) {
    const key = lineKey(l);
    const row = catalog.get(l.productId);
    if (!row || !isSellableOnline(row)) {
      problems.push({ key, message: `${row ? titulo(row) : (limpio(l.name) ?? "Un producto")} ya no está a la venta.` });
      continue;
    }
    const nombre = titulo(row);

    let variantName: string | null = null;
    let unitPriceMinor: number;
    let available: number | null;
    if (row.variants.length > 0) {
      const v = l.variantId ? opcionesDeTalle(row, reserved).find((o) => o.id === l.variantId) : undefined;
      if (!v) {
        problems.push({
          key,
          message: l.variantId
            ? `El talle elegido de ${nombre} ya no está disponible.`
            : `Elegí un talle de ${nombre}.`,
        });
        continue;
      }
      variantName = v.name;
      unitPriceMinor = v.priceMinor;
      available = v.available;
    } else {
      if (l.variantId) {
        problems.push({ key, message: `El talle elegido de ${nombre} ya no está disponible.` });
        continue;
      }
      unitPriceMinor = precioProducto(row);
      available = disponible(row, key, row.stockQty, reserved);
    }

    const etiqueta = variantName ? `${nombre} (${variantName})` : nombre;
    if (available === 0) {
      problems.push({ key, message: `${etiqueta} se agotó.` });
      continue;
    }

    const usado = usadoPorProducto.get(row.id) ?? 0;
    const max = row.listing.maxPerOrder;
    const porCompra = max === null ? Infinity : max - usado;
    if (porCompra <= 0) {
      problems.push({ key, message: `Se pueden comprar hasta ${max} de ${nombre} por compra.` });
      continue;
    }
    const porStock = available ?? Infinity;
    const maxQty = Math.min(CART_MAX_QTY, porStock, porCompra);

    let qty = Number.isFinite(l.qty) ? Math.max(1, Math.floor(l.qty)) : 1;
    if (qty > maxQty) {
      qty = maxQty;
      problems.push({
        key,
        message:
          porCompra < porStock
            ? `Se pueden comprar hasta ${max} de ${nombre} por compra: ajustamos la cantidad.`
            : `Quedan ${maxQty} de ${etiqueta}: ajustamos la cantidad.`,
      });
    }
    if (l.unitPriceMinor !== undefined && l.unitPriceMinor !== unitPriceMinor) {
      problems.push({ key, message: `El precio de ${etiqueta} cambió: ahora es ${formatMinorArs(unitPriceMinor)}.` });
    }

    usadoPorProducto.set(row.id, usado + qty);
    lines.push({
      kind: "product",
      key,
      productId: row.id,
      variantId: l.variantId,
      slug: row.listing.slug,
      name: nombre,
      variantName,
      imageUrl: galeria(row)[0]?.url ?? null,
      unitPriceMinor,
      qty,
      available,
      maxQty,
    });
  }

  return { lines, problems };
}
