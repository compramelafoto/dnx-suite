/**
 * Puente tipado asistente → @repo/cuanto-cobro-core.
 *
 * Solo transformación estructural / identidad tipada.
 * Sin fórmulas, sin cálculo, sin side effects.
 * No usar desde el pipeline HTTP.
 */
import type {
  CuantoCobroProfileInput,
  CuantoCobroQuoteInput,
} from "@repo/cuanto-cobro-core";
import type {
  CuantoCobroCompatibleProfile,
  CuantoCobroCompatibleQuote,
} from "../cuanto-cobro-adapter/compatible-models.js";

/**
 * CompatibleProfile → tipo público del package.
 * Las formas coinciden; se usa asignación tipada (sin mutación).
 */
export function toCuantoCobroProfileInput(
  profile: CuantoCobroCompatibleProfile,
): CuantoCobroProfileInput {
  return profile as CuantoCobroProfileInput;
}

/**
 * CompatibleQuote → tipo público del package.
 */
export function toCuantoCobroQuoteInput(
  quote: CuantoCobroCompatibleQuote,
): CuantoCobroQuoteInput {
  return quote as CuantoCobroQuoteInput;
}

export type PublicEngineInput = {
  profile: CuantoCobroProfileInput;
  quote: CuantoCobroQuoteInput;
};

/** Empaqueta el DTO compatible como input público del core (sin ejecutar motor). */
export function toPublicEngineInput(input: {
  profile: CuantoCobroCompatibleProfile;
  quote: CuantoCobroCompatibleQuote;
}): PublicEngineInput {
  return {
    profile: toCuantoCobroProfileInput(input.profile),
    quote: toCuantoCobroQuoteInput(input.quote),
  };
}
