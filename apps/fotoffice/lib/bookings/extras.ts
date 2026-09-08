import { type Interval, overlaps } from "./time";
import type { CustomerType } from "./pricing";

/**
 * Los extras que se alquilan JUNTO con el espacio. Módulo PURO: sin base y sin red.
 *
 * ── Lo que se vende no es lo que existe ──
 *
 * "Flash adicional" y "Pack de 2 flashes" son dos cosas vendibles que salen del mismo par
 * de flashes. Si cada una llevara su propia cuenta, el sistema vendería un suelto y un pack
 * el mismo sábado: tres flashes de los dos que hay.
 *
 * Por eso el stock vive en el RECURSO y cada extra declara cuántas unidades consume. El
 * pack promocional deja de necesitar código: es una fila más.
 *
 * Un extra sin recurso no se controla — el fondo de papel, que hay de sobra. Así
 * "controlar solo algunos" no es una regla aparte.
 */

export type ExtraPriceMode = "PER_BOOKING" | "PER_HOUR";

export type ExtraDefinition = {
  id: string;
  name: string;
  priceMode: ExtraPriceMode;
  memberPriceMinor: number;
  nonMemberPriceMinor: number;
  /** null = no se controla la cantidad. */
  resourceId: string | null;
  unitsConsumed: number;
  requiresConfirmation: boolean;
};

export type ResourceStock = { resourceId: string; quantity: number };

/** Unidades ya apartadas por otra reserva en un rango. */
export type Commitment = { resourceId: string; units: number; range: Interval };

export type ExtraOffer = {
  extra: ExtraDefinition;
  available: boolean;
  /** Unidades libres del recurso en ese rango. null cuando el extra no se controla. */
  unitsFree: number | null;
  amountMinor: number;
};

export function unitsCommitted(
  resourceId: string,
  range: Interval,
  commitments: readonly Commitment[],
): number {
  return commitments
    .filter((c) => c.resourceId === resourceId && overlaps(c.range, range))
    .reduce((total, c) => total + c.units, 0);
}

function precioUnitario(extra: ExtraDefinition, customerType: CustomerType): number {
  return customerType === "MEMBER" ? extra.memberPriceMinor : extra.nonMemberPriceMinor;
}

function importe(extra: ExtraDefinition, customerType: CustomerType, range: Interval): number {
  const unitario = precioUnitario(extra, customerType);
  if (extra.priceMode === "PER_BOOKING") return unitario;
  const minutos = (range.endAt.getTime() - range.startAt.getTime()) / 60_000;
  if (!Number.isFinite(minutos) || minutos <= 0) return 0;
  // Se multiplica antes de dividir, igual que el precio del espacio: dividir primero
  // arrastraría el redondeo a cada minuto.
  return Math.round((unitario * minutos) / 60);
}

/**
 * Qué extras se pueden ofrecer para un rango, y cuánto sale cada uno.
 *
 * **Devuelve también los agotados, marcados.** Esconderlos dejaría a quien reserva sin
 * entender por qué falta algo que vio la semana pasada; verlos agotados le permite mover el
 * horario, que es la decisión que en realidad tiene que tomar.
 */
export function offerExtras(input: {
  extras: readonly ExtraDefinition[];
  stock: readonly ResourceStock[];
  commitments: readonly Commitment[];
  range: Interval;
  customerType: CustomerType;
}): ExtraOffer[] {
  const cantidadPorRecurso = new Map(input.stock.map((s) => [s.resourceId, s.quantity]));

  return input.extras.map((extra) => {
    const amountMinor = importe(extra, input.customerType, input.range);

    if (extra.resourceId === null) {
      return { extra, available: true, unitsFree: null, amountMinor };
    }

    // Un recurso sin stock declarado se trata como agotado, no como ilimitado: falla
    // cerrado, igual que la regla de convivencia entre espacios.
    const total = cantidadPorRecurso.get(extra.resourceId) ?? 0;
    const usadas = unitsCommitted(extra.resourceId, input.range, input.commitments);
    const unitsFree = Math.max(0, total - usadas);

    return { extra, available: unitsFree >= extra.unitsConsumed, unitsFree, amountMinor };
  });
}

/** Solo suma lo elegido Y disponible: un agotado no puede colarse en el total. */
export function extrasTotalMinor(
  offers: readonly ExtraOffer[],
  chosenIds: readonly string[],
): number {
  const elegidos = new Set(chosenIds);
  return offers
    .filter((o) => elegidos.has(o.extra.id) && o.available)
    .reduce((total, o) => total + o.amountMinor, 0);
}

/**
 * ¿Alguno de los elegidos necesita que una persona lo coordine?
 *
 * Si la respuesta es sí, la reserva nace en `PENDING_APPROVAL` y NO se cobra: la Secretaría
 * confirma o quita el extra, y recién ahí sale el enlace de pago con el total definitivo.
 * Reutiliza el mismo estado que ya usa el salón de eventos — sin circuito nuevo.
 */
export function anyRequiresConfirmation(
  offers: readonly ExtraOffer[],
  chosenIds: readonly string[],
): boolean {
  const elegidos = new Set(chosenIds);
  return offers.some(
    (o) => elegidos.has(o.extra.id) && o.available && o.extra.requiresConfirmation,
  );
}
