import type { NormalizedPaymentEvent } from "@/lib/checkout/domain/types";

export function isStoreOrderPaymentSource(event: NormalizedPaymentEvent): boolean {
  const ref = event.externalReference ?? "";
  return (
    ref.startsWith("CLICKATON_STORE_ORDER:") ||
    ref.startsWith("CLICKATON_STORE_ORDER-") ||
    event.sourceId.startsWith("sto_")
  );
}
