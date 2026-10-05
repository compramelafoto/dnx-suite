import { PROVINCES } from "./provinces";

/**
 * A dónde va un pedido con envío, en renglones para mostrar (página del pedido y correos).
 * Módulo PURO. Lee los JSON que guardó `createStoreOrder`; si algo falta, muestra lo que hay.
 */

export type OrderShippingFields = {
  deliveryMethod: string;
  shippingMethod: string | null;
  shippingAddressJson: unknown;
  shippingAgencyJson: unknown;
};

export type OrderShippingView = { label: string; lines: string[] };

function texto(json: unknown, key: string): string {
  if (typeof json !== "object" || json === null) return "";
  const v = (json as Record<string, unknown>)[key];
  return typeof v === "string" ? v.trim() : "";
}

function localidad(json: unknown): string {
  const city = texto(json, "city");
  const code = texto(json, "provinceCode");
  const provincia = PROVINCES.find((p) => p.code === code)?.name ?? "";
  const cp = texto(json, "postalCode");
  const lugar = [city, provincia].filter(Boolean).join(", ");
  return [lugar, cp ? `(CP ${cp})` : ""].filter(Boolean).join(" ");
}

export function orderShippingView(o: OrderShippingFields): OrderShippingView | null {
  if (o.deliveryMethod !== "SHIPPING") return null;
  if (o.shippingMethod === "BRANCH") {
    const a = o.shippingAgencyJson;
    return {
      label: "Envío a sucursal",
      lines: [texto(a, "name"), texto(a, "address"), localidad(a)].filter(Boolean),
    };
  }
  const d = o.shippingAddressJson;
  const calle = [texto(d, "street"), texto(d, "number")].filter(Boolean).join(" ");
  const piso = texto(d, "floorApt");
  const recibe = [texto(d, "recipientName"), texto(d, "recipientPhone")].filter(Boolean).join(" · ");
  return {
    label: "Envío a domicilio",
    lines: [[calle, piso].filter(Boolean).join(", "), localidad(d), recibe ? `Recibe: ${recibe}` : ""].filter(Boolean),
  };
}

export type OrderQuoteSummary = { sourceLabel: string | null; serviceName: string | null; packageLine: string | null };

function entero(json: unknown, key: string): number | null {
  if (typeof json !== "object" || json === null) return null;
  const v = (json as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const FUENTE: Record<string, string> = {
  CORREO_ARGENTINO: "Correo Argentino (cotización en el momento)",
  ANDREANI: "Andreani (cotización en el momento)",
  TABLE: "Tabla de precios propia",
};

/**
 * De dónde salió el precio del envío y qué paquete se cotizó, para el PANEL del personal (lee
 * `shippingQuoteJson`, que nunca va al comprador). `null` si el pedido no tiene cotización.
 */
export function orderQuoteSummary(json: unknown): OrderQuoteSummary | null {
  if (typeof json !== "object" || json === null) return null;
  const pkg = (json as Record<string, unknown>).package;
  const peso = entero(pkg, "weightGrams");
  const [l, a, h] = [entero(pkg, "lengthCm"), entero(pkg, "widthCm"), entero(pkg, "heightCm")];
  const partes = [peso !== null ? `${peso} g` : "", l !== null && a !== null && h !== null ? `${l} × ${a} × ${h} cm` : ""];
  const fuente = texto(json, "source");
  return {
    sourceLabel: FUENTE[fuente] ?? (fuente || null),
    serviceName: texto(json, "serviceName") || null,
    packageLine: partes.filter(Boolean).join(" · ") || null,
  };
}
