import {
  normalizeTemplateBinding,
  parseTemplateDocument,
  resolveTemplateDocument,
  type TemplateDocument,
  type LegacyTemplateV2Payload,
} from "@repo/template-engine";
import {
  resolveTemplateProduct,
  resolveTemplateVariablePlugin,
} from "@/lib/template-v2/resolve-template-product";
import {
  assertLegacyPayloadLimits,
  legacyPayloadToCore,
} from "@/lib/template-v2/services/template-v2-mappers";
import { TEMPLATE_V2_LIMITS } from "@/lib/template-v2/services/template-v2-limits";

export type TemplateValidationIssue = {
  code: string;
  message: string;
  path?: string;
  blockId?: string;
};

export type TemplateValidationResponse = {
  valid: boolean;
  errors: TemplateValidationIssue[];
  warnings: TemplateValidationIssue[];
  normalizedTemplate?: TemplateDocument;
};

/**
 * Valida un payload legacy/editor sin persistir.
 */
export function validateLegacyTemplatePayload(
  payload: LegacyTemplateV2Payload,
  options?: { id?: string; name?: string }
): TemplateValidationResponse {
  const errors: TemplateValidationIssue[] = [];
  const warnings: TemplateValidationIssue[] = [];

  try {
    assertLegacyPayloadLimits(payload);
  } catch (err) {
    errors.push({
      code: "limits",
      message: err instanceof Error ? err.message : "Límites inválidos",
    });
    return { valid: false, errors, warnings };
  }

  let document: TemplateDocument;
  try {
    const bridged = legacyPayloadToCore(payload, options);
    document = bridged.document;
    for (const w of bridged.warnings) {
      warnings.push({ code: w.code, message: w.message, path: w.field });
    }
  } catch (err) {
    errors.push({
      code: "bridge",
      message: err instanceof Error ? err.message : "Bridge inválido",
    });
    return { valid: false, errors, warnings };
  }

  const parsed = parseTemplateDocument(document);
  if (!parsed.ok) {
    errors.push({ code: "schema", message: parsed.error });
    for (const issue of parsed.issues ?? []) {
      errors.push({ code: "schema_issue", message: issue });
    }
    return { valid: false, errors, warnings };
  }

  const product = resolveTemplateProduct(payload.meta);
  if (product === "unknown") {
    errors.push({
      code: "unknown_product",
      message: `metadata.product desconocido`,
    });
  }
  const registry = resolveTemplateVariablePlugin(product);
  const aliases = registry.getAliases();
  const known = new Set(registry.listVariableDefinitions().map((d) => d.path));

  for (const block of parsed.data.blocks) {
    // fuera del canvas
    if (
      block.layout.x + block.layout.width < 0 ||
      block.layout.y + block.layout.height < 0 ||
      block.layout.x > parsed.data.width ||
      block.layout.y > parsed.data.height
    ) {
      warnings.push({
        code: "block_outside_canvas",
        message: `Bloque fuera del canvas`,
        blockId: block.id,
      });
    }

    if (block.type === "TEXT") {
      const content = typeof block.config.content === "string" ? block.config.content : "";
      const re = /\{([^{}]+)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content))) {
        const inner = m[1] ?? "";
        const norm = normalizeTemplateBinding(inner, { aliases, knownPaths: known });
        if (!norm.ok) {
          warnings.push({
            code: "unknown_variable",
            message: `Token no reconocido: {${inner}}`,
            blockId: block.id,
            path: inner,
          });
        } else if (norm.binding.aliasUsed) {
          warnings.push({
            code: "deprecated_alias",
            message: `Alias "${norm.binding.aliasUsed}" → ${norm.binding.path}`,
            blockId: block.id,
            path: norm.binding.path,
          });
        }
      }
    }

    if (block.type === "VARIABLE_TEXT") {
      const key = typeof block.config.variableKey === "string" ? block.config.variableKey : "";
      if (!key || !registry.getVariableDefinition(key)) {
        errors.push({
          code: "unknown_variable",
          message: `variableKey inválido: ${key || "(vacío)"}`,
          blockId: block.id,
          path: key,
        });
      }
    }

    if (block.type === "IMAGE" || block.type === "PHOTO") {
      const src = typeof block.config.src === "string" ? block.config.src : "";
      const source =
        block.config.source && typeof block.config.source === "object"
          ? (block.config.source as Record<string, unknown>)
          : {};
      const varKey = typeof source.variableKey === "string" ? source.variableKey : "";
      if (!src && !varKey && block.layout.visible) {
        warnings.push({
          code: "image_without_url",
          message: "Imagen sin src ni variable",
          blockId: block.id,
        });
      }
      if (varKey && !registry.getVariableDefinition(varKey)) {
        errors.push({
          code: "unknown_variable",
          message: `variable de imagen inválida: ${varKey}`,
          blockId: block.id,
          path: varKey,
        });
      }
    }
  }

  for (const binding of parsed.data.bindings) {
    if (!registry.getVariableDefinition(binding.variableKey)) {
      errors.push({
        code: "TEMPLATE_BINDING_INVALID",
        message: `binding.variableKey desconocido: ${binding.variableKey}`,
        blockId: binding.blockId,
        path: binding.variableKey,
      });
    }
  }

  // Resolución con data vacía acumula required/missing (solo warnings aquí)
  const resolution = resolveTemplateDocument({
    template: parsed.data,
    data: {},
    registry,
  });
  for (const w of resolution.warnings) {
    warnings.push({
      code: w.code,
      message: w.message,
      path: w.path,
      blockId: w.blockId,
    });
  }
  // errors de required_missing con data vacío no invalidan el documento de diseño
  for (const e of resolution.errors) {
    if (e.code === "invalid_binding" || e.code === "unsafe_path") {
      errors.push({
        code: e.code,
        message: e.message,
        path: e.path,
        blockId: e.blockId,
      });
    } else {
      warnings.push({
        code: e.code,
        message: e.message,
        path: e.path,
        blockId: e.blockId,
      });
    }
  }

  if (parsed.data.width > TEMPLATE_V2_LIMITS.maxCanvasWidth) {
    errors.push({ code: "dimensions", message: "Ancho inválido" });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedTemplate: parsed.data,
  };
}
