import type { PublicRegistrationRepository } from "@/lib/public-registration/domain/repository";
import { createCheckoutRegistrationPort } from "../domain/checkout-registration-port";
import type { CheckoutLogSink } from "../domain/observability";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";
import type { CheckoutRegistrationMutations } from "../domain/checkout-registration-port";
import { createApplyPaymentEventUseCase } from "./apply-payment-event";
import { createRegistrationCheckoutUseCase } from "./create-registration-checkout";
import { createGetRegistrationPaymentStatusUseCase } from "./get-registration-payment-status";
import { createReconcileRegistrationPaymentUseCase } from "./reconcile-registration-payment";

export function createCheckoutService(deps: {
  publicRepo: PublicRegistrationRepository;
  payments: DnxPaymentsClient;
  mutations: CheckoutRegistrationMutations;
  log?: CheckoutLogSink;
  publicBaseUrl?: string;
}) {
  const registrationPort = createCheckoutRegistrationPort({
    publicRepo: deps.publicRepo,
    mutations: deps.mutations,
  });
  const createCheckout = createRegistrationCheckoutUseCase({
    publicRepo: deps.publicRepo,
    payments: deps.payments,
    registrationPort,
    log: deps.log,
  });
  const applyEvent = createApplyPaymentEventUseCase({
    payments: deps.payments,
    registrationPort,
    log: deps.log,
  });
  const status = createGetRegistrationPaymentStatusUseCase({
    publicRepo: deps.publicRepo,
    payments: deps.payments,
    registrationPort,
  });
  const reconcile = createReconcileRegistrationPaymentUseCase({
    payments: deps.payments,
    registrationPort,
  });

  const defaultBase =
    deps.publicBaseUrl ??
    process.env.CLICKATON_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3005";

  async function routePaymentEffects(
    event: import("../domain/types").NormalizedPaymentEvent,
  ) {
    const { isStoreOrderPaymentSource } = await import(
      "@/lib/public-store/checkout/payment-source"
    );
    // Lazy-load store path only when needed — avoids pulling `server-only`
    // modules into registration selfchecks / non-Next runners.
    if (isStoreOrderPaymentSource(event)) {
      const { applyStorePaymentEvent } = await import(
        "@/lib/public-store/checkout/apply-store-payment-event"
      );
      const store = await applyStorePaymentEvent(event);
      return {
        applied: store.applied,
        duplicate: store.duplicate,
        conflict: store.conflict,
        conflictCode: store.conflictCode,
        registrationId: store.publicId,
        registrationStatus: "PENDING_PAYMENT" as const,
        paymentStatus: "PENDING" as const,
        holdsAction: "none" as const,
        orderStatus: event.status,
      };
    }
    return applyEvent.execute(event);
  }

  return {
    createCheckout(input: {
      registrationId: string;
      editionSlug: string;
      accessToken: string;
      publicBaseUrl?: string;
      now?: Date;
      cardPayment?: import("@repo/payments/frontend").CardPaymentSubmission;
      clientDisplayedAmountMinor?: number;
    }) {
      return createCheckout.execute({
        ...input,
        publicBaseUrl: input.publicBaseUrl ?? defaultBase,
      });
    },
    getPaymentStatus: status.getStatus.bind(status),
    refreshPaymentStatus: status.refreshStatus.bind(status),
    getCheckoutReturn: status.getReturnResult.bind(status),
    applyNormalizedEvent: routePaymentEffects,
    verifyWebhook: deps.payments.verifyWebhook.bind(deps.payments),
    async ingestMercadoPagoWebhook(input: {
      headers: Record<string, string | undefined>;
      rawBody: string;
      queryDataId?: string | null;
      queryType?: string | null;
      queryTopic?: string | null;
    }) {
      if (!deps.payments.ingestMercadoPagoSignedWebhook) {
        return { ok: false as const, code: "WEBHOOK_MP_UNSUPPORTED" };
      }
      const ingested = await deps.payments.ingestMercadoPagoSignedWebhook(input);
      if (!ingested.ok) return ingested;
      // Orders observe: fulfill registration only when event is present (H flag ON).
      if ("observed" in ingested && ingested.observed) {
        const observedEvent = ingested.event;
        if (observedEvent) {
          const effects = await routePaymentEffects(observedEvent);
          return {
            ok: true as const,
            observed: true as const,
            outcome: ingested.outcome,
            mismatchCount: ingested.mismatchCount ?? 0,
            event: observedEvent,
            apply: {
              outcome: effects.duplicate
                ? ("duplicate" as const)
                : effects.conflict
                  ? ("conflict" as const)
                  : ("applied" as const),
              conflictCode: effects.conflictCode,
              effects,
            },
          };
        }
        return {
          ok: true as const,
          observed: true as const,
          outcome: ingested.outcome,
          mismatchCount: ingested.mismatchCount ?? 0,
        };
      }
      if (!("event" in ingested) || !ingested.event) {
        return { ok: false as const, code: "WEBHOOK_INVALID_BODY" };
      }
      // Efectos Clickatón (confirm/holds / TIENDA). Idempotente si S2S ya confirmó.
      const effects = await routePaymentEffects(ingested.event);
      return {
        ok: true as const,
        event: ingested.event,
        apply: {
          outcome: effects.duplicate
            ? ("duplicate" as const)
            : effects.conflict
              ? ("conflict" as const)
              : ("applied" as const),
          conflictCode: effects.conflictCode,
          effects,
        },
      };
    },
    getPaymentOrder: (orderId: string) => deps.payments.getOrder(orderId),
    reconcileRegistration: (registrationId: string) =>
      reconcile.execute({ registrationId }),
  };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;
