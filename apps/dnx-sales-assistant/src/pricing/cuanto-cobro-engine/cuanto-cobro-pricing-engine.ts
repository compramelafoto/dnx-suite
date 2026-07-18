/**
 * Engine offline — llama exclusivamente a calculateCuantoCobro del package compartido.
 * Sin I/O, sin HTTP, sin lectura de configuración.
 */
import { calculateCuantoCobro } from "@repo/cuanto-cobro-core";
import type { CuantoCobroCalculationResult } from "@repo/cuanto-cobro-core";
import type {
  PricingCalculationRequest,
  PricingCalculationResult,
} from "../calculation-contract.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";
import type { PricingEngine } from "../pricing-engine.js";
import { toPublicEngineInput } from "./contract-compatibility.js";
import { mapCuantoCobroResult } from "./map-core-result.js";

export type CalculateCuantoCobroFn = (
  profile: Parameters<typeof calculateCuantoCobro>[0],
  quote: Parameters<typeof calculateCuantoCobro>[1],
) => CuantoCobroCalculationResult;

export type CuantoCobroPricingEngineOptions = {
  calculate?: CalculateCuantoCobroFn;
};

function sanitizeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.trim().slice(0, 200);
    return msg || "Error de ejecución del motor.";
  }
  return "Error de ejecución del motor.";
}

export function createCuantoCobroPricingEngine(
  options: CuantoCobroPricingEngineOptions = {},
): PricingEngine {
  const calculateFn = options.calculate ?? calculateCuantoCobro;

  return {
    async calculate(
      request: PricingCalculationRequest,
    ): Promise<PricingCalculationResult> {
      const inputSnapshot = JSON.stringify(request.input);

      try {
        const publicInput = toPublicEngineInput(request.input);
        const coreResult = calculateFn(publicInput.profile, publicInput.quote);

        if (JSON.stringify(request.input) !== inputSnapshot) {
          return {
            status: "FAILED",
            issues: [
              issue(
                PricingIssueCode.ENGINE_EXECUTION_FAILED,
                "input",
                "ERROR",
                "El input del cálculo fue mutado durante la ejecución.",
              ),
            ],
            approvalStatus: "NOT_REVIEWED",
            profileVersion: request.profileVersion,
            templateVersion: request.templateVersion,
            formulaVersion: request.formulaVersion,
          };
        }

        return mapCuantoCobroResult(coreResult, {
          profileVersion: request.profileVersion,
          templateVersion: request.templateVersion,
          formulaVersion: request.formulaVersion,
          priorWarnings: request.warnings,
        });
      } catch (err) {
        return {
          status: "FAILED",
          issues: [
            issue(
              PricingIssueCode.ENGINE_EXECUTION_FAILED,
              "engine",
              "ERROR",
              sanitizeErrorMessage(err),
            ),
          ],
          approvalStatus: "NOT_REVIEWED",
          profileVersion: request.profileVersion,
          templateVersion: request.templateVersion,
          formulaVersion: request.formulaVersion,
        };
      }
    },
  };
}
