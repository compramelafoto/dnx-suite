/**
 * Public SDK surface for product apps (Etapa 03+).
 * Etapa 02: type-only facade re-exporting domain contracts.
 */
export type {
  CreatePaymentIntentCommand,
  CalculateDistributionCommand,
  SubmitPaymentIntentCommand,
  ProcessProviderWebhookCommand,
  RequestRefundCommand,
} from "../contracts/commands.js";

export type { PaymentIntent, PaymentOrder, DistributionPlan } from "../contracts/entities.js";
