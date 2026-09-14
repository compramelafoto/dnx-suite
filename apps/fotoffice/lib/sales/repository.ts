import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { clientDisplayName } from "@/lib/clients/display";
import { normalizeBarcode } from "./barcode";

/**
 * Las consultas del catálogo.
 *
 * Todas llevan `workspaceId` en el `where` —el aislamiento entre negocios no es opcional—
 * salvo las que de verdad no tocan `Product` (no las hay acá: el catálogo maestro global
 * vive en `lib/sales/global-catalog.ts`, aparte). Los importes salen siempre convertidos a
 * centavos con `decimalArsToMinor`: quien llama nunca ve un `Decimal` de Prisma.
 */

export type ProductRow = {
  id: string;
  kind: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  priceMinor: number;
  tracksStock: boolean;
  stockQty: number;
  minStockQty: number | null;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: string | null;
  categoryName: string | null;
};

const PRODUCT_ROW_SELECT = {
  id: true,
  kind: true,
  sku: true,
  barcode: true,
  name: true,
  brand: true,
  priceArs: true,
  tracksStock: true,
  stockQty: true,
  minStockQty: true,
  imageUrl: true,
  isActive: true,
  categoryId: true,
  category: { select: { name: true } },
} as const;

type ProductRowRecord = {
  id: string;
  kind: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  priceArs: { toString(): string };
  tracksStock: boolean;
  stockQty: number;
  minStockQty: number | null;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: string | null;
  category: { name: string } | null;
};

function toProductRow(r: ProductRowRecord): ProductRow {
  return {
    id: r.id,
    kind: r.kind,
    sku: r.sku,
    barcode: r.barcode,
    name: r.name,
    brand: r.brand,
    priceMinor: decimalArsToMinor(r.priceArs),
    tracksStock: r.tracksStock,
    stockQty: r.stockQty,
    minStockQty: r.minStockQty,
    imageUrl: r.imageUrl,
    isActive: r.isActive,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
  };
}

/**
 * El listado, con buscador.
 *
 * La búsqueda mira nombre, código interno y código de barras a la vez: quien atiende el
 * mostrador no sabe ni quiere saber por cuál de los tres está buscando. `mode: "insensitive"`
 * sólo en el nombre —el código interno y el de barras son texto exacto que nadie escribe con
 * mayúsculas distintas dos veces, pero tampoco tiene sentido que "1" encuentre "10001"—.
 *
 * Por omisión trae también los inactivos: es la pantalla de catálogo completo, no la del
 * mostrador. `onlyActive` es para quien sí necesite ocultarlos.
 */
export async function listProducts(
  workspaceId: string,
  opts: { search?: string; categoryId?: string; onlyActive?: boolean; tracksStock?: boolean } = {},
): Promise<ProductRow[]> {
  const q = opts.search?.trim();
  const rows = await prisma.product.findMany({
    where: {
      workspaceId,
      ...(opts.onlyActive ? { isActive: true } : {}),
      ...(opts.tracksStock ? { tracksStock: true } : {}),
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { sku: { contains: q } },
              { barcode: { contains: q } },
            ],
          }
        : {}),
    },
    select: PRODUCT_ROW_SELECT,
    orderBy: { name: "asc" },
    take: 200,
  });

  return rows.map(toProductRow);
}

/**
 * Busca un producto cuyo código interno o código de barras coincida EXACTO con el texto.
 *
 * Exacto y no parcial: es lo que permite que un lector de códigos agregue el producto al
 * mostrador sin pasar por la lista. El código interno se compara tal cual lo escribió el
 * negocio —puede tener letras o guiones—; el de barras se normaliza antes de comparar,
 * porque en la base siempre queda guardado sólo con dígitos (ver `barcode.ts`).
 */
export async function findProductByCode(
  workspaceId: string,
  code: string,
): Promise<ProductRow | null> {
  const texto = code.trim();
  if (texto === "") return null;
  const codigoBarras = normalizeBarcode(texto);

  const row = await prisma.product.findFirst({
    where: {
      workspaceId,
      // Mismo criterio que la grilla y la búsqueda (`listProducts`, más arriba): un producto
      // dado de baja no aparece para vender. Sin este filtro, el lector lo agregaba igual al
      // ticket aunque la propia ficha le dijera a la persona que ya no está disponible.
      isActive: true,
      OR: [{ sku: texto }, ...(codigoBarras ? [{ barcode: codigoBarras }] : [])],
    },
    select: PRODUCT_ROW_SELECT,
  });
  return row ? toProductRow(row) : null;
}

export type ProductDetail = {
  id: string;
  kind: string;
  sku: string | null;
  barcode: string | null;
  globalProductId: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  priceMinor: number;
  costMinor: number | null;
  tracksStock: boolean;
  stockQty: number;
  minStockQty: number | null;
  categoryId: string | null;
  supplierName: string | null;
  imageUrl: string | null;
  isActive: boolean;
};

/** La ficha. Devuelve null si no existe o si es de otro workspace. */
export async function getProduct(
  workspaceId: string,
  productId: string,
): Promise<ProductDetail | null> {
  const r = await prisma.product.findFirst({
    where: { id: productId, workspaceId },
    select: {
      id: true,
      kind: true,
      sku: true,
      barcode: true,
      globalProductId: true,
      name: true,
      description: true,
      brand: true,
      priceArs: true,
      costArs: true,
      tracksStock: true,
      stockQty: true,
      minStockQty: true,
      categoryId: true,
      supplierName: true,
      imageUrl: true,
      isActive: true,
    },
  });
  if (!r) return null;

  return {
    id: r.id,
    kind: r.kind,
    sku: r.sku,
    barcode: r.barcode,
    globalProductId: r.globalProductId,
    name: r.name,
    description: r.description,
    brand: r.brand,
    priceMinor: decimalArsToMinor(r.priceArs),
    costMinor: r.costArs === null ? null : decimalArsToMinor(r.costArs),
    tracksStock: r.tracksStock,
    stockQty: r.stockQty,
    minStockQty: r.minStockQty,
    categoryId: r.categoryId,
    supplierName: r.supplierName,
    imageUrl: r.imageUrl,
    isActive: r.isActive,
  };
}

export type ProductCategoryRow = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
};

/**
 * Las categorías del workspace, en el orden en que se configuraron.
 *
 * Por omisión sólo las activas —lo que necesita el selector del formulario, para no ofrecer
 * una categoría dada de baja—. `includeInactive` es para el panel de administración, donde
 * sí hace falta verlas para poder reactivarlas.
 */
export async function listProductCategories(
  workspaceId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<ProductCategoryRow[]> {
  return prisma.productCategory.findMany({
    where: { workspaceId, ...(opts.includeInactive ? {} : { isActive: true }) },
    select: { id: true, name: true, order: true, isActive: true },
    orderBy: { order: "asc" },
  });
}

export type SaleItemRow = {
  id: string;
  description: string;
  qty: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
};

export type SaleRow = {
  id: string;
  saleNumber: number;
  occurredAt: Date;
  clientName: string | null;
  totalMinor: number;
  paymentMethod: string;
  status: string;
  voidedAt: Date | null;
  voidedByUserId: number | null;
  voidReason: string | null;
  items: SaleItemRow[];
};

const SALE_ROW_SELECT = {
  id: true,
  saleNumber: true,
  occurredAt: true,
  totalArs: true,
  paymentMethod: true,
  status: true,
  voidedAt: true,
  voidedByUserId: true,
  voidReason: true,
  client: { select: { kind: true, firstName: true, lastName: true, businessName: true } },
  items: {
    select: { id: true, description: true, qty: true, unitPriceArs: true, lineTotalArs: true },
  },
} as const;

type SaleRowRecord = {
  id: string;
  saleNumber: number;
  occurredAt: Date;
  totalArs: { toString(): string };
  paymentMethod: string;
  status: string;
  voidedAt: Date | null;
  voidedByUserId: number | null;
  voidReason: string | null;
  client: { kind: string; firstName: string | null; lastName: string | null; businessName: string | null } | null;
  items: {
    id: string;
    description: string;
    qty: number;
    unitPriceArs: { toString(): string };
    lineTotalArs: { toString(): string };
  }[];
};

function toSaleRow(r: SaleRowRecord): SaleRow {
  return {
    id: r.id,
    saleNumber: r.saleNumber,
    occurredAt: r.occurredAt,
    clientName: r.client ? clientDisplayName(r.client) : null,
    totalMinor: decimalArsToMinor(r.totalArs),
    paymentMethod: r.paymentMethod,
    status: r.status,
    voidedAt: r.voidedAt,
    voidedByUserId: r.voidedByUserId,
    voidReason: r.voidReason,
    items: r.items.map((i) => ({
      id: i.id,
      description: i.description,
      qty: i.qty,
      unitPriceMinor: decimalArsToMinor(i.unitPriceArs),
      lineTotalMinor: decimalArsToMinor(i.lineTotalArs),
    })),
  };
}

export type MarginSourceLine = {
  productId: string | null;
  description: string;
  qty: number;
  revenueMinor: number;
  costMinor: number | null;
};

/**
 * Los renglones para el reporte de margen: sólo de ventas COMPLETADAS del período —una
 * anulada no vendió nada, y contarla infla el margen con una venta que no existió—.
 *
 * El costo sale de `SaleItem.unitCostArs`, la foto del costo al momento de vender, no del
 * costo actual del producto: si el proveedor subió el precio después, esta venta vieja
 * tiene que seguir mostrando lo que costó entonces. `null` viaja tal cual —nunca se
 * convierte en cero acá—: es `lib/sales/margin.ts` quien decide qué hacer con un costo
 * desconocido.
 */
export async function listSaleItemsForMargin(
  workspaceId: string,
  range: { from: Date; to: Date },
): Promise<MarginSourceLine[]> {
  const rows = await prisma.saleItem.findMany({
    where: {
      sale: { workspaceId, status: "COMPLETADA", occurredAt: { gte: range.from, lte: range.to } },
    },
    select: {
      productId: true,
      description: true,
      qty: true,
      unitCostArs: true,
      lineTotalArs: true,
    },
  });

  return rows.map((r) => ({
    productId: r.productId,
    description: r.description,
    qty: r.qty,
    revenueMinor: decimalArsToMinor(r.lineTotalArs),
    costMinor: r.unitCostArs === null ? null : decimalArsToMinor(r.unitCostArs) * r.qty,
  }));
}

/**
 * El historial, de la más nueva a la más vieja. Trae el detalle de renglones de una: el
 * historial es chico comparado con el catálogo (no hay lector de código de barras compitiendo
 * por latencia acá) y separar "lista" de "detalle" en dos consultas sólo movería el mismo
 * costo a un segundo viaje al servidor por cada venta que alguien abra.
 *
 * Las anuladas se traen igual que las demás —nunca se esconden (§regla del historial creíble):
 * `status` viaja tal cual para que la pantalla decida cómo marcarlas.
 */
export async function listSales(
  workspaceId: string,
  opts: { limit?: number } = {},
): Promise<SaleRow[]> {
  const rows = await prisma.sale.findMany({
    where: { workspaceId },
    select: SALE_ROW_SELECT,
    orderBy: [{ occurredAt: "desc" }, { saleNumber: "desc" }],
    take: opts.limit ?? 200,
  });
  return rows.map(toSaleRow);
}
