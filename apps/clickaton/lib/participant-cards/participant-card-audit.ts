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
  /** El motivo del fallo, recortado. Sin esto un fallo sólo dice "el render falló". */
  errorMessage?: string;
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
  "errorMessage",
  "recordId",
  "width",
  "height",
  "byteSize",
  "templateKey",
  "templateVersion",
  "force",
]);

/**
 * Un mensaje de error puede arrastrar la dirección de una foto o el nombre de alguien, así que
 * se recorta. Doscientos caracteres alcanzan para reconocer la causa —un módulo que falta, un
 * bloque inválido— sin volcar medio documento al registro.
 */
const MAX_ERROR_MESSAGE = 200;

function sanitizeFields(
  fields: ParticipantCardAuditFields
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    if (!SAFE_KEYS.has(k)) continue;
    if (k === "errorMessage" && typeof v === "string") {
      out[k] = v.slice(0, MAX_ERROR_MESSAGE);
      continue;
    }
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
