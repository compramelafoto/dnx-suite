/**
 * Envío del kit a domicilio — reglas puras.
 *
 * Quien no vive en la ciudad de la edición puede pedir que el kit le llegue a
 * su casa y paga un monto fijo por el envío. Hasta la fecha garantizada se le
 * promete que llega antes del evento; después se le sigue vendiendo, avisando
 * que puede no llegar a tiempo (participa igual).
 *
 * No hay integración con ninguna empresa de correo: el despacho es manual y el
 * número de seguimiento se carga a mano en el panel.
 */

import { claveDeLocalidad, normalizarCiudad } from "@/lib/localities/clave";

export type HomeDeliveryConfig = {
  enabled: boolean;
  /** Centavos. */
  feeAmount: number;
  guaranteedUntil: Date | null;
  /** Ciudad de la edición: quien vive ahí retira en la sede. */
  excludedCity: string | null;
  excludedProvince: string | null;
};

/** Lo que ve el asistente de inscripción para ofrecer el envío. */
export type HomeDeliveryOfferDto = {
  feeAmount: number;
  guaranteedUntil: Date | null;
  /** false: después de la fecha garantizada; se avisa que puede no llegar. */
  guaranteedNow: boolean;
  excludedCity: string | null;
};

export type HomeDeliveryAddressInput = {
  recipientName: string;
  documentNumber: string;
  phone: string;
  street: string;
  streetNumber: string;
  floor?: string | null;
  city: string;
  province: string;
  postalCode: string;
  reference?: string | null;
};

export type HomeDeliveryAddress = {
  recipientName: string;
  documentNumber: string;
  phone: string;
  street: string;
  streetNumber: string;
  floor: string | null;
  city: string;
  province: string;
  postalCode: string;
  reference: string | null;
};

/** Lo que se guarda junto con la inscripción. */
export type HomeDeliveryShippingRecord = HomeDeliveryAddress & {
  feeAmount: number;
  guaranteed: boolean;
};

export type HomeDeliveryStatus = "PENDING" | "DISPATCHED" | "RECEIVED" | "RETURNED";

export function homeDeliveryOffer(
  config: HomeDeliveryConfig | null,
  now: Date,
): HomeDeliveryOfferDto | null {
  if (!config || !config.enabled || config.feeAmount <= 0) return null;
  return {
    feeAmount: config.feeAmount,
    guaranteedUntil: config.guaranteedUntil,
    guaranteedNow: isGuaranteed(config, now),
    excludedCity: config.excludedCity,
  };
}

export function isGuaranteed(
  config: Pick<HomeDeliveryConfig, "guaranteedUntil">,
  now: Date,
): boolean {
  if (!config.guaranteedUntil) return true;
  return now.getTime() <= config.guaranteedUntil.getTime();
}

/**
 * ¿La dirección cae en la ciudad de la edición? Compara con la misma
 * normalización que usa la sección Personas, así "ROSARIO (CP 2000)" también
 * cuenta. Si la edición no tiene provincia cargada, alcanza con la ciudad.
 */
export function isInExcludedCity(
  address: { city: string; province: string },
  config: Pick<HomeDeliveryConfig, "excludedCity" | "excludedProvince">,
): boolean {
  if (!config.excludedCity?.trim()) return false;
  if (!config.excludedProvince?.trim()) {
    return normalizarCiudad(address.city) === normalizarCiudad(config.excludedCity);
  }
  return (
    claveDeLocalidad(address.city, address.province) ===
    claveDeLocalidad(config.excludedCity, config.excludedProvince)
  );
}

function texto(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Valida el domicilio. Devuelve los errores por campo, con las mismas claves
 * que el formulario (prefijo `delivery.`), para marcarlos en pantalla.
 */
export function parseHomeDeliveryAddress(
  raw: Partial<Record<keyof HomeDeliveryAddressInput, unknown>>,
): { ok: true; address: HomeDeliveryAddress } | { ok: false; errors: Record<string, string> } {
  const address: HomeDeliveryAddress = {
    recipientName: texto(raw.recipientName, 120),
    documentNumber: texto(raw.documentNumber, 20).replace(/[.\s-]/g, ""),
    phone: texto(raw.phone, 40),
    street: texto(raw.street, 120),
    streetNumber: texto(raw.streetNumber, 20),
    floor: texto(raw.floor, 40) || null,
    city: texto(raw.city, 80),
    province: texto(raw.province, 80),
    postalCode: texto(raw.postalCode, 12).toUpperCase(),
    reference: texto(raw.reference, 200) || null,
  };
  const errors: Record<string, string> = {};
  if (address.recipientName.length < 3) {
    errors["delivery.recipientName"] = "Ingresá quién recibe el kit.";
  }
  if (!/^\d{6,9}$/.test(address.documentNumber)) {
    errors["delivery.documentNumber"] = "Ingresá el DNI de quien recibe (sólo números).";
  }
  if (address.phone.replace(/\D/g, "").length < 8) {
    errors["delivery.phone"] = "Ingresá un teléfono de contacto para el correo.";
  }
  if (address.street.length < 2) errors["delivery.street"] = "Ingresá la calle.";
  if (address.streetNumber.length < 1) {
    errors["delivery.streetNumber"] = "Ingresá la altura (o \"S/N\").";
  }
  if (address.city.length < 2) errors["delivery.city"] = "Ingresá la localidad.";
  if (address.province.length < 2) errors["delivery.province"] = "Ingresá la provincia.";
  // Código postal argentino: 4 dígitos (viejo) o CPA de 8 caracteres (A1234ABC).
  if (!/^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/.test(address.postalCode)) {
    errors["delivery.postalCode"] = "Código postal inválido (ej.: 5000 o X5000ABC).";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, address };
}

export const HOME_DELIVERY_STATUS_LABEL: Record<HomeDeliveryStatus, string> = {
  PENDING: "Por despachar",
  DISPATCHED: "Despachado",
  RECEIVED: "Recibido",
  RETURNED: "Devuelto",
};

export function formatArs(amountMinor: number): string {
  return `$${Math.round(amountMinor / 100).toLocaleString("es-AR")}`;
}
