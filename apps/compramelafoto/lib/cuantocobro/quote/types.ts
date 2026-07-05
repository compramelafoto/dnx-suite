import type { CuantoCobroQuoteStatus } from "@prisma/client";
import type { CuantoCobroCalculationResult, CuantoCobroProfileInput, CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";
import type { CuantoCobroPaymentOptionsSnapshot } from "@/lib/cuantocobro/payment/payment-options-types";

export const CUANTO_COBRO_QUOTE_SCHEMA_VERSION = 1;

export { CC_QUOTE_STATUS_LABELS } from "@/lib/cuantocobro/quote/quote-status-labels";

export type CuantoCobroQuoteSummaryDto = {
  id: number;
  quoteNumber: string;
  currentVersionNumber: number;
  acceptedVersionId: number | null;
  status: CuantoCobroQuoteStatus;
  currency: string;
  chosenPriceCents: number | null;
  recommendedPriceCents: number | null;
  minimumPriceCents: number | null;
  clientDisplayName: string;
  clientCompany: string;
  jobType: string;
  jobDate: string | null;
  consultaId: number | null;
  consultaNumber: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CuantoCobroQuoteListItemDto = CuantoCobroQuoteSummaryDto;

export type CuantoCobroQuoteVersionSummaryDto = {
  id: number;
  versionNumber: number;
  isCurrent: boolean;
  status: CuantoCobroQuoteStatus;
  currency: string;
  chosenPriceCents: number | null;
  recommendedPriceCents: number | null;
  minimumPriceCents: number | null;
  comment: string;
  createdByUserId: number;
  createdByName: string | null;
  createdAt: string;
  sentAt: string | null;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  isImmutable: boolean;
};

export type CuantoCobroQuoteVersionDetailDto = CuantoCobroQuoteVersionSummaryDto & {
  quote: CuantoCobroQuoteInput;
  profileSnapshot: CuantoCobroProfileInput;
  calculationSnapshot: unknown;
  paymentOptionsSnapshot: unknown | null;
  businessProfileSnapshot: unknown | null;
};

export type CuantoCobroQuoteDetailDto = CuantoCobroQuoteSummaryDto & {
  quote: CuantoCobroQuoteInput;
  profileSnapshot: CuantoCobroProfileInput | null;
  calculationSnapshot: unknown | null;
  paymentOptionsSnapshot: unknown | null;
  /** Perfil comercial de la versión actual, enriquecido con branding del fotógrafo cuando falta. */
  businessProfileSnapshot?: unknown | null;
  versions: CuantoCobroQuoteVersionSummaryDto[];
};

export type CreateCuantoCobroQuoteInput = {
  quote: CuantoCobroQuoteInput;
  consultaId?: number | null;
  /** Si está definido, crea una nueva versión sobre el expediente existente (no un CC nuevo). */
  quoteExpedienteId?: number | null;
  profile?: CuantoCobroProfileInput;
  calculationSnapshot?: CuantoCobroCalculationResult | unknown;
  versionComment?: string;
  currency?: string;
  chosenPriceCents?: number | null;
  recommendedPriceCents?: number | null;
  minimumPriceCents?: number | null;
  paymentOptionsSnapshot?: CuantoCobroPaymentOptionsSnapshot | Record<string, unknown> | null;
  businessProfileSnapshot?: Record<string, unknown> | null;
};

export type CreateCuantoCobroQuoteResult = CuantoCobroQuoteSummaryDto;

export type ListQuotesParams = {
  userId: number;
  cursor?: string | null;
  limit?: number;
  search?: string | null;
  status?: string | null;
  jobDateFrom?: string | null;
  jobDateTo?: string | null;
  hasConsulta?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  includeArchived?: boolean;
};

export type ListQuotesResult = {
  items: CuantoCobroQuoteListItemDto[];
  nextCursor: string | null;
};
