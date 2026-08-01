export type ParticipantCardAuditEvent =
  | "CLICKATON_CARD_GENERATED"
  | "CLICKATON_CARD_REUSED"
  | "CLICKATON_CARD_REGENERATED"
  | "CLICKATON_CARD_FAILED"
  | "CLICKATON_CARD_DOWNLOADED";

export type ParticipantCardAuditFields = {
  registrationId?: string;
  editionId?: string;
  cardType?: string;
  renderHashPrefix?: string;
  cacheStatus?: string;
  actorKind?: string;
  durationMs?: number;
  errorCode?: string;
  recordId?: string;
  [key: string]: string | number | boolean | null | undefined;
};

const SAFE_KEYS = new Set([
  "registrationId",
  "editionId",
  "cardType",
  "renderHashPrefix",
  "cacheStatus",
  "actorKind",
  "durationMs",
  "errorCode",
  "recordId",
  "width",
  "height",
  "byteSize",
  "templateKey",
  "templateVersion",
  "force",
]);

function sanitizeFields(
  fields: ParticipantCardAuditFields
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    if (!SAFE_KEYS.has(k)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out;
}

export function recordParticipantCardAudit(
  event: ParticipantCardAuditEvent,
  fields: ParticipantCardAuditFields = {}
): void {
  console.info(
    JSON.stringify({
      event,
      ts: new Date().toISOString(),
      ...sanitizeFields(fields),
    })
  );
}
