import type { PricingApprovalStatus } from "../calculation-contract.js";

/**
 * Resultado interno de pricing en memoria de conversación.
 * Sin breakdown económico. No exponer en HTTP.
 */
export type ConversationPricingResult = {
  status: "READY" | "INCOMPLETE" | "FAILED";
  minimumSustainablePrice?: number;
  recommendedBusinessPrice?: number;
  currency?: string;
  approvalStatus: PricingApprovalStatus;
  profileVersion?: string;
  templateVersion?: string;
  formulaVersion?: string;
  /** Solo códigos/mensajes; sin montos de breakdown. */
  warnings: Array<{ code: string; message: string }>;
};

export type PricingRuntimeExecution = {
  result: ConversationPricingResult;
  cacheKey: string;
  fromCache: boolean;
};
