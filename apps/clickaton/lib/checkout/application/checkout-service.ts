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

  return {
    createCheckout(input: {
      registrationId: string;
      editionSlug: string;
      accessToken: string;
      publicBaseUrl?: string;
      now?: Date;
    }) {
      return createCheckout.execute({
        ...input,
        publicBaseUrl: input.publicBaseUrl ?? defaultBase,
      });
    },
    getPaymentStatus: status.getStatus.bind(status),
    refreshPaymentStatus: status.refreshStatus.bind(status),
    getCheckoutReturn: status.getReturnResult.bind(status),
    applyNormalizedEvent: applyEvent.execute.bind(applyEvent),
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
        if ("event" in ingested && ingested.event) {
          const effects = await applyEvent.execute(ingested.event);
          return {
            ok: true as const,
            observed: true as const,
            outcome: ingested.outcome,
            mismatchCount: ingested.mismatchCount ?? 0,
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
        }
        return {
          ok: true as const,
          observed: true as const,
          outcome: ingested.outcome,
          mismatchCount: ingested.mismatchCount ?? 0,
        };
      }
      if (!("event" in ingested)) {
        return { ok: false as const, code: "WEBHOOK_INVALID_BODY" };
      }
      // Efectos Clickatón (confirm/holds). Idempotente si S2S ya confirmó.
      const effects = await applyEvent.execute(ingested.event);
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
