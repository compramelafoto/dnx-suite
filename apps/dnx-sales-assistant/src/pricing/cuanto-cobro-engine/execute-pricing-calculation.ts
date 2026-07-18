import type {
  PricingCalculationRequest,
  PricingCalculationResult,
} from "../calculation-contract.js";
import {
  createCuantoCobroPricingEngine,
  type CuantoCobroPricingEngineOptions,
} from "./cuanto-cobro-pricing-engine.js";

/**
 * Frontera de ejecución aislada (sin I/O).
 * Preferir createCuantoCobroPricingEngine en tests con inyección.
 */
export async function executePricingCalculation(
  request: PricingCalculationRequest,
  options: CuantoCobroPricingEngineOptions = {},
): Promise<PricingCalculationResult> {
  const engine = createCuantoCobroPricingEngine(options);
  return engine.calculate(request);
}
