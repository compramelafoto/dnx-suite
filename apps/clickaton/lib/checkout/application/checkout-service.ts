import type { PublicRegistrationRepository } from "@/lib/public-registration/domain/repository";
import { createCheckoutRegistrationPort } from "../domain/checkout-registration-port";
import type { CheckoutLogSink } from "../domain/observability";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";
import type { CheckoutRegistrationMutations } from "../domain/checkout-registration-port";
import { createApplyPaymentEventUseCase } from "./apply-payment-event";
import { createRegistrationCheckoutUseCase } from "./create-registration-checkout";
import { createGetRegistrationPaymentStatusUseCase } from "./get-registration-payment-status";

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
  };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;
