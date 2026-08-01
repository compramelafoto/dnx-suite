import { createHash } from "node:crypto";
import { maskEmail } from "../email/runtime/mask";
import type { CommunicationMetadata } from "../shared/types";

const SENSITIVE_META =
  /^(api[_-]?key|token|secret|signature|authorization|html|text|body|payload|email|password)$/i;

export function maskProviderId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (id.length <= 10) return `${id.slice(0, 3)}…`;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function hashEmail(email: string, salt = "dnx-communications"): string {
  return createHash("sha256")
    .update(`${salt}:${email.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

export function toMaskedRecipient(email: string | undefined):
  | { maskedEmail: string; emailHash: string }
  | undefined {
  if (!email?.trim()) return undefined;
  const normalized = email.trim().toLowerCase();
  return {
    maskedEmail: maskEmail(normalized),
    emailHash: hashEmail(normalized),
  };
}

export function sanitizeTrackingMetadata(
  metadata?: CommunicationMetadata,
): CommunicationMetadata | undefined {
  if (!metadata) return undefined;
  const out: CommunicationMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_META.test(key)) continue;
    if (typeof value === "string" && value.length > 120) {
      out[key] = `[redacted:${value.length}chars]`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function getHeader(
  headers: Record<string, string | undefined>,
  name: string,
): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && value?.trim()) {
      return value.trim();
    }
  }
  return undefined;
}
