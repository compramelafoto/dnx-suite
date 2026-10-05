import "server-only";
import { prisma } from "@repo/db";
import {
  loadCorreoArgentinoClient,
  markCorreoNeedsReconsent,
} from "@/lib/integrations/correo-argentino/credentials";
import { isMiCorreoError } from "@/lib/integrations/correo-argentino/errors";
import { buildPackage, exceedsCorreoLimits, normalizePostalCode, type ShippingPackage } from "./package";
import { isProvinceCode } from "./provinces";
import {
  loadShippingListings,
  loadShippingSettings,
  loadShippingZones,
  type ShippingDb,
  type ShippingSettingsRow,
  type ShippingSource,
} from "./repository";
import { applySurcharge } from "./surcharge";
import { pickRate, pickZone } from "./table";

/**
 * La única puerta para cotizar un envío (E1). Fuentes: tabla propia o Correo Argentino, con la
 * tabla como respaldo si la institución lo dejó así (E14). Nunca lanza por la red: cualquier
 * falla de MiCorreo termina en el respaldo o en `UNAVAILABLE`.
 *
 * El precio sale siempre de acá, en el servidor: el navegador no manda precios (E10).
 */

export type ShippingMethod = "HOME" | "BRANCH";

export type ShippingQuote = {
  method: ShippingMethod;
  source: ShippingSource;
  baseMinor: number;
  surchargeMinor: number;
  totalMinor: number;
  serviceName: string;
  package: ShippingPackage;
  raw: unknown;
};

export type ShippingQuoteFailure = "DISABLED" | "NO_COVERAGE" | "TOO_BIG" | "UNAVAILABLE";

export type QuoteShippingResult = { ok: true; quote: ShippingQuote } | { ok: false; reason: ShippingQuoteFailure };

export type QuoteShippingDeps = {
  loadCorreo?: typeof loadCorreoArgentinoClient;
  markNeedsReconsent?: typeof markCorreoNeedsReconsent;
  now?: () => Date;
};

export type QuoteShippingInput = {
  workspaceId: string;
  method: ShippingMethod;
  destination: { postalCode: string; provinceCode: string };
  items: { productId: string; variantId: string | null; qty: number }[];
  db?: ShippingDb;
  deps?: QuoteShippingDeps;
};

type BasePrice = { source: ShippingSource; baseMinor: number; serviceName: string; raw: unknown };

function fail(reason: ShippingQuoteFailure): QuoteShippingResult {
  return { ok: false, reason };
}

function methodEnabled(settings: ShippingSettingsRow, method: ShippingMethod): boolean {
  if (method === "HOME") return settings.homeDeliveryEnabled;
  // Sucursal sólo existe con Correo Argentino (E9).
  return settings.branchDeliveryEnabled && settings.source === "CORREO_ARGENTINO";
}

async function quoteFromTable(
  workspaceId: string,
  db: ShippingDb,
  dest: { postalCode: string; provinceCode: string },
  pkg: ShippingPackage,
): Promise<BasePrice | null> {
  const zonas = await loadShippingZones(workspaceId, db);
  const zoneId = pickZone(zonas, dest);
  const zona = zoneId ? zonas.find((z) => z.id === zoneId) : undefined;
  if (!zona) return null;
  const precio = pickRate(zona.rates, pkg.weightGrams);
  if (precio === null) return null;
  return {
    source: "TABLE",
    baseMinor: precio,
    serviceName: `Envío a ${zona.name}`,
    raw: { zoneId: zona.id, zoneName: zona.name, weightGrams: pkg.weightGrams },
  };
}

/** Cotiza con MiCorreo. `null` si no se pudo (no conectado, error, sin tarifa del tipo). */
async function quoteFromCorreo(
  workspaceId: string,
  method: ShippingMethod,
  originPostalCode: string | null,
  destPostalCode: string,
  pkg: ShippingPackage,
  deps: QuoteShippingDeps,
): Promise<BasePrice | null> {
  const origen = originPostalCode ? normalizePostalCode(originPostalCode) : null;
  if (!origen) return null;
  const loadCorreo = deps.loadCorreo ?? loadCorreoArgentinoClient;
  const markNeedsReconsent = deps.markNeedsReconsent ?? markCorreoNeedsReconsent;
  const deliveredType = method === "HOME" ? "D" : "S";
  try {
    const conexion = await loadCorreo(workspaceId);
    if (!conexion) return null;
    const tarifas = await conexion.client.rates({
      customerId: conexion.customerId,
      postalCodeOrigin: origen,
      postalCodeDestination: destPostalCode,
      deliveredType,
      dimensions: { weight: pkg.weightGrams, length: pkg.lengthCm, width: pkg.widthCm, height: pkg.heightCm },
    });
    let mejor: (typeof tarifas)[number] | null = null;
    for (const t of tarifas) {
      if (t.deliveredType !== deliveredType) continue;
      if (!mejor || t.priceMinor < mejor.priceMinor) mejor = t;
    }
    if (!mejor) return null;
    return {
      source: "CORREO_ARGENTINO",
      baseMinor: mejor.priceMinor,
      serviceName: mejor.productName || (method === "HOME" ? "Correo Argentino a domicilio" : "Correo Argentino a sucursal"),
      raw: mejor.raw,
    };
  } catch (error) {
    // Sólo `kind` y `status`: el mensaje puede traer datos de la cuenta (ver errors.ts).
    if (isMiCorreoError(error)) {
      console.warn("[shipping] MiCorreo no cotizó", { kind: error.kind, status: error.status });
      if (error.kind === "AUTH") await markNeedsReconsent(workspaceId).catch(() => undefined);
    } else {
      console.warn("[shipping] MiCorreo no cotizó por un error inesperado");
    }
    return null;
  }
}

export async function quoteShipping(input: QuoteShippingInput): Promise<QuoteShippingResult> {
  const { workspaceId, method } = input;
  const db = input.db ?? prisma;
  const deps = input.deps ?? {};

  const settings = await loadShippingSettings(workspaceId, db);
  if (!settings || !methodEnabled(settings, method)) return fail("DISABLED");

  const postalCode = normalizePostalCode(input.destination.postalCode ?? "");
  const provinceCode = (input.destination.provinceCode ?? "").trim().toUpperCase();
  if (!postalCode || !isProvinceCode(provinceCode)) return fail("NO_COVERAGE");
  const dest = { postalCode, provinceCode };

  const items = input.items.filter((i) => Number.isFinite(i.qty) && i.qty > 0);
  if (items.length === 0) return fail("UNAVAILABLE");
  const listados = await loadShippingListings(
    workspaceId,
    items.map((i) => i.productId),
    db,
  );
  const paqueteItems = [];
  for (const it of items) {
    const l = listados.get(it.productId);
    if (!l) return fail("UNAVAILABLE");
    paqueteItems.push({ qty: it.qty, weightGrams: l.weightGrams, lengthCm: l.lengthCm, widthCm: l.widthCm, heightCm: l.heightCm });
  }
  const pkg = buildPackage(paqueteItems, settings.packageConfig);

  // La tabla responde a domicilio solamente: sucursal no tiene respaldo.
  const tablaDeRespaldo = method === "HOME" && settings.tableAsFallback;
  let base: BasePrice | null;
  if (settings.source === "TABLE") {
    base = await quoteFromTable(workspaceId, db, dest, pkg);
    if (!base) return fail("NO_COVERAGE");
  } else if (exceedsCorreoLimits(pkg)) {
    if (!tablaDeRespaldo) return fail("TOO_BIG");
    base = await quoteFromTable(workspaceId, db, dest, pkg);
    if (!base) return fail("NO_COVERAGE");
  } else {
    base = await quoteFromCorreo(workspaceId, method, settings.originPostalCode, postalCode, pkg, deps);
    if (!base) {
      if (!tablaDeRespaldo) return fail("UNAVAILABLE");
      base = await quoteFromTable(workspaceId, db, dest, pkg);
      if (!base) return fail("NO_COVERAGE");
    }
  }

  const totalMinor = applySurcharge(base.baseMinor, settings.surcharge);
  return {
    ok: true,
    quote: {
      method,
      source: base.source,
      baseMinor: base.baseMinor,
      surchargeMinor: totalMinor - base.baseMinor,
      totalMinor,
      serviceName: base.serviceName,
      package: pkg,
      raw: base.raw,
    },
  };
}
