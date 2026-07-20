import type { CheckoutObservabilityEvent } from "./types";

export type CheckoutLogSink = (entry: {
  event: CheckoutObservabilityEvent;
  registrationId?: string;
  orderId?: string;
  meta?: Record<string, string | number | boolean | null>;
}) => void;

const PII_KEYS = /email|phone|document|name|token|secret|password|authorization/i;

/** Sink por defecto: console sanitizado (sin PII ni URLs completas). */
export function createCheckoutLogSink(): CheckoutLogSink {
  return (entry) => {
    const meta: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(entry.meta ?? {})) {
      if (PII_KEYS.test(k)) continue;
      if (typeof v === "string" && (v.includes("@") || v.includes("access_token"))) continue;
      if (typeof v === "string" && v.startsWith("http") && v.includes("?")) {
        meta[k] = "[redacted_url]";
        continue;
      }
      meta[k] = v;
    }
    console.info(
      JSON.stringify({
        scope: "clickaton.checkout",
        event: entry.event,
        registrationId: entry.registrationId ?? null,
        orderId: entry.orderId ?? null,
        meta,
      }),
    );
  };
}

export function createMemoryLogSink(buffer: Array<Record<string, unknown>>): CheckoutLogSink {
  return (entry) => {
    buffer.push({
      event: entry.event,
      registrationId: entry.registrationId,
      orderId: entry.orderId,
      meta: entry.meta,
    });
  };
}
