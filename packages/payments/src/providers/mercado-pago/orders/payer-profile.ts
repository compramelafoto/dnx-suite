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
  address?: { zipCode?: string; streetName?: string; streetNumber?: string };
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
  if (zipCode || streetName || streetNumber) {
    payer.address = {
      ...(zipCode ? { zip_code: zipCode } : {}),
      ...(streetName ? { street_name: streetName } : {}),
      ...(streetNumber ? { street_number: streetNumber } : {}),
    };
  }

  return payer;
}

/**
 * La API de Orders **no acepta** `additional_info`: responde
 * `Properties not supported ('$.additional_info' - additionalProperties 'payer'
 * not allowed)` y la orden ni siquiera se crea (verificado el 07/10/2026 contra
 * sandbox MLA).
 *
 * Ese nodo pertenece a la API de Payments (`/v1/payments`), no a Orders. Por eso
 * la identidad y el contacto —incluida la dirección— se envían dentro de `payer`,
 * y los cinco campos de historial (`registration_date`, `is_prime_user`,
 * `is_first_purchase_online`, `authentication_type`, `last_purchase`) quedan sin
 * destino en Orders: se conservan en `OrderPayerProfile` porque el checklist de
 * homologación los pide, pero no hay dónde ponerlos hasta que MP indique el campo.
 *
 * Se mantiene la función devolviendo `undefined` para no romper a quien la
 * importe, y para que el día que exista un destino se cambie en un solo lugar.
 */
export function buildMercadoPagoAdditionalInfoPayer(
  _profile?: OrderPayerProfile,
): Record<string, unknown> | undefined {
  return undefined;
}
