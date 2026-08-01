/**
 * Narrow re-exports from @repo/payments for the homologation surface.
 * Keeps CLF product checkout away from Orders 1:N imports.
 */
export { money } from "@repo/payments/money";
export { calculateDistribution } from "@repo/payments/distribution";
export {
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  singleIntangibleItem,
} from "@repo/payments/mercado-pago";
export { loadSandboxEnvFromProcess } from "@repo/payments/sandbox";
