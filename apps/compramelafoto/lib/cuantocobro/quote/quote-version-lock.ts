import type { CuantoCobroQuoteStatus } from "@prisma/client";

export type QuoteVersionDeliveryFields = {
  status: CuantoCobroQuoteStatus;
  firstViewedAt: Date | null;
  sentAt: Date | null;
};

export function isQuoteVersionViewedByClient(version: Pick<QuoteVersionDeliveryFields, "firstViewedAt">): boolean {
  return version.firstViewedAt != null;
}

export function isQuoteVersionImmutable(version: Pick<QuoteVersionDeliveryFields, "firstViewedAt">): boolean {
  return isQuoteVersionViewedByClient(version);
}

export function canTransitionQuoteStatusOnView(current: CuantoCobroQuoteStatus): boolean {
  return current !== "ACCEPTED" && current !== "REJECTED";
}

export function quoteStatusAfterClientView(current: CuantoCobroQuoteStatus): CuantoCobroQuoteStatus {
  if (!canTransitionQuoteStatusOnView(current)) return current;
  return "VIEWED";
}

export function assertQuoteVersionEditable(version: Pick<QuoteVersionDeliveryFields, "firstViewedAt">): void {
  if (isQuoteVersionImmutable(version)) {
    throw new Error(
      "Esta versión ya fue vista por el cliente. Para cambiarla, creá una nueva versión.",
    );
  }
}
