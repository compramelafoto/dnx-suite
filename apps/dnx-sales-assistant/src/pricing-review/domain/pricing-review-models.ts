export type PricingReviewStatus =
  | "READY"
  | "INCOMPLETE"
  | "FAILED"
  | "NOT_CONFIGURED";

export type PricingDataOrigin =
  | "PHOTOGRAPHER"
  | "PROFILE"
  | "DEFAULT"
  | "INFERENCE"
  | "MISSING";

export type PricingInputFieldSummary = {
  code: string;
  label: string;
  valueDescription: string;
  origin: PricingDataOrigin;
};

export type PricingInputSummary = {
  fields: PricingInputFieldSummary[];
};

export type PricingAssumption = {
  code: string;
  label: string;
  valueDescription: string;
  source: "DEFAULT" | "PROFILE" | "INFERENCE";
  canChangeResult: boolean;
};

export type PricingMissingInformation = {
  code: string;
  label: string;
  whyNeeded: string;
  expectedOrigin: "CONVERSATION" | "PROFILE";
  action: string;
};

export type PricingReviewComponent = {
  code: string;
  name: string;
  origin: PricingDataOrigin;
  status: "INCLUDED" | "NOT_APPLICABLE" | "UNKNOWN";
  impact: "HIGH" | "MEDIUM" | "LOW" | "INFO";
  explanation: string;
  warnings: string[];
};

export type PricingReviewWarning = {
  code: string;
  message: string;
  severity: "INFO" | "WARNING" | "ERROR";
};

export type PricingReviewResult = {
  status: PricingReviewStatus;
  calculationVersion?: string;
  explanationVersion: "dani-pricing-explanation-v1";
  inputSummary: PricingInputSummary;
  assumptions: PricingAssumption[];
  missingInformation: PricingMissingInformation[];
  result?: {
    minimumSustainable: number;
    recommendedPrice: number;
    commercialFactor: number;
    currency: string;
  };
  components: PricingReviewComponent[];
  warnings: PricingReviewWarning[];
  explanationStructured: string;
  explanationDani: string;
  /** Solo laboratorio: false por defecto en UI. */
  amountsVisible: boolean;
};

export type PricingExplanationReviewVerdict =
  | "APPROVED"
  | "NEEDS_ADJUSTMENT"
  | "INCORRECT";

export type PricingExplanationReviewCode =
  | "PRICING_EXPLANATION_TOO_TECHNICAL"
  | "PRICING_EXPLANATION_TOO_LONG"
  | "PRICING_EXPLANATION_UNCLEAR"
  | "PRICING_EXPLANATION_MISSING_COMPONENT"
  | "PRICING_EXPLANATION_WRONG_ASSUMPTION"
  | "PRICING_EXPLANATION_MINIMUM_UNCLEAR"
  | "PRICING_EXPLANATION_RECOMMENDED_UNCLEAR"
  | "PRICING_EXPLANATION_OTHER";

export type HumanPricingExplanationReview = {
  sessionId: string;
  verdict: PricingExplanationReviewVerdict;
  code?: PricingExplanationReviewCode;
  note?: string;
  explanationVersion: string;
  createdAt: string;
};
