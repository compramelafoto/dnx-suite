import "server-only";
import { prisma } from "@repo/db";
import {
  loadCorreoArgentinoClient,
  markCorreoNeedsReconsent,
} from "@/lib/integrations/correo-argentino/credentials";
import { isMiCorreoError } from "@/lib/integrations/correo-argentino/errors";
import { loadAndreaniClient, markAndreaniNeedsReconsent } from "@/lib/integrations/andreani/credentials";
import { isAndreaniError } from "@/lib/integrations/andreani/errors";
import {
  buildPackage,
  exceedsAndreaniLimits,
  exceedsCorreoLimits,
  normalizePostalCode,
  type ShippingPackage,
} from "./package";
import { isProvinceCode } from "./provinces";
import {
  loadShippingListings,
  loadShippingPrintFormats,
  loadShippingSettings,
  loadShippingZones,
  type ShippingDb,
  type ShippingSettingsRow,
  type ShippingSource,
} from "./repository";
import { applySurcharge } from "./surcharge";
import { pickRate, pickZone } from "./table";

/**
 * La única puerta para cotizar un envío (E1). Fuentes: tabla propia, Correo Argentino o Andreani,
 * con la tabla como respaldo a domicilio si la institución lo dejó así (E14). Nunca lanza por la
 * red: cualquier falla del correo termina en el respaldo o en `UNAVAILABLE`.
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
  /** Cotizado con el ambiente de pruebas de Andreani: la tarifa no es real. Sólo para el panel. */
  testMode?: true;
};

export type ShippingQuoteFailure = "DISABLED" | "NO_COVERAGE" | "TOO_BIG" | "UNAVAILABLE";

export type QuoteShippingResult = { ok: true; quote: ShippingQuote } | { ok: false; reason: ShippingQuoteFailure };

export type QuoteShippingDeps = {
  loadCorreo?: typeof loadCorreoArgentinoClient;
  markNeedsReconsent?: typeof markCorreoNeedsReconsent;
  loadAndreani?: typeof loadAndreaniClient;
  markAndreaniNeedsReconsent?: typeof markAndreaniNeedsReconsent;
  now?: () => Date;
};

/**
 * Lo que va en el paquete. Un producto (sin `kind`, como siempre) pesa lo de su ficha online; una
 * obra, lo de su formato de impresión (peso y medidas de embalaje).
 */
export type QuoteShippingItem =
  | { kind?: "product"; productId: string; variantId: string | null; qty: number }
  | { kind: "artwork"; printFormatId: string; qty: number };

export type QuoteShippingInput = {
  workspaceId: string;
  method: ShippingMethod;
  /**
   * La provincia hace falta para la tabla y para Correo. A sucursal de Andreani se cotiza sólo con
   * el CP (el de la sucursal elegida), así que ahí puede venir vacía.
   */
  destination: { postalCode: string; provinceCode: string };
  items: QuoteShippingItem[];
  db?: ShippingDb;
  deps?: QuoteShippingDeps;
};

type BasePrice = { source: ShippingSource; baseMinor: number; serviceName: string; raw: unknown; testMode?: true };

function fail(reason: ShippingQuoteFailure): QuoteShippingResult {
  return { ok: false, reason };
}

function methodEnabled(settings: ShippingSettingsRow, method: ShippingMethod): boolean {
  if (method === "HOME") return settings.homeDeliveryEnabled;
  // Sucursal sólo existe con un correo como fuente: Correo Argentino (E9) o Andreani.
  return settings.branchDeliveryEnabled && settings.source !== "TABLE";
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

/** El contrato de sucursal no está cargado: la institución no puede enviar a sucursal de Andreani. */
const SIN_CONTRATO_SUCURSAL = "SIN_CONTRATO_SUCURSAL" as const;

/**
 * Cotiza con Andreani. `null` si no se pudo (no conectado, error, precio inválido). El contrato
 * define la modalidad: domicilio o sucursal. Un solo bulto, con el peso en kilos.
 */
async function quoteFromAndreani(
  workspaceId: string,
  method: ShippingMethod,
  destPostalCode: string,
  pkg: ShippingPackage,
  declaredValueMinor: number,
  deps: QuoteShippingDeps,
): Promise<BasePrice | null | typeof SIN_CONTRATO_SUCURSAL> {
  const loadAndreani = deps.loadAndreani ?? loadAndreaniClient;
  const markNeedsReconsent = deps.markAndreaniNeedsReconsent ?? markAndreaniNeedsReconsent;
  try {
    const conexion = await loadAndreani(workspaceId);
    if (!conexion) return null;
    const contract = method === "HOME" ? conexion.contractHome : conexion.contractBranch;
    if (!contract) return SIN_CONTRATO_SUCURSAL;
    const r = await conexion.client.quote({
      clientCode: conexion.clientCode,
      contract,
      postalCodeDestination: destPostalCode,
      originBranch: conexion.originBranch,
      packages: [
        {
          weightKg: pkg.weightGrams / 1000,
          lengthCm: pkg.lengthCm,
          widthCm: pkg.widthCm,
          heightCm: pkg.heightCm,
          declaredValueMinor,
        },
      ],
    });
    return {
      source: "ANDREANI",
      baseMinor: r.priceMinor,
      serviceName: method === "HOME" ? "Andreani a domicilio" : "Andreani a sucursal",
      raw: r.raw,
      ...(conexion.env === "QA" ? { testMode: true as const } : {}),
    };
  } catch (error) {
    // Sólo `kind` y `status`: el mensaje puede traer datos de la cuenta (ver errors.ts).
    if (isAndreaniError(error)) {
      console.warn("[shipping] Andreani no cotizó", { kind: error.kind, status: error.status });
      if (error.kind === "AUTH") await markNeedsReconsent(workspaceId).catch(() => undefined);
    } else {
      console.warn("[shipping] Andreani no cotizó por un error inesperado");
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
  // A sucursal de Andreani no hay tabla de respaldo ni hace falta la provincia: sólo el CP.
  const sinProvincia = method === "BRANCH" && settings.source === "ANDREANI";
  if (!postalCode || (!sinProvincia && !isProvinceCode(provinceCode))) return fail("NO_COVERAGE");
  const dest = { postalCode, provinceCode };

  const items = input.items.filter((i) => Number.isFinite(i.qty) && i.qty > 0);
  if (items.length === 0) return fail("UNAVAILABLE");
  const productos = items.flatMap((i) => (i.kind === "artwork" ? [] : [i]));
  const obras = items.flatMap((i) => (i.kind === "artwork" ? [i] : []));
  const [listados, formatos] = await Promise.all([
    productos.length > 0
      ? loadShippingListings(
          workspaceId,
          productos.map((i) => i.productId),
          db,
        )
      : new Map<string, never>(),
    obras.length > 0
      ? loadShippingPrintFormats(
          workspaceId,
          obras.map((i) => i.printFormatId),
          db,
        )
      : new Map<string, never>(),
  ]);
  const paqueteItems = [];
  // Valor declarado para Andreani: lo que vale lo que va en el paquete (productos y obras), sin el
  // envío. Un precio que no se pudo leer suma 0: el seguro es opcional, la cotización no.
  let declaredValueMinor = 0;
  for (const it of items) {
    if (it.kind === "artwork") {
      const f = formatos.get(it.printFormatId);
      if (!f) return fail("UNAVAILABLE");
      // Sin peso, el de por defecto (lo hace `buildPackage`); las medidas cuentan si están las tres.
      paqueteItems.push({ qty: it.qty, weightGrams: f.weightGrams, lengthCm: f.packLengthCm, widthCm: f.packWidthCm, heightCm: f.packHeightCm });
      declaredValueMinor += it.qty * Math.max(0, f.priceMinor ?? 0);
      continue;
    }
    const l = listados.get(it.productId);
    if (!l) return fail("UNAVAILABLE");
    paqueteItems.push({ qty: it.qty, weightGrams: l.weightGrams, lengthCm: l.lengthCm, widthCm: l.widthCm, heightCm: l.heightCm });
    const unitario = (it.variantId ? l.variantPricesMinor?.get(it.variantId) : undefined) ?? l.priceMinor ?? 0;
    declaredValueMinor += it.qty * Math.max(0, unitario);
  }
  if (!Number.isSafeInteger(declaredValueMinor)) declaredValueMinor = 0;
  const pkg = buildPackage(paqueteItems, settings.packageConfig);

  // La tabla responde a domicilio solamente: sucursal no tiene respaldo.
  const tablaDeRespaldo = method === "HOME" && settings.tableAsFallback;
  let base: BasePrice | null;
  if (settings.source === "TABLE") {
    base = await quoteFromTable(workspaceId, db, dest, pkg);
    if (!base) return fail("NO_COVERAGE");
  } else if (settings.source === "ANDREANI" ? exceedsAndreaniLimits(pkg) : exceedsCorreoLimits(pkg)) {
    if (!tablaDeRespaldo) return fail("TOO_BIG");
    base = await quoteFromTable(workspaceId, db, dest, pkg);
    if (!base) return fail("NO_COVERAGE");
  } else {
    if (settings.source === "ANDREANI") {
      const andreani = await quoteFromAndreani(workspaceId, method, postalCode, pkg, declaredValueMinor, deps);
      // Sin contrato de sucursal, la sucursal de Andreani no existe para esta institución.
      if (andreani === SIN_CONTRATO_SUCURSAL) return fail("DISABLED");
      base = andreani;
    } else {
      base = await quoteFromCorreo(workspaceId, method, settings.originPostalCode, postalCode, pkg, deps);
    }
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
      ...(base.testMode ? { testMode: true as const } : {}),
    },
  };
}
