import type { LegacyTemplateV2Payload } from "@repo/template-engine";
import { resolveTemplateDocument } from "@repo/template-engine";
import { legacyPayloadToCore } from "../services/template-v2-mappers";
import { validateLegacyTemplatePayload } from "../services/template-v2-validation-service";
import { TemplateV2DomainError } from "../services/template-v2-errors";
import type { TemplateV2AuthUser } from "../services/template-v2-authorization";
import { getTemplateV2Detail } from "../services/template-v2-query-service";
import { renderTemplatePreviewPng } from "../rendering/template-v2-preview-renderer";
import {
  previewInvalid,
} from "../rendering/template-v2-render-errors";
import { clampPreviewScale } from "../rendering/template-v2-render-limits";
import { parseTemplateV2EditorPayload } from "../validate-save-payload";
import {
  createExampleDataForProduct,
  resolveTemplateProduct,
  resolveTemplateVariablePlugin,
} from "../resolve-template-product";

export type TemplatePreviewRequest = {
  templateId?: string;
  versionId?: string;
  draft?: unknown;
  data?: Record<string, unknown>;
  /** Compat editor: mockData */
  mockData?: Record<string, unknown>;
  previewPageIndex?: number;
  output?: {
    format?: "png";
    scale?: number;
    quality?: number;
  };
};

export type TemplatePreviewServiceResult = {
  png: Buffer;
  width: number;
  height: number;
  mimeType: "image/png";
  durationMs: number;
  blockCount: number;
  imageCount: number;
  warnings: string[];
};

function asLegacyDraft(draft: unknown): LegacyTemplateV2Payload {
  const parsed = parseTemplateV2EditorPayload(draft);
  if (!parsed.ok) {
    throw previewInvalid(parsed.error);
  }
  return {
    canvas: parsed.data.canvas,
    blocks: parsed.data.blocks,
    variableBindings: parsed.data.variableBindings ?? [],
    meta: parsed.data.meta ?? {},
  };
}

/**
 * Precedencia:
 * 1) draft (preview sin guardar)
 * 2) templateId (+ versionId opcional) persistido
 */
export async function runTemplateV2Preview(args: {
  user: TemplateV2AuthUser;
  body: TemplatePreviewRequest;
}): Promise<TemplatePreviewServiceResult> {
  const format = args.body.output?.format ?? "png";
  if (format !== "png") {
    throw new TemplateV2DomainError(
      "TEMPLATE_INVALID",
      "Solo se soporta output.format=png",
      400
    );
  }

  let legacy: LegacyTemplateV2Payload | null = null;
  let templateName = "Preview";

  if (args.body.draft != null) {
    legacy = asLegacyDraft(args.body.draft);
  } else if (typeof args.body.templateId === "string" && args.body.templateId) {
    const detail = await getTemplateV2Detail(args.user, args.body.templateId, {
      includeLegacy: true,
      versionId:
        typeof args.body.versionId === "string" ? args.body.versionId : undefined,
    });
    if (!detail.legacy) {
      throw previewInvalid("Versión sin payload legacy");
    }
    legacy = detail.legacy as LegacyTemplateV2Payload;
    templateName = detail.meta.name;
  } else {
    throw previewInvalid("Se requiere draft o templateId");
  }

  const validation = validateLegacyTemplatePayload(legacy, { name: templateName });
  if (!validation.valid) {
    throw previewInvalid("Plantilla inválida para preview", {
      errors: validation.errors,
      warnings: validation.warnings,
    });
  }

  const { document, warnings: bridgeWarnings } = legacyPayloadToCore(legacy, {
    name: templateName,
  });

  const product = resolveTemplateProduct(legacy.meta);
  if (product === "unknown") {
    throw previewInvalid("metadata.product desconocido", {
      product: (legacy.meta as { product?: unknown })?.product,
    });
  }

  const data = createExampleDataForProduct(product, {
    ...(args.body.data ?? {}),
    ...(args.body.mockData ?? {}),
  });

  const registry = resolveTemplateVariablePlugin(product);
  const resolved = resolveTemplateDocument({ template: document, data, registry });
  if (resolved.errors.length > 0) {
    const critical = resolved.errors.filter(
      (e) => e.code === "unsafe_path" || e.code === "invalid_binding"
    );
    if (critical.length > 0) {
      throw previewInvalid("Bindings o paths inválidos para preview", {
        errors: resolved.errors,
        warnings: resolved.warnings,
      });
    }
  }

  const render = await renderTemplatePreviewPng(resolved.document, {
    pageIndex:
      typeof args.body.previewPageIndex === "number"
        ? args.body.previewPageIndex
        : 0,
    scale: clampPreviewScale(args.body.output?.scale),
  });

  const warnings = [
    ...bridgeWarnings.map((w) => w.message),
    ...resolved.warnings.map((w) => w.message),
    ...render.warnings,
  ].slice(0, 40);

  // Métricas seguras (sin textos/bindings)
  console.info(
    JSON.stringify({
      event: "templatePreview",
      durationMs: render.durationMs,
      blockCount: render.blockCount,
      imageCount: render.imageCount,
      width: render.width,
      height: render.height,
      success: true,
      warningCount: warnings.length,
    })
  );

  return { ...render, warnings };
}
