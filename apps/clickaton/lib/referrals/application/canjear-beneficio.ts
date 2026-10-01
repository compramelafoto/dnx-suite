import {
  elegirMejorDescuento,
  type EleccionDescuento,
} from "../domain/elegir-mejor-descuento";
import type { ReferralRepository } from "../domain/repository";

export type ReservaBeneficio = EleccionDescuento & {
  /** Atribuciones efectivamente tomadas. 0 si ganó el cupón o no había. */
  colegasReservados: number;
};

/**
 * Decide el descuento de una inscripción y, si gana el beneficio por
 * referidos, toma los colegas que lo justifican.
 *
 * Sigue el mismo ciclo que el cupón — reservar al inscribir, confirmar al
 * pagar, liberar si vence — para que un carrito abandonado no le queme a nadie
 * los colegas que trajo.
 */
export async function reservarBeneficio(
  repo: ReferralRepository,
  input: {
    userId: number | null;
    montoOriginal: number;
    cupon: { descuento: number } | null;
    /** `idem:<clave>` al inscribir; el id real cuando ya existe. */
    ref: string;
  },
): Promise<ReservaBeneficio> {
  // Quien se inscribe como invitado, sin cuenta, no tiene colegas contados.
  const colegas = input.userId == null ? 0 : await repo.contarColegasTraidos(input.userId);

  const eleccion = elegirMejorDescuento({
    montoOriginal: input.montoOriginal,
    colegas,
    cupon: input.cupon,
  });

  if (!eleccion.consumeReferidos || input.userId == null) {
    return { ...eleccion, colegasReservados: 0 };
  }

  const reservados = await repo.reservarAtribuciones({
    referrerUserId: input.userId,
    cantidad: eleccion.colegasConsumidos,
    ref: input.ref,
  });

  // Carrera: otra inscripción se llevó parte de los colegas entre el conteo y
  // la reserva. Se recalcula con lo que realmente quedó, para no cobrar de
  // menos por un descuento que no se pudo respaldar.
  if (reservados !== eleccion.colegasConsumidos) {
    const real = elegirMejorDescuento({
      montoOriginal: input.montoOriginal,
      colegas: reservados,
      cupon: input.cupon,
    });
    return { ...real, colegasReservados: reservados };
  }

  return { ...eleccion, colegasReservados: reservados };
}

/**
 * Mueve la reserva de la clave de idempotencia al id de la inscripción, una
 * vez que ésta existe. Hasta que esto corra, la reserva no se puede confirmar
 * ni liberar por inscripción.
 */
export async function adjuntarReservaAInscripcion(
  repo: ReferralRepository,
  input: { ref: string; registrationId: string },
): Promise<{ adjuntados: number }> {
  if (input.ref === input.registrationId) return { adjuntados: 0 };
  const adjuntados = await repo.adjuntarReserva(input);
  return { adjuntados };
}

/** El pago entró: la reserva pasa a consumo definitivo. */
export async function confirmarCanje(
  repo: ReferralRepository,
  input: { registrationId: string },
): Promise<{ consumidos: number }> {
  const consumidos = await repo.confirmarAtribucionesReservadas(input.registrationId);
  return { consumidos };
}

/** La reserva venció o se anuló: los colegas vuelven a estar disponibles. */
export async function liberarCanje(
  repo: ReferralRepository,
  input: { registrationId: string },
): Promise<{ liberados: number }> {
  const liberados = await repo.liberarAtribucionesReservadas(input.registrationId);
  return { liberados };
}
