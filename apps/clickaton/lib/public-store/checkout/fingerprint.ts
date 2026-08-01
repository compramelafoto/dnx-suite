import { createHash } from "node:crypto";
import type { CreateStoreOrderBody } from "./schema";

/** Fingerprint comercial estable (ítems + montos server + email). */
export function commercialFingerprintFromValidated(input: {
  body: CreateStoreOrderBody;
  lines: Array<{
    productId: string;
    productVariantId: string;
    quantity: number;
    unitPriceAmount: number;
  }>;
  subtotalAmount: number;
  deliveryAmount: number;
  totalAmount: number;
  currency: string;
}): string {
  const stable = {
    email: input.body.customer.email.trim().toLowerCase(),
    deliveryMethod: input.body.deliveryMethod,
    currency: input.currency,
    subtotalAmount: input.subtotalAmount,
    deliveryAmount: input.deliveryAmount,
    totalAmount: input.totalAmount,
    lines: [...input.lines]
      .map((l) => ({
        p: l.productId,
        v: l.productVariantId,
        q: l.quantity,
        u: l.unitPriceAmount,
      }))
      .sort((a, b) => `${a.p}:${a.v}`.localeCompare(`${b.p}:${b.v}`)),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}
