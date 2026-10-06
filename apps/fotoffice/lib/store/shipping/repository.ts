import "server-only";
import { Prisma, prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import type { PackageConfig } from "./package";
import type { Surcharge } from "./surcharge";
import type { ShippingZoneInput } from "./table";

/**
 * Lecturas de la configuración de envíos de una institución. Todas filtran por `workspaceId`
 * (también en el producto, que tiene el suyo propio aparte del listado).
 */

export type ShippingDb = Prisma.TransactionClient | typeof prisma;

export type ShippingSource = "TABLE" | "CORREO_ARGENTINO" | "ANDREANI";

/** Lo que dice la columna (texto) → la fuente. Un valor desconocido es la tabla (el default del esquema). */
export function toShippingSource(value: string | null | undefined): ShippingSource {
  return value === "CORREO_ARGENTINO" || value === "ANDREANI" ? value : "TABLE";
}

export type ShippingSettingsRow = {
  homeDeliveryEnabled: boolean;
  branchDeliveryEnabled: boolean;
  source: ShippingSource;
  tableAsFallback: boolean;
  originPostalCode: string | null;
  surcharge: Surcharge;
  packageConfig: PackageConfig;
};

export type ShippingZoneRow = ShippingZoneInput & {
  name: string;
  rates: { maxGrams: number; priceMinor: number }[];
};

export type ShippingListingRow = {
  productId: string;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  /** Precio del producto (centavos), para el valor declarado de Andreani. `null` si no se leyó. */
  priceMinor: number | null;
  /** Precio propio de cada talle ACTIVO que lo tiene (centavos); el resto hereda el del producto. */
  variantPricesMinor: Map<string, number>;
};

type Decimalish = { toString(): string } | null | undefined;

/** Decimal de la base → centavos; `null` si no vino (los tests que no lo cargan). */
function aMinor(value: Decimalish): number | null {
  if (value === null || value === undefined) return null;
  const minor = decimalArsToMinor(value);
  return Number.isSafeInteger(minor) ? minor : null;
}

function aSurchargeKind(value: string): Surcharge["kind"] {
  return value === "PERCENT" || value === "FIXED" ? value : "NONE";
}

export async function loadShippingSettings(
  workspaceId: string,
  db: ShippingDb = prisma,
): Promise<ShippingSettingsRow | null> {
  const s = await db.storeShippingSettings.findUnique({
    where: { workspaceId },
    select: {
      homeDeliveryEnabled: true,
      branchDeliveryEnabled: true,
      source: true,
      tableAsFallback: true,
      originPostalCode: true,
      surchargeKind: true,
      surchargeValue: true,
      packagingGrams: true,
      defaultUnitGrams: true,
      boxLengthCm: true,
      boxWidthCm: true,
      boxHeightCm: true,
    },
  });
  if (!s) return null;
  return {
    homeDeliveryEnabled: s.homeDeliveryEnabled,
    branchDeliveryEnabled: s.branchDeliveryEnabled,
    source: toShippingSource(s.source),
    tableAsFallback: s.tableAsFallback,
    originPostalCode: s.originPostalCode,
    surcharge: { kind: aSurchargeKind(s.surchargeKind), value: s.surchargeValue },
    packageConfig: {
      packagingGrams: s.packagingGrams,
      defaultUnitGrams: s.defaultUnitGrams,
      boxLengthCm: s.boxLengthCm,
      boxWidthCm: s.boxWidthCm,
      boxHeightCm: s.boxHeightCm,
    },
  };
}

export async function loadShippingZones(workspaceId: string, db: ShippingDb = prisma): Promise<ShippingZoneRow[]> {
  const zonas = await db.storeShippingZone.findMany({
    where: { workspaceId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      postalCodes: true,
      provinceCodes: true,
      isRestOfCountry: true,
      sortOrder: true,
      rates: { select: { maxGrams: true, priceArs: true } },
    },
  });
  return zonas.map((z) => ({
    id: z.id,
    name: z.name,
    postalCodes: z.postalCodes,
    provinceCodes: z.provinceCodes,
    isRestOfCountry: z.isRestOfCountry,
    sortOrder: z.sortOrder,
    rates: z.rates.map((r) => ({ maxGrams: r.maxGrams, priceMinor: decimalArsToMinor(r.priceArs) })),
  }));
}

/** Peso y medidas de los productos que se venden online (los talles heredan los del producto). */
export async function loadShippingListings(
  workspaceId: string,
  productIds: readonly string[],
  db: ShippingDb = prisma,
): Promise<Map<string, ShippingListingRow>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map();
  const filas = await db.productStoreListing.findMany({
    where: {
      workspaceId,
      sellOnline: true,
      productId: { in: ids },
      product: { workspaceId, isActive: true },
    },
    select: {
      productId: true,
      weightGrams: true,
      lengthCm: true,
      widthCm: true,
      heightCm: true,
      product: {
        select: { priceArs: true, variants: { where: { isActive: true }, select: { id: true, priceArs: true } } },
      },
    },
  });
  return new Map(
    filas.map((f) => {
      const { product, ...resto } = f as typeof f & { product?: { priceArs?: Decimalish; variants?: { id: string; priceArs: Decimalish }[] } | null };
      const variantPricesMinor = new Map<string, number>();
      for (const v of product?.variants ?? []) {
        const precio = aMinor(v.priceArs);
        if (precio !== null) variantPricesMinor.set(v.id, precio);
      }
      return [f.productId, { ...resto, priceMinor: aMinor(product?.priceArs), variantPricesMinor }];
    }),
  );
}

export type ShippingPrintFormatRow = {
  id: string;
  /** Precio del formato (centavos), para el valor declarado de Andreani. `null` si no se leyó. */
  priceMinor: number | null;
  weightGrams: number | null;
  packLengthCm: number | null;
  packWidthCm: number | null;
  packHeightCm: number | null;
};

/** Peso y embalaje de los formatos de impresión ACTIVOS de la institución (las obras se envían así). */
export async function loadShippingPrintFormats(
  workspaceId: string,
  printFormatIds: readonly string[],
  db: ShippingDb = prisma,
): Promise<Map<string, ShippingPrintFormatRow>> {
  const ids = [...new Set(printFormatIds)];
  if (ids.length === 0) return new Map();
  const filas = await db.printFormat.findMany({
    where: { workspaceId, isActive: true, id: { in: ids } },
    select: { id: true, weightGrams: true, packLengthCm: true, packWidthCm: true, packHeightCm: true, priceArs: true },
  });
  return new Map(
    filas.map((f) => {
      const { priceArs, ...resto } = f as typeof f & { priceArs?: Decimalish };
      return [f.id, { ...resto, priceMinor: aMinor(priceArs) }];
    }),
  );
}
