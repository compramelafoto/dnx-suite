import { foldQuoteText } from "../../../quote-request/fold.js";
import type { QuoteRequiredField } from "../../../quote-request/models.js";
import { getCopyById } from "./dani-copy-catalog.js";
import { selectConfirmation } from "./dani-confirmation-strategy.js";
import {
  selectNextMissingField,
  selectQuestionCopy,
} from "./dani-question-strategy.js";
import type { DaniResponseContext } from "./dani-response-context.js";
import { DANI_CONVERSATION_VERSION } from "./dani-response-context.js";
import type { DaniResponseResult } from "./dani-response-result.js";
import { styleGuardWarning } from "./dani-style-guards.js";
import { composeMessage, selectReadyTransition } from "./dani-transition-strategy.js";

function serviceLabel(type: string | undefined): string {
  switch (type) {
    case "WEDDING":
      return "casamiento";
    case "FIFTEENTH_BIRTHDAY":
      return "cumpleaños de quince";
    case "BIRTHDAY":
      return "cumpleaños";
    case "SPORTS_EVENT":
      return "cobertura deportiva";
    case "FAMILY_SESSION":
      return "sesión familiar";
    case "PORTRAIT_SESSION":
      return "sesión de retrato";
    default:
      return "ese trabajo";
  }
}

function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

function buildCorrectionLine(ctx: DaniResponseContext): { text: string; copyId: string } | undefined {
  if (ctx.correctedFields.length === 0) return undefined;
  const field = ctx.correctedFields[0]!;
  const draft = ctx.draft;
  if (field === "DURATION_HOURS" && draft?.durationHours !== undefined) {
    const entry = getCopyById("CORR_DURATION")!;
    return {
      copyId: entry.id,
      text: fillTemplate(entry.text, { hours: String(draft.durationHours) }),
    };
  }
  if (field === "CITY" && draft?.city) {
    const entry = getCopyById("CORR_CITY")!;
    return {
      copyId: entry.id,
      text: fillTemplate(entry.text, { city: draft.city }),
    };
  }
  if (field === "SERVICE_TYPE" && draft?.serviceType) {
    const entry = getCopyById("CORR_SERVICE")!;
    return {
      copyId: entry.id,
      text: fillTemplate(entry.text, { service: serviceLabel(draft.serviceType) }),
    };
  }
  if (field === "EVENT_DATE") {
    const entry = getCopyById("CORR_DATE")!;
    return { copyId: entry.id, text: entry.text };
  }
  const generic = getCopyById("CORR_GENERIC")!;
  return { copyId: generic.id, text: generic.text };
}

function isAlbumPublish(message: string): boolean {
  const f = foldQuoteText(message);
  return /\b(publicar|subir).*(album|galeria)\b/.test(f) || /\balbum\b/.test(f);
}

function isSellPhotos(message: string): boolean {
  const f = foldQuoteText(message);
  return /\b(vender|venta).*(foto|fotos)\b/.test(f);
}

function isImpatientPrice(message: string): boolean {
  const f = foldQuoteText(message);
  return (
    /\b(decime|decime ya|y listo)\b/.test(f) &&
    /\b(cuanto|precio|cobrar)\b/.test(f)
  ) || /\bcuanto tengo que cobrar\b/.test(f);
}

function isDurationUnknown(message: string): boolean {
  const f = foldQuoteText(message);
  return /\b(no se|todavia no se|ni idea).*(hora|horas|durar|duracion)\b/.test(f);
}

/**
 * Renderer determinista dani-conversation-v1.
 * No usa IA externa. No muestra precios.
 */
export function renderDaniResponse(ctx: DaniResponseContext): DaniResponseResult {
  const appliedCopyIds: string[] = [];
  const warnings: string[] = [];
  const parts: string[] = [];

  if (ctx.cancelActive) {
    const entry = getCopyById("CANCEL_OK")!;
    appliedCopyIds.push(entry.id);
    return finalize(entry.text, "CANCEL_ACKNOWLEDGEMENT", undefined, undefined, appliedCopyIds, warnings);
  }

  if (ctx.visualReferenceIntent?.requested) {
    const niche = ctx.visualReferenceIntent.niche;
    const selectedCount = ctx.visualReferenceIntent.selectedCount ?? 0;
    if (niche && selectedCount > 0) {
      const purpose = ctx.visualReferenceIntent.primaryEducationalPurpose;
      const hint =
        purpose === "congelamiento de acción" ||
        purpose === "anticipación del momento"
          ? "cómo separan al atleta del fondo y cómo anticipan el momento de acción"
          : purpose === "composición" || purpose === "iluminación"
            ? `cómo trabajan la ${purpose}`
            : purpose
              ? `el enfoque en ${purpose}`
              : "la composición y el momento";
      const entry = getCopyById("VISUAL_NICHE_WITH_REFS")!;
      appliedCopyIds.push(entry.id);
      return finalize(
        fillTemplate(entry.text, { niche, hint }),
        "VISUAL_REFERENCE_READY",
        undefined,
        undefined,
        appliedCopyIds,
        warnings,
      );
    }
    if (niche) {
      const entry = getCopyById("VISUAL_NICHE_EMPTY")!;
      appliedCopyIds.push(entry.id);
      return finalize(
        fillTemplate(entry.text, { niche }),
        "VISUAL_REFERENCE_EMPTY",
        undefined,
        undefined,
        appliedCopyIds,
        warnings,
      );
    }
    const entry = getCopyById("VISUAL_GENERIC")!;
    appliedCopyIds.push(entry.id);
    return finalize(
      entry.text,
      "VISUAL_REFERENCE_PENDING",
      undefined,
      undefined,
      appliedCopyIds,
      warnings,
    );
  }

  const quoteFlow =
    ctx.detectedIntent === "QUOTE_REQUEST" ||
    ctx.quoteStatus === "COLLECTING_INFORMATION" ||
    ctx.quoteStatus === "READY_FOR_CALCULATION";

  if (quoteFlow && ctx.quoteStatus === "READY_FOR_CALCULATION") {
    const corr = buildCorrectionLine(ctx);
    if (corr) {
      parts.push(corr.text);
      appliedCopyIds.push(corr.copyId);
    } else {
      const conf = selectConfirmation(ctx);
      if (conf && ctx.fieldsLearnedThisTurn.length > 0) {
        parts.push(conf.text);
        appliedCopyIds.push(conf.id);
      }
    }
    const ready = selectReadyTransition(ctx);
    parts.push(ready.text);
    appliedCopyIds.push(ready.id);
    return finalize(
      composeMessage(parts),
      "READY_INTERNAL",
      undefined,
      appliedCopyIds.find((id) => id.startsWith("CONF_")),
      appliedCopyIds,
      warnings,
    );
  }

  if (quoteFlow && (ctx.missingFields.length > 0 || ctx.correctedFields.length > 0)) {
    if (isDurationUnknown(ctx.userMessage) && ctx.missingFields.includes("DURATION_HOURS")) {
      const entry = getCopyById("INTENT_DURATION_UNKNOWN")!;
      appliedCopyIds.push(entry.id);
      const others = ctx.missingFields.filter((f) => f !== "DURATION_HOURS");
      const next = selectNextMissingField(others);
      if (next) {
        const q = selectQuestionCopy(ctx, next);
        appliedCopyIds.push(q.id);
        return finalize(
          composeMessage([entry.text, q.text]),
          "CLARIFICATION",
          next,
          undefined,
          appliedCopyIds,
          warnings,
        );
      }
      return finalize(entry.text, "CLARIFICATION", undefined, undefined, appliedCopyIds, warnings);
    }

    const corr = buildCorrectionLine(ctx);
    if (corr) {
      parts.push(corr.text);
      appliedCopyIds.push(corr.copyId);
    } else {
      const conf = selectConfirmation(ctx);
      if (conf) {
        parts.push(conf.text);
        appliedCopyIds.push(conf.id);
      }
    }

    const nextField = selectNextMissingField(ctx.missingFields);
    if (!nextField) {
      const ready = selectReadyTransition(ctx);
      parts.push(ready.text);
      appliedCopyIds.push(ready.id);
      return finalize(
        composeMessage(parts),
        "READY_INTERNAL",
        undefined,
        undefined,
        appliedCopyIds,
        warnings,
      );
    }

    const question = selectQuestionCopy(ctx, nextField);
    parts.push(question.text);
    appliedCopyIds.push(question.id);

    return finalize(
      composeMessage(parts),
      corr ? "CORRECTION_ACKNOWLEDGEMENT" : "FOLLOW_UP_QUESTION",
      nextField,
      appliedCopyIds.find((id) => id.startsWith("CONF_")),
      appliedCopyIds,
      warnings,
    );
  }

  // Intenciones no-quote / guía
  if (isImpatientPrice(ctx.userMessage)) {
    const entry = getCopyById("INTENT_IMPATIENT")!;
    appliedCopyIds.push(entry.id);
    const next = selectNextMissingField(ctx.missingFields.length ? ctx.missingFields : ["SERVICE_TYPE"]);
    if (next && ctx.detectedIntent === "QUOTE_REQUEST") {
      const q = selectQuestionCopy(ctx, next);
      appliedCopyIds.push(q.id);
      return finalize(
        composeMessage([entry.text, q.text]),
        "INTENT_GUIDANCE",
        next,
        undefined,
        appliedCopyIds,
        warnings,
      );
    }
    // Si no hay flujo quote, abrir con tipo de trabajo
    const q = selectQuestionCopy(
      { ...ctx, missingFields: ["SERVICE_TYPE"] },
      "SERVICE_TYPE",
    );
    appliedCopyIds.push(q.id);
    return finalize(
      composeMessage([entry.text, q.text]),
      "INTENT_GUIDANCE",
      "SERVICE_TYPE",
      undefined,
      appliedCopyIds,
      warnings,
    );
  }

  if (isAlbumPublish(ctx.userMessage)) {
    const entry = getCopyById("INTENT_ALBUM")!;
    appliedCopyIds.push(entry.id);
    return finalize(entry.text, "INTENT_GUIDANCE", undefined, undefined, appliedCopyIds, warnings);
  }
  if (isSellPhotos(ctx.userMessage)) {
    const entry = getCopyById("INTENT_SELL_PHOTOS")!;
    appliedCopyIds.push(entry.id);
    return finalize(entry.text, "INTENT_GUIDANCE", undefined, undefined, appliedCopyIds, warnings);
  }

  const intentCopyId = intentCopyFor(ctx.detectedIntent);
  const intentEntry = getCopyById(intentCopyId)!;
  appliedCopyIds.push(intentEntry.id);
  return finalize(
    intentEntry.text,
    "INTENT_GUIDANCE",
    undefined,
    undefined,
    appliedCopyIds,
    warnings,
  );
}

function intentCopyFor(
  intent: DaniResponseContext["detectedIntent"],
): string {
  switch (intent) {
    case "GREETING":
      return "INTENT_GREETING";
    case "GENERAL_SERVICE_INQUIRY":
      return "INTENT_GENERAL";
    case "OUT_OF_SCOPE":
      return "INTENT_OUT_OF_SCOPE";
    case "UNKNOWN":
      return "INTENT_UNKNOWN";
    case "THANKS":
      return "INTENT_THANKS";
    case "AFFIRMATIVE":
      return "INTENT_AFFIRMATIVE";
    case "NEGATIVE":
      return "INTENT_NEGATIVE";
    case "HUMAN_HANDOFF_REQUEST":
      return "INTENT_HANDOFF";
    case "QUOTE_REQUEST":
      return "INTENT_GENERAL";
    default:
      return "INTENT_UNKNOWN";
  }
}

function finalize(
  message: string,
  responseType: DaniResponseResult["responseType"],
  askedField: QuoteRequiredField | undefined,
  confirmationId: string | undefined,
  appliedCopyIds: string[],
  warnings: string[],
): DaniResponseResult {
  const guard = styleGuardWarning(message);
  if (guard) warnings.push(guard);
  return {
    message,
    responseType,
    askedField,
    confirmationId,
    styleVersion: DANI_CONVERSATION_VERSION,
    appliedCopyIds,
    warnings,
  };
}
