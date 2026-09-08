/**
 * Clave interna del módulo de reservas (registro de módulos + interruptor por workspace).
 * Mismo patrón que members/membership-dues/courses-sales.
 *
 * La clave ya estaba reservada como `PLANNED` en `lib/modules/registry.ts` desde antes de
 * que existiera una línea de código del módulo.
 */
export const BOOKINGS_MODULE_KEY = "bookings";

/**
 * Los estados que OCUPAN el espacio.
 *
 * Es la misma lista que usa la restricción `Booking_sin_solapamiento` de la base. Si las
 * dos se separan, la base y la aplicación empiezan a discrepar sobre qué es "ocupado".
 */
export const ACTIVE_BOOKING_STATUSES = ["HOLD", "PENDING_APPROVAL", "CONFIRMED"] as const;

export type BookingStatus = (typeof ACTIVE_BOOKING_STATUSES)[number] | "CANCELLED" | "EXPIRED";
