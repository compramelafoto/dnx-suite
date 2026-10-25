import { parseCartLinesInput } from "../cart-lines-input";
import { normalizePostalCode } from "./package";
import { isProvinceCode } from "./provinces";
import type { QuoteShippingItem, QuoteShippingResult, ShippingMethod, ShippingQuoteFailure } from "./quote";

/**
 * Lo que el checkout le muestra al comprador sobre el envío. Módulo PURO.
 *
 * Regla: al navegador sólo llegan el total del envío y el nombre del servicio. El precio base, el
 * recargo de la institución, la fuente, el paquete y la respuesta cruda de Correo se quedan en
 * el servidor.
 */

export const SHIPPING_FAILURE_MESSAGES: Record<ShippingQuoteFailure, string> = {
  DISABLED: "Ese tipo de envío no está disponible.",
  NO_COVERAGE: "Todavía no hacemos envíos a ese código postal.",
  TOO_BIG: "El paquete es demasiado grande para enviar. Podés retirarlo en la sede.",
  UNAVAILABLE: "No pudimos calcular el envío. Probá de nuevo o elegí retiro en la sede.",
};

/** Los mismos textos para una institución que no ofrece retiro: no se le sugiere lo que no hay. */
const SHIPPING_FAILURE_MESSAGES_SIN_RETIRO: Record<ShippingQuoteFailure, string> = {
  ...SHIPPING_FAILURE_MESSAGES,
  TOO_BIG: "El paquete es demasiado grande para enviar.",
  UNAVAILABLE: "No pudimos calcular el envío. Probá de nuevo en unos minutos.",
};

/** El texto de una falla de envío; sólo sugiere el retiro en la sede si la institución lo ofrece. */
export function shippingFailureMessage(reason: ShippingQuoteFailure, pickupEnabled: boolean): string {
  return (pickupEnabled ? SHIPPING_FAILURE_MESSAGES : SHIPPING_FAILURE_MESSAGES_SIN_RETIRO)[reason];
}

export type PublicQuoteResult = { ok: true; totalMinor: number; serviceName: string } | { ok: false; message: string };

export function publicQuoteResult(
  r: QuoteShippingResult,
  opts: { pickupEnabled: boolean } = { pickupEnabled: true },
): PublicQuoteResult {
  if (!r.ok) return { ok: false, message: shippingFailureMessage(r.reason, opts.pickupEnabled) };
  return { ok: true, totalMinor: r.quote.totalMinor, serviceName: r.quote.serviceName };
}

export type QuoteRequest = {
  method: ShippingMethod;
  postalCode: string;
  /** A sucursal puede venir vacía (Andreani lista y cotiza por CP); `quoteShipping` decide si hace falta. */
  provinceCode: string;
  lines: QuoteShippingItem[];
};

/** Valida lo que manda el navegador para cotizar. El mensaje de error se muestra tal cual. */
export function parseQuoteRequest(raw: unknown): { ok: true; value: QuoteRequest } | { ok: false; message: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, message: SHIPPING_FAILURE_MESSAGES.UNAVAILABLE };
  const r = raw as Record<string, unknown>;
  if (r.method !== "HOME" && r.method !== "BRANCH") return { ok: false, message: SHIPPING_FAILURE_MESSAGES.DISABLED };
  const postalCode = typeof r.postalCode === "string" ? normalizePostalCode(r.postalCode) : null;
  if (!postalCode) return { ok: false, message: "Ingresá un código postal válido (4 números, ej. 2000)." };
  const provinceCode = typeof r.provinceCode === "string" ? r.provinceCode.trim().toUpperCase() : "";
  const sucursalSinProvincia = r.method === "BRANCH" && provinceCode === "";
  if (!sucursalSinProvincia && !isProvinceCode(provinceCode)) return { ok: false, message: "Elegí la provincia." };
  const lines = parseCartLinesInput(r.lines);
  if (!lines || lines.length === 0) return { ok: false, message: "El carrito es inválido." };
  return {
    ok: true,
    value: {
      method: r.method,
      postalCode,
      provinceCode,
      // Una obra pesa lo que su formato: el listing no cambia el paquete.
      lines: lines.map((l) =>
        l.kind === "artwork"
          ? { kind: "artwork" as const, printFormatId: l.printFormatId, qty: l.qty }
          : { productId: l.productId, variantId: l.variantId, qty: l.qty },
      ),
    },
  };
}

export type DeliveryOptions = {
  pickup: boolean;
  home: boolean;
  branch: boolean;
  handlingNote: string | null;
  /**
   * Sólo cuando el correo es Andreani: la sucursal se busca por código postal y los textos lo
   * nombran. Sin él, la sucursal es de Correo Argentino (por provincia), como siempre.
   */
  carrier?: "ANDREANI";
};

export type DeliverySettingsRow = {
  pickupEnabled: boolean;
  homeDeliveryEnabled: boolean;
  branchDeliveryEnabled: boolean;
  source: string;
  tableAsFallback: boolean;
  handlingNote: string | null;
};

/**
 * Qué formas de entrega ve el comprador. Sin configuración de envíos, sólo retiro (la etapa 1).
 * Sólo se ofrece lo que se puede cotizar: sucursal, sólo con un correo como fuente (Correo
 * Argentino, E9, o Andreani) y su conexión activa (`carrierActive`); domicilio con un correo como
 * fuente, sólo con la conexión activa o la tabla propia de respaldo. Con Andreani, la sucursal
 * además exige el contrato de sucursal (`branchContract`). Si por lo que sea no queda ninguna,
 * vuelve el retiro: el panel no lo permite, pero un checkout sin salida sería peor.
 */
export function deliveryOptionsFromSettings(
  row: DeliverySettingsRow | null,
  carrierActive: boolean,
  opts: { branchContract?: boolean } = {},
): DeliveryOptions {
  if (!row) return { pickup: true, home: false, branch: false, handlingNote: null };
  const andreani = row.source === "ANDREANI";
  const conCorreo = row.source === "CORREO_ARGENTINO" || andreani;
  const home = row.homeDeliveryEnabled && (!conCorreo || carrierActive || row.tableAsFallback);
  const branch =
    row.branchDeliveryEnabled && conCorreo && carrierActive && (!andreani || opts.branchContract !== false);
  const pickup = row.pickupEnabled || (!home && !branch);
  const handlingNote = row.handlingNote?.trim() ? row.handlingNote.trim() : null;
  return { pickup, home, branch, handlingNote, ...(andreani ? { carrier: "ANDREANI" as const } : {}) };
}

/**
 * Una sucursal tal como la ve el comprador. El código postal es el de la sucursal (dato público
 * del correo) y es el destino con el que se cotiza el envío a sucursal.
 */
export type PublicAgency = { id: string; name: string; address: string; city: string; postalCode: string };

const MAX_AGENCY_CHARS = 200;

function corto(v: string): string {
  return v.trim().slice(0, MAX_AGENCY_CHARS);
}

/**
 * Las sucursales como las ve el comprador: sólo lo que se muestra y el CP, recortadas al largo
 * que acepta `parseCheckoutInput` y sin las que no se podrían elegir ni cotizar (sin id, nombre,
 * dirección o código postal válido).
 */
export function publicAgencies(
  list: readonly { id: string; name: string; address: string; city: string; postalCode: string }[],
): PublicAgency[] {
  const out: PublicAgency[] = [];
  for (const a of list) {
    const id = corto(a.id ?? "");
    const name = corto(a.name ?? "");
    const address = corto(a.address ?? "");
    const postalCode = normalizePostalCode(a.postalCode ?? "");
    if (!id || !name || !address || !postalCode) continue;
    out.push({ id, name, address, city: corto(a.city ?? ""), postalCode });
  }
  return out;
}
