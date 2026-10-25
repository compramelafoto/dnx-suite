/**
 * Datos ampliados del pagador — señales antifraude de Mercado Pago.
 *
 * El checklist de homologación (ticket IXFS-16376, 2026-09-03) los marca como
 * **Recomendados**: no bloquean la creación de la Order, pero mejoran la tasa
 * de aprobación real. Todos son opcionales y se omiten cuando el producto no
 * los tiene: nunca se inventa un dato para "completar" el payload.
 *
 * Reparto según la API de Orders:
 *   - identidad y contacto   → `payer.*`
 *   - historial y contexto   → `additional_info.payer.*`
 */
import type { MpOrderPayer } from "./contracts.js";

export interface OrderPayerProfile {
  firstName?: string;
  lastName?: string;
  identification?: { type: string; number: string };
  phone?: { areaCode?: string; number?: string };
  address?: {
    zipCode?: string;
    streetName?: string;
    streetNumber?: string;
    neighborhood?: string;
    city?: string;
  };
  /** ISO 8601 — fecha en que el cliente se registró en la plataforma. */
  registrationDate?: string;
  isPrimeUser?: boolean;
  isFirstPurchaseOnline?: boolean;
  /** Cómo se autenticó en la plataforma del seller (p. ej. "Gmail"). */
  authenticationType?: string;
  /** ISO 8601 — última compra del pagador. */
  lastPurchase?: string;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Campos de identidad y contacto que van en `payer`. */
export function buildMercadoPagoPayer(
  email: string,
  profile?: OrderPayerProfile,
): MpOrderPayer {
  const payer: MpOrderPayer = { email };
  if (!profile) return payer;

  const firstName = clean(profile.firstName);
  const lastName = clean(profile.lastName);
  if (firstName) payer.first_name = firstName;
  if (lastName) payer.last_name = lastName;

  const idType = clean(profile.identification?.type);
  const idNumber = clean(profile.identification?.number);
  if (idType && idNumber) {
    payer.identification = { type: idType, number: idNumber };
  }

  const areaCode = clean(profile.phone?.areaCode);
  const phoneNumber = clean(profile.phone?.number);
  if (areaCode || phoneNumber) {
    payer.phone = {
      ...(areaCode ? { area_code: areaCode } : {}),
      ...(phoneNumber ? { number: phoneNumber } : {}),
    };
  }

  const zipCode = clean(profile.address?.zipCode);
  const streetName = clean(profile.address?.streetName);
  const streetNumber = clean(profile.address?.streetNumber);
  const neighborhood = clean(profile.address?.neighborhood);
  const city = clean(profile.address?.city);
  if (zipCode || streetName || streetNumber || neighborhood || city) {
    payer.address = {
      ...(zipCode ? { zip_code: zipCode } : {}),
      ...(streetName ? { street_name: streetName } : {}),
      ...(streetNumber ? { street_number: streetNumber } : {}),
      ...(neighborhood ? { neighborhood } : {}),
      ...(city ? { city } : {}),
    };
  }

  return payer;
}

/**
 * Historial y contexto del pagador para `additional_info`.
 *
 * Mercado Pago lo aclaró el 09/10/2026 (IXFS-16376): el nodo **anidado**
 * `additional_info.payer` pertenece a la API de Payments y Orders lo rechaza
 * con `additionalProperties 'payer' not allowed`. En Orders estos campos van
 * en `additional_info` con **claves planas**, con el prefijo `payer.` dentro
 * del nombre de la clave:
 *
 *     "additional_info": {
 *       "payer.authentication_type": "WEB",
 *       "payer.is_prime_user": true
 *     }
 *
 * La identidad y el contacto —incluida la dirección— siguen yendo en `payer`.
 *
 * Devuelve `undefined` cuando no hay nada que informar, para no agregar un nodo
 * vacío al payload.
 */
export function buildMercadoPagoAdditionalInfoPayer(
  profile?: OrderPayerProfile,
): Record<string, unknown> | undefined {
  if (!profile) return undefined;
  const info: Record<string, unknown> = {};

  const registrationDate = clean(profile.registrationDate);
  if (registrationDate) info["payer.registration_date"] = registrationDate;

  const lastPurchase = clean(profile.lastPurchase);
  if (lastPurchase) info["payer.last_purchase"] = lastPurchase;

  const authenticationType = clean(profile.authenticationType);
  if (authenticationType) info["payer.authentication_type"] = authenticationType;

  if (typeof profile.isPrimeUser === "boolean") {
    info["payer.is_prime_user"] = profile.isPrimeUser;
  }
  if (typeof profile.isFirstPurchaseOnline === "boolean") {
    info["payer.is_first_purchase_online"] = profile.isFirstPurchaseOnline;
  }

  return Object.keys(info).length > 0 ? info : undefined;
}
