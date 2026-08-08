import type { DurableDnxPaymentsClient } from "@/lib/checkout/infrastructure/durable-dnx-payments-client";

/**
 * Acceso ops al cliente durable (scripts / cron).
 * No expone tokens; reutiliza el wiring de runtime.
 */
export async function getDurablePaymentsClientForOps(): Promise<
  | { ok: true; client: DurableDnxPaymentsClient }
  | { ok: false; error: string }
> {
  const { buildPaymentsClientForOps } = await import("@/lib/checkout/actions/runtime");
  if (typeof buildPaymentsClientForOps !== "function") {
    return { ok: false, error: "ops_client_unavailable" };
  }
  try {
    const client = buildPaymentsClientForOps();
    return { ok: true, client: client as DurableDnxPaymentsClient };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 120) : "ops_client_failed",
    };
  }
}
