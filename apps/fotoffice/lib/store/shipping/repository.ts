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

export type ShippingSource = "TABLE" | "CORREO_ARGENTINO";

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
};

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
    // Un valor desconocido en la base se trata como la tabla (el default del esquema).
    source: s.source === "CORREO_ARGENTINO" ? "CORREO_ARGENTINO" : "TABLE",
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
    select: { productId: true, weightGrams: true, lengthCm: true, widthCm: true, heightCm: true },
  });
  return new Map(filas.map((f) => [f.productId, f]));
}

export type ShippingPrintFormatRow = {
  id: string;
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
    select: { id: true, weightGrams: true, packLengthCm: true, packWidthCm: true, packHeightCm: true },
  });
  return new Map(filas.map((f) => [f.id, f]));
}
