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
