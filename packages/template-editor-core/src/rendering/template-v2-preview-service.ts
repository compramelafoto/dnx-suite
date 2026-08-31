import type { LegacyTemplateV2Payload } from "@repo/template-engine";
import { resolveTemplateDocument } from "@repo/template-engine";
import { legacyPayloadToCore } from "../services/template-v2-mappers";
import { validateLegacyTemplatePayload } from "../services/template-v2-validation-service";
import { TemplateV2DomainError } from "../services/template-v2-errors";
import type { TemplateV2AuthUser } from "../services/template-v2-authorization";
import { getTemplateV2Detail } from "../services/template-v2-query-service";
import { renderPreviewSvg } from "./preview-svg";
import {
  previewInvalid,
  previewLimitExceeded,
} from "../rendering/template-v2-render-errors";
import { assertPreviewCanvasLimits } from "../rendering/template-v2-render-limits";
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
  /**
   * El dibujo, en SVG.
   *
   * Antes era un PNG que sacaba un navegador headless. Ahora lo produce el mismo módulo que
   * imprime, que no necesita navegador y da los mismos cortes de línea que el archivo final.
   */
  svg: string;
  /** Cuántas caras tiene el diseño. La vista previa muestra una por vez. */
  pageCount: number;
  width: number;
  height: number;
  mimeType: "image/svg+xml";
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

  /*
   * Se dibuja con el módulo de impresión, sin navegador.
   *
   * La versión anterior levantaba Chromium para sacarle una foto a una página HTML. Anda en una
   * computadora y no en el servidor de producción, donde ese binario no existe: la vista previa
   * contestaba "playwright-core no disponible en este runtime" y no se podía ver ningún diseño,
   * en ninguna plataforma.
   *
   * Además de andar, es más fiel: es el mismo motor y el mismo medidor de texto que produce el
   * archivo que va a la imprenta, así que los cortes de línea son los de verdad.
   */
  /*
   * El límite de tamaño lo imponía el navegador que ya no se usa. Se comprueba acá, explícito:
   * un lienzo enorme produce un SVG enorme, y el servidor lo dibuja igual sin quejarse hasta
   * que se queda sin memoria.
   */
  try {
    assertPreviewCanvasLimits(resolved.document.width, resolved.document.height);
  } catch (err) {
    // Se traduce al error del módulo para que la ruta devuelva su código y no un 500 genérico.
    throw previewLimitExceeded(
      err instanceof Error ? err.message : "Lienzo fuera de rango",
    );
  }

  const pagina =
    typeof args.body.previewPageIndex === "number" ? args.body.previewPageIndex : 0;

  const svg = await renderPreviewSvg({
    canvas: legacy.canvas as never,
    blocks: legacy.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      name: b.name ?? null,
      pageIndex: b.pageIndex ?? 0,
      ...b.layout,
      configJson: b.configJson,
    })) as never,
    product,
    name: templateName,
  });
  if (!svg.ok) {
    throw previewInvalid("No se pudo dibujar la vista previa", { errors: svg.errors });
  }

  const render = {
    svg: svg.pages[pagina] ?? svg.pages[0] ?? "",
    pageCount: svg.pages.length,
    mimeType: "image/svg+xml" as const,
    width: resolved.document.width,
    height: resolved.document.height,
    blockCount: legacy.blocks.length,
    durationMs: 0,
    imageCount: legacy.blocks.filter((b) => b.type === "IMAGE" || b.type === "PHOTO").length,
    warnings: svg.warnings,
  };

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
