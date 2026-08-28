/**
 * Cupo, disponibilidad y reserva del inventario publicitario.
 *
 * Entre que se arma una propuesta y el cliente responde pasan días. Sin un
 * estado de reserva con vencimiento, dos vendedores prometen el mismo lugar el
 * mismo día y uno de los dos queda mal con su cliente.
 *
 * Sin base de datos: recibe las ocupaciones ya cargadas y calcula. La garantía
 * real contra el doble booking no vive acá sino en la restricción de exclusión
 * de Postgres — un control en la aplicación no alcanza cuando dos transacciones
 * confirman el último lugar al mismo tiempo.
 */
import { AD_PLACEMENT_CATALOG, type DnxPartnerAdPlacementKey } from "./campaigns";

/** Días corridos que dura una reserva. Un administrador puede extenderla. */
export const RESERVATION_DAYS = 10;

export const DNX_PARTNER_BOOKING_STATUSES = [
  "DRAFT",
  "RESERVED",
  "SOLD",
  "CANCELLED",
] as const;
export type DnxPartnerBookingStatus = (typeof DNX_PARTNER_BOOKING_STATUSES)[number];

/** Los únicos estados que ocupan un lugar. Un borrador no ocupa nada. */
export const BOOKING_OCCUPYING_STATUSES = ["RESERVED", "SOLD"] as const;

export type InventoryRange = {
  startsAt: Date;
  endsAt: Date;
};

export type InventoryBooking = {
  placementKey: DnxPartnerAdPlacementKey;
  /** La edición, el concurso o el álbum. Null en los espacios globales. */
  contextId: string | null;
  slotIndex: number;
  status: DnxPartnerBookingStatus;
  startsAt: Date;
  endsAt: Date;
  /** Solo con `RESERVED`. */
  reservationExpiresAt: Date | null;
};

export type InventoryAvailability = {
  capacity: number;
  taken: number;
  free: number;
  /** Lugar libre más bajo, o null si no hay. */
  slotIndex: number | null;
  /** Cuándo se libera el primero. Null cuando hay lugar. */
  nextFreeAt: Date | null;
};

/**
 * Dos períodos se pisan.
 *
 * Semántica `[)`: el que termina el 1 de marzo y el que arranca el 1 de marzo
 * **no** se pisan. Es la misma que usa la restricción en la base.
 */
export function rangesOverlap(a: InventoryRange, b: InventoryRange): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

/**
 * Cuándo deja de ocupar esta ocupación.
 *
 * Una reserva se libera al vencer, aunque su período siga corriendo.
 */
export function bookingFreesAt(booking: InventoryBooking): Date {
  if (booking.status === "RESERVED" && booking.reservationExpiresAt) {
    return booking.reservationExpiresAt.getTime() < booking.endsAt.getTime()
      ? booking.reservationExpiresAt
      : booking.endsAt;
  }
  return booking.endsAt;
}

/**
 * Si esta ocupación toma un lugar ahora.
 *
 * Una reserva vencida deja de tomarlo de inmediato, aunque en la base siga
 * figurando como `RESERVED` hasta que pase el barrido. La diferencia solo puede
 * fallar hacia el lado seguro: nunca sobrevende.
 */
export function isBookingOccupying(booking: InventoryBooking, now: Date): boolean {
  if (!(BOOKING_OCCUPYING_STATUSES as readonly string[]).includes(booking.status)) {
    return false;
  }
  if (
    booking.status === "RESERVED" &&
    booking.reservationExpiresAt &&
    booking.reservationExpiresAt.getTime() <= now.getTime()
  ) {
    return false;
  }
  return true;
}

/** Cuándo vence una reserva tomada ahora. */
export function reservationExpiryFrom(now: Date, days: number = RESERVATION_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Cuántas marcas entran a la vez, según el catálogo técnico. */
export function resolveInventoryCapacity(placementKey: DnxPartnerAdPlacementKey): number {
  const entry = AD_PLACEMENT_CATALOG.find((e) => e.placementKey === placementKey);
  return entry?.maxItems ?? 0;
}

/**
 * Qué lugar hay para vender este espacio, en este contexto, en este período.
 *
 * `taken` y `free` se cuentan sobre los lugares del cupo: `slotIndex` es la
 * autoridad sobre si se puede vender.
 *
 * `nextFreeAt` es información de venta además de un dato técnico — «se libera el
 * 1 de marzo, ¿te lo reservo?».
 */
export function resolveInventoryAvailability(input: {
  placementKey: DnxPartnerAdPlacementKey;
  contextId: string | null;
  range: InventoryRange;
  bookings: readonly InventoryBooking[];
  now: Date;
  /** Cupo comercial. Por defecto, el del catálogo. */
  capacity?: number;
}): InventoryAvailability {
  const capacity = input.capacity ?? resolveInventoryCapacity(input.placementKey);

  const bloquean = input.bookings.filter(
    (b) =>
      b.placementKey === input.placementKey &&
      (b.contextId ?? null) === (input.contextId ?? null) &&
      isBookingOccupying(b, input.now) &&
      rangesOverlap(b, input.range),
  );

  const ocupados = new Set(bloquean.map((b) => b.slotIndex));

  let slotIndex: number | null = null;
  let free = 0;
  for (let i = 0; i < capacity; i += 1) {
    if (ocupados.has(i)) continue;
    free += 1;
    if (slotIndex === null) slotIndex = i;
  }

  const nextFreeAt =
    slotIndex === null && bloquean.length > 0
      ? bloquean
          .map(bookingFreesAt)
          .reduce((a, b) => (a.getTime() <= b.getTime() ? a : b))
      : null;

  return { capacity, taken: capacity - free, free, slotIndex, nextFreeAt };
}

/**
 * Suma meses cuidando el desborde de día.
 *
 * El 31 de enero más un mes es el 28 de febrero, no el 3 de marzo. Sin este
 * cuidado, una propuesta armada a fin de mes vendería días que nadie pidió.
 */
function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const ultimoDiaDelDestino = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      y,
      m + months,
      Math.min(d, ultimoDiaDelDestino),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/**
 * El período que cubre una propuesta.
 *
 * La unidad es el mes: los espacios globales de plataforma son presencia
 * continua y se renuevan. Siempre queda expresado como fecha de inicio y de fin,
 * porque es lo que la ocupación necesita para no bloquear un lugar para siempre.
 */
export function defaultProposalPeriod(from: Date, months = 1): InventoryRange {
  return { startsAt: from, endsAt: addMonths(from, months) };
}
