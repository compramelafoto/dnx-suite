import { fechaHoraBA } from "@/lib/ficha/formato";
import { orderShippingView } from "../shipping/order-destination";

/**
 * La planilla de pedidos para el productor (dropshipping), en CSV. Módulo PURO.
 *
 * Una fila por línea del pedido (una prenda con su cantidad). Las primeras ocho columnas son las
 * que pidió el productor, en ese orden; las demás le sirven para despachar sin preguntar.
 *
 * Se abre en Google Sheets (`=IMPORTDATA(...)`): una celda que empieza con `=`, `+`, `-` o `@` se
 * tomaría como fórmula. Lo escribe el comprador (nombre, dirección), así que se neutraliza con
 * una comilla simple adelante.
 */

export const FEED_COLUMNS = [
  "Id del pedido",
  "Número de pedido",
  "Sku",
  "Nombre de la prenda",
  "Cantidad",
  "Talle",
  "Link del drive",
  "Etiqueta de envío",
  "Boceto",
  "Fecha de pago",
  "Cliente",
  "Teléfono",
  "Entrega",
  "Dirección",
  "Estado",
] as const;

export type FeedItem = {
  sku: string | null;
  productName: string;
  variantName: string | null;
  qty: number;
  printFileUrl: string | null;
  imageUrl: string | null;
  fulfillmentSentAt: Date | null;
  order: {
    publicId: string;
    orderNumber: number;
    paidAt: Date | null;
    buyerName: string;
    buyerPhone: string | null;
    deliveryMethod: string;
    shippingMethod: string | null;
    shippingAddressJson: unknown;
    shippingAgencyJson: unknown;
    trackingNumber: string | null;
  };
};

const SEPARADOR_TALLE = " / ";

/**
 * El nombre del talle viene armado como "<modelo> / <talle>" ("Oversize negra / M"). Sin
 * separador, el nombre entero es el talle.
 */
export function splitVariantName(variantName: string | null): { model: string | null; size: string } {
  const v = (variantName ?? "").trim();
  if (v === "") return { model: null, size: "" };
  const i = v.indexOf(SEPARADOR_TALLE);
  if (i === -1) return { model: null, size: v };
  const model = v.slice(0, i).trim();
  return { model: model || null, size: v.slice(i + SEPARADOR_TALLE.length).trim() };
}

/** "Camera Flag — Oversize negra". */
export function garmentName(productName: string, variantName: string | null): string {
  const { model } = splitVariantName(variantName);
  return model ? `${productName} — ${model}` : productName;
}

/** Cómo se entrega, en una frase. */
export function deliveryLabel(order: FeedItem["order"], pickupAddress: string | null): string {
  if (order.deliveryMethod !== "SHIPPING") {
    const lugar = pickupAddress?.trim();
    return lugar ? `Retiro en ${lugar}` : "Retiro en el local";
  }
  return order.shippingMethod === "BRANCH" ? "Envío a sucursal" : "Envío a domicilio";
}

/** La dirección de entrega en una sola celda; vacía si se retira. */
export function deliveryAddress(order: FeedItem["order"]): string {
  const vista = orderShippingView(order);
  return vista ? vista.lines.join(" · ") : "";
}

export function feedRow(item: FeedItem, pickupAddress: string | null): string[] {
  const o = item.order;
  return [
    o.publicId,
    String(o.orderNumber),
    item.sku ?? "",
    garmentName(item.productName, item.variantName),
    String(item.qty),
    splitVariantName(item.variantName).size,
    item.printFileUrl ?? "",
    o.trackingNumber ?? "",
    item.imageUrl ?? "",
    o.paidAt ? fechaHoraBA(o.paidAt) : "",
    o.buyerName,
    o.buyerPhone ?? "",
    deliveryLabel(o, pickupAddress),
    deliveryAddress(o),
    item.fulfillmentSentAt ? "Pasado al productor" : "Pendiente",
  ];
}

const PELIGROSOS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** Una celda segura para una planilla y escapada según RFC 4180. */
export function csvCell(valor: string): string {
  let v = valor;
  if (v !== "" && PELIGROSOS.has(v[0]!)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function buildFulfillmentCsv(items: readonly FeedItem[], pickupAddress: string | null): string {
  return toCsv([[...FEED_COLUMNS], ...items.map((i) => feedRow(i, pickupAddress))]);
}
