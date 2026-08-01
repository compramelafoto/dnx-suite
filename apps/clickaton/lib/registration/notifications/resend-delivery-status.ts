/**
 * Clasificación operativa de eventos Resend (sin secretos).
 */
export type ResendDeliveryClassification =
  | "DELIVERED"
  | "SENT"
  | "DELIVERY_DELAYED"
  | "BOUNCED"
  | "SUPPRESSED"
  | "FAILED"
  | "UNKNOWN";

export function classifyResendStatus(
  raw: Record<string, unknown> | null | undefined,
): ResendDeliveryClassification {
  if (!raw) return "UNKNOWN";
  const last =
    (typeof raw.last_event === "string" && raw.last_event) ||
    (typeof raw.status === "string" && raw.status) ||
    "";
  const u = last.toLowerCase();
  if (u.includes("delivered")) return "DELIVERED";
  if (u.includes("bounced") || u === "bounce") return "BOUNCED";
  if (u.includes("suppressed") || u.includes("complained")) return "SUPPRESSED";
  if (u.includes("delayed") || u.includes("delivery_delayed")) return "DELIVERY_DELAYED";
  if (u.includes("failed") || u.includes("error")) return "FAILED";
  if (u.includes("sent") || u.includes("queued") || u.includes("scheduled")) return "SENT";
  return "UNKNOWN";
}

export function sanitizeBounceReason(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]").slice(0, 240);
}
