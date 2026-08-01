import {
  clickatonTemplateVariablesPlugin,
  createTemplateVariableRegistry,
  fromLegacyTemplateV2,
  parseTemplateDocument,
  resolveTemplateDocument,
  type ResolvedTemplateDocument,
} from "@repo/template-engine";
import {
  TemplateRenderError,
  renderTemplatePreviewPng,
} from "@repo/template-engine-renderer";
import {
  cardRenderFailed,
  cardRenderUnavailable,
  cardTemplateInvalid,
} from "./participant-card-errors";
import {
  getClickatonParticipantCardPreset,
  instantiatePresetPayload,
  type ClickatonCardPreset,
} from "./participant-card-presets";
import type {
  ClickatonParticipantCardType,
  ParticipantCardSourceSummary,
} from "./participant-card-types";

export type RenderClickatonParticipantCardInput = {
  cardType: ClickatonParticipantCardType;
  templateData: Record<string, unknown>;
  preset?: ClickatonCardPreset;
};

export type RenderClickatonParticipantCardResult = {
  png: Buffer;
  width: number;
  height: number;
  mimeType: "image/png";
  durationMs: number;
  sourceSummary: ParticipantCardSourceSummary;
  renderWarnings: string[];
};

function mapTemplateRenderError(err: TemplateRenderError): never {
  if (
    err.code === "TEMPLATE_PREVIEW_UNAVAILABLE" ||
    err.code === "TEMPLATE_PREVIEW_BUSY"
  ) {
    throw cardRenderUnavailable(err.message, { code: err.code, details: err.details });
  }
  if (err.code === "TEMPLATE_PREVIEW_TIMEOUT") {
    throw cardRenderFailed(err.message, { code: err.code });
  }
  throw cardRenderFailed(err.message, { code: err.code, details: err.details });
}

export function resolveClickatonParticipantCardDocument(input: {
  cardType: ClickatonParticipantCardType;
  templateData: Record<string, unknown>;
  preset?: ClickatonCardPreset;
}): {
  document: ResolvedTemplateDocument;
  preset: ClickatonCardPreset;
} {
  const preset = input.preset ?? getClickatonParticipantCardPreset(input.cardType);
  const legacyPayload = instantiatePresetPayload(preset);
  const bridged = fromLegacyTemplateV2(legacyPayload, {
    id: preset.presetId,
    name: preset.name,
  });

  const parsed = parseTemplateDocument(bridged.document);
  if (!parsed.ok) {
    throw cardTemplateInvalid(parsed.error, { issues: parsed.issues });
  }

  const registry = createTemplateVariableRegistry({
    plugins: [clickatonTemplateVariablesPlugin],
  });

  const resolved = resolveTemplateDocument({
    template: parsed.data,
    data: input.templateData,
    registry,
  });

  if (resolved.errors.length > 0) {
    throw cardTemplateInvalid("Plantilla con errores de resolución", {
      errors: resolved.errors,
    });
  }

  return { document: resolved.document, preset };
}

export async function renderClickatonParticipantCard(
  input: RenderClickatonParticipantCardInput
): Promise<RenderClickatonParticipantCardResult> {
  const { document, preset } = resolveClickatonParticipantCardDocument({
    cardType: input.cardType,
    templateData: input.templateData,
    preset: input.preset,
  });

  try {
    const rendered = await renderTemplatePreviewPng(document);
    return {
      png: rendered.png,
      width: rendered.width,
      height: rendered.height,
      mimeType: rendered.mimeType,
      durationMs: rendered.durationMs,
      renderWarnings: rendered.warnings,
      sourceSummary: {
        presetId: preset.presetId,
        templateKey: preset.meta.templateKey,
        templateVersion: preset.meta.templateVersion,
        blockCount: rendered.blockCount,
        imageCount: rendered.imageCount,
      },
    };
  } catch (err) {
    if (err instanceof TemplateRenderError) {
      mapTemplateRenderError(err);
    }
    throw cardRenderFailed(
      err instanceof Error ? err.message : "Error desconocido al renderizar placa"
    );
  }
}
