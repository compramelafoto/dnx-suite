import type { CheckoutRegistrationPort } from "../domain/checkout-registration-port";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";
import type { runPaidRegistrationEffects } from "./run-paid-registration-effects";

/**
 * Red de seguridad de cobro: le pregunta al PROVEEDOR si el pago existe y, si
 * está aprobado, confirma la inscripción aunque la reserva ya haya vencido.
 *
 * Por qué existe: hasta ahora lo único que confirmaba un pago era que la
 * persona volviera sola a la pantalla de éxito. El webhook de Mercado Pago se
 * rechazaba por firma y el cron de reconciliación sólo comparaba filas locales
 * entre sí, así que decía "CONSISTENT" con la plata ya cobrada.
 *
 * La reserva de 20 minutos protege CUPO, no cobro. Si hay cupo (o no hay tope),
 * un pago aprobado se confirma. Si el cupo está lleno, no se sobrevende: queda
 * en MANUAL_REVIEW para que una persona decida.
 */

export type RescueOutcome =
  | "ALREADY_CONFIRMED"
  | "NOT_FOUND"
  | "NO_ORDER"
  | "NOT_PAID"
  | "AMOUNT_MISMATCH"
  | "NO_CAPACITY"
  | "RESCUED";

export type RescueResult = {
  outcome: RescueOutcome;
  registrationId: string;
  paymentOrderId: string | null;
  detail?: string;
};

export type RescueDeps = {
  payments: Pick<DnxPaymentsClient, "refreshOrder">;
  registrationPort: Pick<
    CheckoutRegistrationPort,
    | "getRegistration"
    | "getEditionPrefix"
    | "confirmPaid"
    | "markPaymentStatus"
    | "getCapacitySnapshot"
  >;
  /** Inyectable para pruebas; por defecto dispara los efectos reales. */
  runPaidEffects?: typeof runPaidRegistrationEffects;
  log?: (entry: { event: string; registrationId: string; meta?: unknown }) => void;
};

export function createRescueRegistrationPaymentUseCase(deps: RescueDeps) {
  // Import perezoso: los efectos arrastran media app (Prisma, Resend, render de
  // placas). Cargarlos recién al confirmar mantiene este caso de uso probable
  // en aislamiento y evita costo en los ciclos que no rescatan nada.
  const runEffects: typeof runPaidRegistrationEffects =
    deps.runPaidEffects ??
    (async (input) => {
      const mod = await import("./run-paid-registration-effects");
      return mod.runPaidRegistrationEffects(input);
    });

  return {
    async execute(input: {
      registrationId: string;
      editionSlug?: string;
      source?: string;
    }): Promise<RescueResult> {
      const source = input.source ?? "payments_rescue_cron";
      const registration = await deps.registrationPort.getRegistration(
        input.registrationId,
      );
      if (!registration) {
        return {
          outcome: "NOT_FOUND",
          registrationId: input.registrationId,
          paymentOrderId: null,
        };
      }

      const orderId = registration.paymentOrderId;
      if (
        registration.status === "CONFIRMED" &&
        registration.paymentStatus === "APPROVED"
      ) {
        return {
          outcome: "ALREADY_CONFIRMED",
          registrationId: registration.id,
          paymentOrderId: orderId ?? null,
        };
      }
      if (!orderId) {
        return {
          outcome: "NO_ORDER",
          registrationId: registration.id,
          paymentOrderId: null,
        };
      }

      // Acá está el arreglo de fondo: se le PREGUNTA al proveedor.
      const order = await deps.payments.refreshOrder(orderId);
      if (!order || order.status !== "APPROVED") {
        return {
          outcome: "NOT_PAID",
          registrationId: registration.id,
          paymentOrderId: orderId,
          detail: order?.status ?? "sin_orden_en_proveedor",
        };
      }

      // El refresh puede haber confirmado ya la inscripción por sus propios
      // efectos; releer antes de escribir para no duplicar credencial ni correo.
      const despues = await deps.registrationPort.getRegistration(registration.id);
      if (
        despues &&
        despues.status === "CONFIRMED" &&
        despues.paymentStatus === "APPROVED"
      ) {
        return {
          outcome: "ALREADY_CONFIRMED",
          registrationId: registration.id,
          paymentOrderId: orderId,
        };
      }

      const actual = despues ?? registration;

      if (
        order.amountMinor !== actual.money.totalAmount ||
        order.currency !== actual.money.currency
      ) {
        await deps.registrationPort.markPaymentStatus({
          registrationId: actual.id,
          paymentStatus: "MANUAL_REVIEW",
          source,
          reason: "rescue_amount_or_currency_mismatch",
          requestId: `rescue_${orderId}_${Date.now()}`,
        });
        deps.log?.({
          event: "rescue_amount_mismatch",
          registrationId: actual.id,
          meta: {
            cobrado: order.amountMinor,
            esperado: actual.money.totalAmount,
          },
        });
        return {
          outcome: "AMOUNT_MISMATCH",
          registrationId: actual.id,
          paymentOrderId: orderId,
          detail: `cobrado ${order.amountMinor} ${order.currency}, esperado ${actual.money.totalAmount} ${actual.money.currency}`,
        };
      }

      // La reserva protege cupo, no cobro: si hay lugar, se confirma.
      const cupo = await deps.registrationPort.getCapacitySnapshot(actual.id);
      const hayLugar = cupo.capacity == null || cupo.confirmed < cupo.capacity;
      if (!hayLugar) {
        await deps.registrationPort.markPaymentStatus({
          registrationId: actual.id,
          paymentStatus: "MANUAL_REVIEW",
          source,
          reason: "rescue_no_capacity",
          requestId: `rescue_${orderId}_${Date.now()}`,
        });
        deps.log?.({
          event: "rescue_no_capacity",
          registrationId: actual.id,
          meta: cupo,
        });
        return {
          outcome: "NO_CAPACITY",
          registrationId: actual.id,
          paymentOrderId: orderId,
          detail: `cupo ${cupo.confirmed}/${cupo.capacity}`,
        };
      }

      const prefix = await deps.registrationPort.getEditionPrefix(actual.editionId);
      const confirmed = await deps.registrationPort.confirmPaid({
        registrationId: actual.id,
        paymentOrderId: orderId,
        source,
        requestId: `rescue_${orderId}_${Date.now()}`,
        editionPrefix: prefix,
      });

      await runEffects({
        registrationId: confirmed.id,
        editionId: confirmed.editionId,
        userId: confirmed.userId ?? null,
        paymentOrderId: orderId,
        paidAt: confirmed.confirmedAt ?? new Date(),
        source,
        ...(input.editionSlug ? { editionSlug: input.editionSlug } : {}),
        onSoftFail: (code, reason) =>
          deps.log?.({
            event: "rescue_effect_soft_fail",
            registrationId: confirmed.id,
            meta: { code, reason },
          }),
      });

      deps.log?.({
        event: "rescue_confirmed",
        registrationId: confirmed.id,
        meta: { paymentOrderId: orderId, amountMinor: order.amountMinor },
      });

      return {
        outcome: "RESCUED",
        registrationId: confirmed.id,
        paymentOrderId: orderId,
      };
    },
  };
}
