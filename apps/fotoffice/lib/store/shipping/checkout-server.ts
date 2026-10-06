import "server-only";
import { prisma } from "@repo/db";
import {
  isCorreoArgentinoActive,
  loadCorreoArgentinoClient,
  markCorreoNeedsReconsent,
} from "@/lib/integrations/correo-argentino/credentials";
import { isMiCorreoError } from "@/lib/integrations/correo-argentino/errors";
import { loadAndreaniClient, markAndreaniNeedsReconsent } from "@/lib/integrations/andreani/credentials";
import { isAndreaniError } from "@/lib/integrations/andreani/errors";
import {
  deliveryOptionsFromSettings,
  parseQuoteRequest,
  publicAgencies,
  publicQuoteResult,
  shippingFailureMessage,
  type DeliveryOptions,
  type PublicAgency,
  type PublicQuoteResult,
} from "./checkout";
import { normalizePostalCode } from "./package";
import { isProvinceCode } from "./provinces";
import { quoteShipping } from "./quote";
import { loadShippingSettings } from "./repository";

/**
 * El envío visto desde el checkout público: qué formas de entrega se ofrecen, cotizar y listar
 * sucursales. Lo que sale de acá va al navegador, así que pasa por los recortes de `checkout.ts`.
 */

/**
 * Formas de entrega que ve el comprador y el aviso de despacho de la institución. Sólo las que
 * se pueden cotizar: si cotiza con un correo, se mira además si la conexión está activa (y, con
 * Andreani, si tiene contrato de sucursal).
 */
export async function loadCheckoutDeliveryOptions(
  workspaceId: string,
  deps: { loadAndreani?: typeof loadAndreaniClient } = {},
): Promise<DeliveryOptions> {
  const row = await prisma.storeShippingSettings.findUnique({
    where: { workspaceId },
    select: {
      pickupEnabled: true,
      homeDeliveryEnabled: true,
      branchDeliveryEnabled: true,
      source: true,
      tableAsFallback: true,
      handlingNote: true,
    },
  });
  const conEnvio = row !== null && (row.homeDeliveryEnabled || row.branchDeliveryEnabled);
  if (conEnvio && row.source === "ANDREANI") {
    // `null` si no está conectada o hay que reconectar. Nada de esto sale de acá: sólo si sirve.
    const andreani = await (deps.loadAndreani ?? loadAndreaniClient)(workspaceId);
    return deliveryOptionsFromSettings(row, andreani !== null, { branchContract: Boolean(andreani?.contractBranch) });
  }
  const correoActive = conEnvio && row.source === "CORREO_ARGENTINO" ? await isCorreoArgentinoActive(workspaceId) : false;
  return deliveryOptionsFromSettings(row, correoActive);
}

/** ¿La institución ofrece retiro? Para no sugerirlo en los mensajes de falla si no. Ante la duda, sí. */
async function ofreceRetiro(workspaceId: string): Promise<boolean> {
  try {
    return (await loadCheckoutDeliveryOptions(workspaceId)).pickup;
  } catch {
    return true;
  }
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
    if (r.ok) return publicQuoteResult(r);
    return publicQuoteResult(r, { pickupEnabled: await ofreceRetiro(input.workspaceId) });
  } catch (error) {
    console.warn("[shipping] el checkout no pudo cotizar", { error: error instanceof Error ? error.name : typeof error });
    return { ok: false, message: shippingFailureMessage("UNAVAILABLE", await ofreceRetiro(input.workspaceId)) };
  }
}

const AGENCIES_TTL_MS = 10 * 60 * 1000;
const AGENCIES_CACHE_MAX = 500;

/**
 * Sucursales por (institución, provincia) con Correo, o por (institución, CP) con Andreani, 10
 * minutos en memoria: cambian muy de vez en cuando y cada comprador que elige sucursal las pide.
 * Como el freno por IP, es por instancia de Vercel. Sólo se guardan las respuestas buenas: una
 * falla del correo se vuelve a intentar.
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

export type AgenciesDeps = {
  loadCorreo?: typeof loadCorreoArgentinoClient;
  loadAndreani?: typeof loadAndreaniClient;
};

/**
 * Las sucursales donde se puede retirar, según el correo de la institución: con Correo Argentino,
 * las de una PROVINCIA; con Andreani, las de un CÓDIGO POSTAL (las que entregan envíos). Quien
 * llama manda lo que tenga; se usa lo que corresponde a la fuente guardada.
 *
 * `ok: false` si no se pudieron traer (el correo falló o la institución no está conectada): eso
 * NO es "la sucursal no existe". Lista vacía si la institución no ofrece sucursal, la fuente es la
 * tabla, falta el dato de búsqueda (o no es válido), o con Andreani no hay contrato de sucursal.
 */
export async function loadAgenciesForOrder(input: {
  workspaceId: string;
  provinceCode?: string | null;
  postalCode?: string | null;
  deps?: AgenciesDeps;
}): Promise<AgenciesResult> {
  const provinceCode = (input.provinceCode ?? "").trim().toUpperCase();
  const postalCode = normalizePostalCode(input.postalCode ?? "");
  const provinciaValida = isProvinceCode(provinceCode);
  // Sin nada con qué buscar, ni se va a la base.
  if (!provinciaValida && !postalCode) return { ok: true, agencies: [] };
  const ahora = Date.now();

  const loadCorreo = input.deps?.loadCorreo ?? loadCorreoArgentinoClient;
  const loadAndreani = input.deps?.loadAndreani ?? loadAndreaniClient;
  let fuente: "CORREO_ARGENTINO" | "ANDREANI" | null = null;
  try {
    // La configuración y la conexión se miran ANTES de la memoria: si la institución apagó la
    // sucursal o el correo se desconectó, lo guardado ya no se ofrece.
    const settings = await loadShippingSettings(input.workspaceId);
    if (!settings || !settings.branchDeliveryEnabled || settings.source === "TABLE") return { ok: true, agencies: [] };
    fuente = settings.source;

    if (fuente === "ANDREANI") {
      if (!postalCode) return { ok: true, agencies: [] };
      const conexion = await loadAndreani(input.workspaceId);
      if (!conexion) return { ok: false };
      if (!conexion.contractBranch) return { ok: true, agencies: [] };
      const clave = `${input.workspaceId}:ANDREANI:${postalCode}`;
      const enMemoria = agenciesCache.get(clave);
      if (enMemoria && ahora - enMemoria.at < AGENCIES_TTL_MS) return { ok: true, agencies: enMemoria.agencies };
      const agencias = publicAgencies(await conexion.client.branches({ postalCode }));
      guardar(clave, agencias, ahora);
      return { ok: true, agencies: agencias };
    }

    if (!provinciaValida) return { ok: true, agencies: [] };
    if (!(await isCorreoArgentinoActive(input.workspaceId))) return { ok: false };
    const clave = `${input.workspaceId}:${provinceCode}`;
    const enMemoria = agenciesCache.get(clave);
    if (enMemoria && ahora - enMemoria.at < AGENCIES_TTL_MS) return { ok: true, agencies: enMemoria.agencies };

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
    } else if (isAndreaniError(error)) {
      console.warn("[shipping] Andreani no listó sucursales", { kind: error.kind, status: error.status });
      if (error.kind === "AUTH") await markAndreaniNeedsReconsent(input.workspaceId).catch(() => undefined);
    } else {
      console.warn("[shipping] no se pudieron listar sucursales", {
        fuente,
        error: error instanceof Error ? error.name : typeof error,
      });
    }
    return { ok: false };
  }
}

export type CheckoutAgenciesResult = { ok: true; agencies: PublicAgency[] } | { ok: false; message: string };

/**
 * Sucursales para elegir dónde retirar: de una provincia con Correo Argentino, de un código postal
 * con Andreani. Vacía si la institución no ofrece sucursal o cotiza con la tabla. Si el correo
 * falló o no está conectado, `ok: false` con el mensaje para el comprador: eso no es "no hay
 * sucursales".
 */
export async function listAgenciesForCheckout(input: {
  workspaceId: string;
  provinceCode?: string | null;
  postalCode?: string | null;
  deps?: AgenciesDeps;
}): Promise<CheckoutAgenciesResult> {
  const r = await loadAgenciesForOrder(input);
  if (r.ok) return r;
  return { ok: false, message: shippingFailureMessage("UNAVAILABLE", await ofreceRetiro(input.workspaceId)) };
}
