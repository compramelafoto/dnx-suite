/**
 * Logs estructurados mínimos P0-08 — sin secretos ni PII.
 */
export type FotoRankLogEvent =
  | "registration.created"
  | "registration.confirmed"
  | "upload.intent"
  | "upload.complete"
  | "entry.processing"
  | "entry.exif"
  | "entry.checklist"
  | "entry.confirmed"
  | "entry.replaced"
  | "jury.preview_access"
  | "jury.conflict"
  | "org.review"
  | "storage.r2.error"
  | "email.queued"
  | "email.failed";

const REDACT_KEYS = [
  "password",
  "secret",
  "token",
  "authorization",
  "storageKey",
  "sha256",
  "rawMetadataJson",
  "gpsLatitude",
  "gpsLongitude",
  "email",
  "phone",
  "dni",
  "signedUrl",
];

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.some((r) => k.toLowerCase().includes(r.toLowerCase()))) {
        out[k] = "[redacted]";
      } else {
        out[k] = scrub(v);
      }
    }
    return out;
  }
  if (typeof value === "string" && value.length > 200) return `${value.slice(0, 40)}…`;
  return value;
}

export function frLog(
  event: FotoRankLogEvent,
  payload: Record<string, unknown> & { correlationId?: string },
): void {
  const line = {
    ts: new Date().toISOString(),
    service: "fotorank",
    event,
    correlationId: payload.correlationId ?? null,
    ...((scrub(payload) as Record<string, unknown>) ?? {}),
  };
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(line));
}
