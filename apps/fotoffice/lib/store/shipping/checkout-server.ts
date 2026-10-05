import "server-only";
import { prisma } from "@repo/db";
import {
  loadCorreoArgentinoClient,
  markCorreoNeedsReconsent,
} from "@/lib/integrations/correo-argentino/credentials";
import { isMiCorreoError } from "@/lib/integrations/correo-argentino/errors";
import {
  deliveryOptionsFromSettings,
  parseQuoteRequest,
  publicAgencies,
  publicQuoteResult,
  SHIPPING_FAILURE_MESSAGES,
  type DeliveryOptions,
  type PublicAgency,
  type PublicQuoteResult,
} from "./checkout";
import { isProvinceCode } from "./provinces";
import { quoteShipping } from "./quote";
import { loadShippingSettings } from "./repository";

/**
 * El envío visto desde el checkout público: qué formas de entrega se ofrecen, cotizar y listar
 * sucursales. Lo que sale de acá va al navegador, así que pasa por los recortes de `checkout.ts`.
 */

/** Formas de entrega que ve el comprador y el aviso de despacho de la institución. */
export async function loadCheckoutDeliveryOptions(workspaceId: string): Promise<DeliveryOptions> {
  const row = await prisma.storeShippingSettings.findUnique({
    where: { workspaceId },
    select: {
      pickupEnabled: true,
      homeDeliveryEnabled: true,
      branchDeliveryEnabled: true,
      source: true,
      handlingNote: true,
    },
  });
  return deliveryOptionsFromSettings(row);
}

/**
 * Cotiza para el checkout. Nunca lanza: cualquier error inesperado (la base, por ejemplo) se
 * muestra como "no pudimos calcular" y se loguea sin el mensaje, que podría traer datos.
 */
export async function quoteForCheckout(input: {
  workspaceId: string;
  raw: unknown;
  quote?: typeof quoteShipping;
}): Promise<PublicQuoteResult> {
  const pedido = parseQuoteRequest(input.raw);
  if (!pedido.ok) return pedido;
  const quote = input.quote ?? quoteShipping;
  try {
    const r = await quote({
      workspaceId: input.workspaceId,
      method: pedido.value.method,
      destination: { postalCode: pedido.value.postalCode, provinceCode: pedido.value.provinceCode },
      items: pedido.value.lines,
    });
    return publicQuoteResult(r);
  } catch (error) {
    console.warn("[shipping] el checkout no pudo cotizar", { error: error instanceof Error ? error.name : typeof error });
    return { ok: false, message: SHIPPING_FAILURE_MESSAGES.UNAVAILABLE };
  }
}

const AGENCIES_TTL_MS = 10 * 60 * 1000;
const AGENCIES_CACHE_MAX = 500;

/**
 * Sucursales por (institución, provincia), 10 minutos en memoria: cambian muy de vez en cuando y
 * cada comprador que elige sucursal las pide. Como el freno por IP, es por instancia de Vercel.
 * Sólo se guardan las respuestas buenas: una falla de Correo se vuelve a intentar.
 */
const agenciesCache = new Map<string, { at: number; agencies: PublicAgency[] }>();

/** Sólo para los tests. */
export function resetAgenciesCacheForTests(): void {
  agenciesCache.clear();
}

function guardar(clave: string, agencies: PublicAgency[], ahora: number) {
  if (agenciesCache.size >= AGENCIES_CACHE_MAX) {
    for (const [k, v] of agenciesCache) {
      if (ahora - v.at >= AGENCIES_TTL_MS) agenciesCache.delete(k);
    }
    // Si todas siguen vigentes, se descarta la más vieja (el Map conserva el orden de inserción).
    if (agenciesCache.size >= AGENCIES_CACHE_MAX) {
      const primera = agenciesCache.keys().next().value;
      if (primera !== undefined) agenciesCache.delete(primera);
    }
  }
  agenciesCache.set(clave, { at: ahora, agencies });
}

export type AgenciesResult = { ok: true; agencies: PublicAgency[] } | { ok: false };

/**
 * Sucursales de Correo Argentino de una provincia. `ok: false` si no se pudieron traer (Correo
 * falló o la institución no está conectada): eso NO es "la sucursal no existe". Lista vacía si
 * la institución no ofrece sucursal o no cotiza con Correo, o la provincia no es válida.
 */
export async function loadAgenciesForOrder(input: {
  workspaceId: string;
  provinceCode: string;
  deps?: { loadCorreo?: typeof loadCorreoArgentinoClient };
}): Promise<AgenciesResult> {
  const provinceCode = (input.provinceCode ?? "").trim().toUpperCase();
  if (!isProvinceCode(provinceCode)) return { ok: true, agencies: [] };
  const clave = `${input.workspaceId}:${provinceCode}`;
  const ahora = Date.now();
  const enMemoria = agenciesCache.get(clave);
  if (enMemoria && ahora - enMemoria.at < AGENCIES_TTL_MS) return { ok: true, agencies: enMemoria.agencies };

  const loadCorreo = input.deps?.loadCorreo ?? loadCorreoArgentinoClient;
  try {
    const settings = await loadShippingSettings(input.workspaceId);
    if (!settings || !settings.branchDeliveryEnabled || settings.source !== "CORREO_ARGENTINO") return { ok: true, agencies: [] };
    const conexion = await loadCorreo(input.workspaceId);
    if (!conexion) return { ok: false };
    const agencias = publicAgencies(await conexion.client.agencies({ customerId: conexion.customerId, provinceCode }));
    guardar(clave, agencias, ahora);
    return { ok: true, agencies: agencias };
  } catch (error) {
    // Sólo `kind` y `status`: el mensaje puede traer datos de la cuenta (ver errors.ts).
    if (isMiCorreoError(error)) {
      console.warn("[shipping] MiCorreo no listó sucursales", { kind: error.kind, status: error.status });
      if (error.kind === "AUTH") await markCorreoNeedsReconsent(input.workspaceId).catch(() => undefined);
    } else {
      console.warn("[shipping] no se pudieron listar sucursales", { error: error instanceof Error ? error.name : typeof error });
    }
    return { ok: false };
  }
}

/**
 * Sucursales de Correo Argentino de una provincia, para elegir dónde retirar. Vacía si la
 * institución no ofrece sucursal, no cotiza con Correo, no está conectada o Correo falló.
 */
export async function listAgenciesForCheckout(input: {
  workspaceId: string;
  provinceCode: string;
  deps?: { loadCorreo?: typeof loadCorreoArgentinoClient };
}): Promise<PublicAgency[]> {
  const r = await loadAgenciesForOrder(input);
  return r.ok ? r.agencies : [];
}
