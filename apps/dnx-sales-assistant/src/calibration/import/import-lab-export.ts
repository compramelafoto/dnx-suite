import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { containsSensitiveLeak } from "../../review-lab/export/sanitize-export.js";
import type {
  CalibrationStore,
  ConversationCalibrationItem,
  VisualCalibrationItem,
} from "../domain/calibration-item.js";
import { normalizeCalibrationCode } from "../normalization/normalize-calibration-code.js";
import { CALIBRATION_ALLOWED_IMPORT_ROOTS } from "../paths.js";
import { redactPersonalData } from "../redaction/redact-personal-data.js";

export type LabExportPayload = {
  kind?: string;
  version?: number;
  sessionId?: string;
  styleEngine?: string;
  scenarioId?: string;
  turns?: Array<{
    turnNumber: number;
    userMessage: string;
    assistantMessage: string;
    diagnostics?: {
      intent?: string;
      knownFields?: string[];
      missingFields?: string[];
      askedField?: string;
      responseType?: string;
      styleVersion?: string;
      daniScore?: number;
      flags?: Array<{ code: string }>;
      appliedCopyIds?: string[];
      visualReferenceRequested?: boolean;
      visualNiche?: string;
    };
    humanReview?: {
      verdict: "APPROVED" | "NEEDS_ADJUSTMENT" | "INCORRECT";
      note?: string;
      styleVersion?: string;
      askedField?: string;
      createdAt: string;
    };
  }>;
  humanReviews?: Array<{
    turnNumber: number;
    verdict: "APPROVED" | "NEEDS_ADJUSTMENT" | "INCORRECT";
    note?: string;
    styleVersion?: string;
    askedField?: string;
    createdAt: string;
    assistantMessage?: string;
  }>;
  humanVisualReviews?: Array<{
    referenceId: string;
    niche: string;
    verdict: string;
    note?: string;
    createdAt: string;
  }>;
};

export type ImportResult =
  | {
      ok: true;
      itemsAdded: number;
      visualAdded: number;
      sessionId: string;
      store: CalibrationStore;
    }
  | { ok: false; error: string };

function resolveAllowedImportPath(filePath: string): string | null {
  const resolved = path.resolve(filePath);
  if (resolved.includes("..") && !existsSync(resolved)) return null;
  for (const root of CALIBRATION_ALLOWED_IMPORT_ROOTS) {
    const rootResolved = path.resolve(root);
    if (
      resolved === rootResolved ||
      resolved.startsWith(rootResolved + path.sep)
    ) {
      return resolved;
    }
  }
  return null;
}

function stableItemId(sessionId: string, turnNumber: number): string {
  const h = createHash("sha256")
    .update(`${sessionId}:${turnNumber}`)
    .digest("hex")
    .slice(0, 16);
  return `cal-${h}`;
}

/**
 * Importa una exportación válida del laboratorio.
 * No convierte revisiones en escenarios.
 */
export function importLabExport(
  filePath: string,
  store: CalibrationStore,
  options: { redact?: boolean } = {},
): ImportResult {
  const allowed = resolveAllowedImportPath(filePath);
  if (!allowed) {
    return { ok: false, error: "IMPORT_PATH_NOT_ALLOWED" };
  }
  if (!existsSync(allowed)) {
    return { ok: false, error: "FILE_NOT_FOUND" };
  }

  let payload: LabExportPayload;
  try {
    payload = JSON.parse(readFileSync(allowed, "utf8")) as LabExportPayload;
  } catch {
    return { ok: false, error: "INVALID_JSON" };
  }

  // Permitir wrapper { export: {...} } o payload directo
  const body = (payload as { export?: LabExportPayload }).export ?? payload;

  if (body.kind !== "dnx-sales-assistant-review-lab-export") {
    return { ok: false, error: "INVALID_KIND" };
  }
  if (body.version !== 1) {
    return { ok: false, error: "INCOMPATIBLE_VERSION" };
  }
  if (!body.sessionId || !Array.isArray(body.turns)) {
    return { ok: false, error: "INVALID_FORMAT" };
  }

  const json = JSON.stringify(body);
  if (containsSensitiveLeak(json)) {
    return { ok: false, error: "SENSITIVE_LEAK" };
  }

  if (store.importedSessionIds.includes(body.sessionId)) {
    return { ok: false, error: "DUPLICATE_SESSION" };
  }

  const redact = options.redact === true;
  const scrub = (t: string) => (redact ? redactPersonalData(t) : t);
  const reviewsByTurn = new Map(
    (body.humanReviews ?? []).map((r) => [r.turnNumber, r]),
  );

  const importedAt = new Date().toISOString();
  const newItems: ConversationCalibrationItem[] = [];

  for (const turn of body.turns) {
    const review = turn.humanReview ?? reviewsByTurn.get(turn.turnNumber);
    if (!review) continue;

    const diag = turn.diagnostics ?? {};
    const flags = (diag.flags ?? []).map((f) => f.code);
    const { code, source } = normalizeCalibrationCode({
      verdict: review.verdict,
      note: review.note,
      styleFlags: flags,
      styleScore: diag.daniScore,
    });

    const previousMessages: ConversationCalibrationItem["previousMessages"] = [];
    for (const prev of body.turns.filter((t) => t.turnNumber < turn.turnNumber)) {
      previousMessages.push({
        role: "USER",
        message: scrub(prev.userMessage),
      });
      previousMessages.push({
        role: "ASSISTANT",
        message: scrub(prev.assistantMessage),
      });
    }

    newItems.push({
      id: stableItemId(body.sessionId, turn.turnNumber),
      sourceSessionId: body.sessionId,
      turnNumber: turn.turnNumber,
      userMessage: scrub(turn.userMessage),
      assistantMessage: scrub(turn.assistantMessage),
      previousMessages,
      verdict: review.verdict,
      note: review.note ? scrub(review.note) : undefined,
      styleVersion: review.styleVersion || diag.styleVersion || body.styleEngine || "unknown",
      responseType: diag.responseType,
      askedField: review.askedField ?? diag.askedField,
      appliedCopyIds: [...(diag.appliedCopyIds ?? [])],
      detectedIntent: diag.intent,
      knownFields: [...(diag.knownFields ?? [])],
      missingFields: [...(diag.missingFields ?? [])],
      styleScore: diag.daniScore,
      styleFlags: flags,
      visualReferenceIntent: diag.visualReferenceRequested
        ? { requested: true, niche: diag.visualNiche }
        : undefined,
      calibrationCode: code,
      calibrationCodeSource: source,
      scenarioId: body.scenarioId,
      createdAt: review.createdAt,
      importedAt,
    });
  }

  const visualItems: VisualCalibrationItem[] = (body.humanVisualReviews ?? []).map(
    (v) => ({
      id: `vcal-${createHash("sha256").update(`${body.sessionId}:${v.referenceId}`).digest("hex").slice(0, 16)}`,
      sourceSessionId: body.sessionId!,
      referenceId: v.referenceId,
      niche: v.niche,
      verdict: v.verdict,
      note: v.note ? scrub(v.note) : undefined,
      createdAt: v.createdAt,
      importedAt,
    }),
  );

  store.items.push(...newItems);
  store.visualItems.push(...visualItems);
  store.importedSessionIds.push(body.sessionId);

  return {
    ok: true,
    itemsAdded: newItems.length,
    visualAdded: visualItems.length,
    sessionId: body.sessionId,
    store,
  };
}
