import { parseQuoteItemHours } from "./quote-items.js";
import type { CuantoCobroClientHoursInput } from "./types.js";
import type { QuoteLaborRates } from "./hourly-rates.js";

export const CLIENT_HOUR_FIELDS = [
  "salesHours",
  "meetingsHours",
  "generalPrepHours",
  "coordinationHours",
  "billingHours",
  "followUpHours",
  "administrativeDeliveryHours",
] as const;

export type ClientHourField = (typeof CLIENT_HOUR_FIELDS)[number];

export const CLIENT_HOUR_LABELS: Record<ClientHourField, string> = {
  salesHours: "Venta",
  meetingsHours: "Reuniones",
  generalPrepHours: "Preparación general",
  coordinationHours: "Coordinación",
  billingHours: "Facturación",
  followUpHours: "Seguimiento",
  administrativeDeliveryHours: "Entrega administrativa",
};

export const CLIENT_HOUR_HINTS: Partial<Record<ClientHourField, string>> = {
  salesHours: "Presupuestación, negociación y cierre comercial de este cliente.",
  meetingsHours: "Reuniones previas o de alineación del trabajo.",
  generalPrepHours: "Planificación general que no pertenece a un producto o servicio puntual.",
  coordinationHours: "Emails, logística y gestión con el cliente.",
  billingHours: "Facturación, cobranza y trámites administrativos.",
  followUpHours: "Seguimiento post-entrega o entre hitos.",
  administrativeDeliveryHours: "Cierre administrativo y entrega formal.",
};

/** Mapeo al mismo motor de tarifas por categoría (sin cambiar fórmulas). */
export const CLIENT_HOUR_RATE_KEY: Record<ClientHourField, keyof QuoteLaborRates> = {
  salesHours: "sales",
  meetingsHours: "administration",
  generalPrepHours: "administration",
  coordinationHours: "administration",
  billingHours: "administration",
  followUpHours: "sales",
  administrativeDeliveryHours: "delivery",
};

export function sumClientHours(hours: CuantoCobroClientHoursInput): number {
  return CLIENT_HOUR_FIELDS.reduce((total, field) => total + parseQuoteItemHours(hours[field]), 0);
}
