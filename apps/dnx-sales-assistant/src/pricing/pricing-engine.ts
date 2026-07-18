import type {
  PricingCalculationRequest,
  PricingCalculationResult,
} from "./calculation-contract.js";

/**
 * Puerto del motor de precios del asistente.
 * Implementación: `createCuantoCobroPricingEngine` (solo offline / tests).
 */
export type PricingEngine = {
  calculate(request: PricingCalculationRequest): Promise<PricingCalculationResult>;
};
