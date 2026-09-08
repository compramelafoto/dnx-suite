import "server-only";
import { computeAvailability, type SpaceRules } from "./availability";
import { offerExtras, type ExtraOffer } from "./extras";
import { loadFreeMinutesAvailable, type FreeHoursBalance } from "./free-hours";
import {
  listExtras,
  listResourceCommitments,
  listResources,
  loadAvailabilityContext,
  type SpaceRecord,
} from "./repository";
import type { Interval } from "./time";
import type { CustomerType, Quote } from "./pricing";

/**
 * Lo que necesita la pantalla de reservar: los huecos, la bolsa de horas y los extras.
 *
 * Junta piezas que ya existen y no agrega lógica propia, salvo una regla que sí vive acá y
 * conviene que se lea de una sola vez: cómo se suma el total.
 */

/**
 * El total de una reserva: el espacio más los extras.
 *
 * **Las horas bonificadas cubren el espacio, no los extras.** El socio con dos horas libres
 * en el estudio paga $0 el espacio y sí paga la máquina de humo. Bonificar el espacio es el
 * beneficio que da la cuota; regalar el equipamiento no se decidió nunca.
 *
 * Parte PURA.
 */
export function totalForBooking(input: { quote: Quote; extrasMinor: number }): number {
  const extras =
    Number.isFinite(input.extrasMinor) && input.extrasMinor > 0
      ? Math.floor(input.extrasMinor)
      : 0;
  return input.quote.totalMinor + extras;
}

export type PortalBookingOffer = {
  space: SpaceRecord;
  rules: SpaceRules;
  slots: Interval[];
  freeHours: FreeHoursBalance;
  extras: ExtraOffer[];
};

/**
 * Todo lo que la pantalla muestra para un espacio y una ventana.
 *
 * Devuelve `null` si el espacio no existe o está desactivado — nunca lanza por eso: pasa
 * con una URL vieja, no es una falla del sistema.
 *
 * Ojo: los extras se calculan para el rango PEDIDO. Un extra puede estar disponible a las
 * 14 y agotado a las 16, así que la oferta cambia cuando la persona mueve el horario.
 */
export async function loadPortalOffer(input: {
  workspaceId: string;
  memberId: string | null;
  spaceId: string;
  range: Interval;
  customerType: CustomerType;
  now?: Date;
}): Promise<PortalBookingOffer | null> {
  const now = input.now ?? new Date();

  const contexto = await loadAvailabilityContext(
    input.workspaceId,
    input.spaceId,
    input.range,
    now,
  );
  if (!contexto) return null;

  const { getSpace } = await import("./repository");
  const space = await getSpace(input.workspaceId, input.spaceId);
  if (!space || !space.active) return null;

  const [extrasDelEspacio, recursos, comprometidas] = await Promise.all([
    listExtras(input.workspaceId, { spaceId: input.spaceId, onlyActive: true }),
    listResources(input.workspaceId),
    listResourceCommitments(input.workspaceId, input.range),
  ]);

  const freeHours =
    input.memberId !== null && input.customerType === "MEMBER"
      ? await loadFreeMinutesAvailable({
          workspaceId: input.workspaceId,
          memberId: input.memberId,
          spaceId: input.spaceId,
          grantedHoursPerMonth: space.memberFreeHoursPerMonth,
          at: now,
        })
      : { grantedMinutes: 0, usedMinutes: 0, availableMinutes: 0, monthKey: "" };

  return {
    space,
    rules: space.rules,
    slots: computeAvailability({ ...contexto, range: input.range }),
    freeHours,
    extras: offerExtras({
      extras: extrasDelEspacio,
      stock: recursos.map((r) => ({ resourceId: r.id, quantity: r.quantity })),
      commitments: comprometidas,
      range: input.range,
      customerType: input.customerType,
    }),
  };
}
