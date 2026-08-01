import {
  BRACE_TOKEN_RE,
  normalizeTemplateBinding,
} from "../bindings/index";
import { isKnownFormatter } from "../variables/formatters";
import type { TemplateVariableRegistry } from "../variables/registry";
import type {
  ResolvedTemplateDocument,
  TemplateDocument,
} from "../schema/document";
import type { TemplateBlock } from "../schema/blocks";

export type TemplateResolutionWarning = {
  code:
    | "unknown_variable"
    | "missing_optional"
    | "empty_value"
    | "deprecated_alias"
    | "unknown_formatter"
    | "image_without_url"
    | "type_mismatch";
  message: string;
  path?: string;
  blockId?: string;
};

export type TemplateResolutionError = {
  code:
    | "invalid_binding"
    | "required_missing"
    | "unsafe_path"
    | "invalid_document";
  message: string;
  path?: string;
  blockId?: string;
};

export type TemplateResolutionResult = {
  document: ResolvedTemplateDocument;
  warnings: TemplateResolutionWarning[];
  errors: TemplateResolutionError[];
};

export type ResolveTemplateDocumentInput = {
  template: TemplateDocument;
  data: unknown;
  registry: TemplateVariableRegistry;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function resolveTextWithBraces(
  raw: string,
  data: unknown,
  registry: TemplateVariableRegistry,
  blockId: string | undefined,
  warnings: TemplateResolutionWarning[],
  errors: TemplateResolutionError[]
): string {
  if (!raw.includes("{")) return raw;

  const aliases = registry.getAliases();
  const known = new Set(registry.listVariableDefinitions().map((d) => d.path));

  return raw.replace(BRACE_TOKEN_RE, (full, inner: string) => {
    const normalized = normalizeTemplateBinding(String(inner), { aliases, knownPaths: known });
    if (!normalized.ok) {
      // Token desconocido: se deja tal cual (compat V2) + warning
      warnings.push({
        code: "unknown_variable",
        message: `token no reconocido: ${full}`,
        path: String(inner),
        blockId,
      });
      return full;
    }

    if (normalized.binding.aliasUsed) {
      warnings.push({
        code: "deprecated_alias",
        message: `alias "${normalized.binding.aliasUsed}" → ${normalized.binding.path}`,
        path: normalized.binding.path,
        blockId,
      });
    }

    const resolved = registry.resolveTemplateVariable(normalized.binding.path, data, {
      formatter: normalized.binding.formatter,
      fallback: normalized.binding.fallback,
    });

    if (resolved.status === "unsafe_path") {
      errors.push({
        code: "unsafe_path",
        message: `path inseguro: ${resolved.path}`,
        path: resolved.path,
        blockId,
      });
      return full;
    }

    if (resolved.status === "unknown") {
      warnings.push({
        code: "unknown_variable",
        message: `variable inexistente: ${resolved.path}`,
        path: resolved.path,
        blockId,
      });
      return full;
    }

    if (resolved.status === "missing" || resolved.status === "empty") {
      const def = registry.getVariableDefinition(resolved.path);
      if (def?.required && !resolved.usedFallback) {
        errors.push({
          code: "required_missing",
          message: `dato obligatorio ausente: ${resolved.path}`,
          path: resolved.path,
          blockId,
        });
      } else if (!resolved.usedFallback) {
        warnings.push({
          code: resolved.status === "empty" ? "empty_value" : "missing_optional",
          message: `valor ${resolved.status}: ${resolved.path}`,
          path: resolved.path,
          blockId,
        });
      }
      if (resolved.formatted != null) return resolved.formatted;
      return full;
    }

    if (resolved.status === "type_mismatch") {
      warnings.push({
        code: "type_mismatch",
        message: `tipo incompatible para ${resolved.path}`,
        path: resolved.path,
        blockId,
      });
    }

    return resolved.formatted ?? String(resolved.value ?? "");
  });
}

function resolveBlock(
  block: TemplateBlock,
  data: unknown,
  registry: TemplateVariableRegistry,
  warnings: TemplateResolutionWarning[],
  errors: TemplateResolutionError[]
): TemplateBlock {
  const cfg = { ...asObject(block.config) };

  if (block.type === "TEXT") {
    const content = typeof cfg.content === "string" ? cfg.content : "";
    cfg.content = resolveTextWithBraces(content, data, registry, block.id, warnings, errors);
  }

  if (block.type === "VARIABLE_TEXT") {
    const variableKey = typeof cfg.variableKey === "string" ? cfg.variableKey : "";
    const fallback = typeof cfg.fallback === "string" ? cfg.fallback : "";
    if (!variableKey) {
      errors.push({
        code: "invalid_binding",
        message: "VARIABLE_TEXT sin variableKey",
        blockId: block.id,
      });
    } else {
      const resolved = registry.resolveTemplateVariable(variableKey, data, {
        fallback: fallback || null,
      });
      if (resolved.status === "unknown") {
        warnings.push({
          code: "unknown_variable",
          message: `variable inexistente: ${variableKey}`,
          path: variableKey,
          blockId: block.id,
        });
        cfg.content = fallback || `{{${variableKey}}}`;
      } else if (
        (resolved.status === "missing" || resolved.status === "empty") &&
        !resolved.usedFallback
      ) {
        const def = registry.getVariableDefinition(resolved.path);
        if (def?.required) {
          errors.push({
            code: "required_missing",
            message: `dato obligatorio ausente: ${resolved.path}`,
            path: resolved.path,
            blockId: block.id,
          });
        }
        cfg.content = fallback || "";
      } else {
        cfg.content = resolved.formatted ?? String(resolved.value ?? fallback);
      }
    }
  }

  if (block.type === "IMAGE" || block.type === "PHOTO") {
    const source = asObject(cfg.source);
    const variableKey =
      typeof source.variableKey === "string" && source.variableKey
        ? source.variableKey
        : undefined;
    if (variableKey) {
      const resolved = registry.resolveTemplateVariable(variableKey, data);
      if (resolved.status === "resolved" && typeof resolved.value === "string" && resolved.value) {
        cfg.src = resolved.value;
        source.src = resolved.value;
        cfg.source = source;
      } else if (resolved.status === "unknown") {
        warnings.push({
          code: "unknown_variable",
          message: `variable de imagen inexistente: ${variableKey}`,
          path: variableKey,
          blockId: block.id,
        });
      } else {
        const def = registry.getVariableDefinition(resolved.path);
        if (def?.required) {
          errors.push({
            code: "required_missing",
            message: `imagen requerida ausente: ${resolved.path}`,
            path: resolved.path,
            blockId: block.id,
          });
        }
        warnings.push({
          code: "image_without_url",
          message: `imagen sin URL para ${variableKey}`,
          path: variableKey,
          blockId: block.id,
        });
      }
    } else {
      const src = typeof cfg.src === "string" ? cfg.src : "";
      if (!src && block.type === "IMAGE") {
        // Imagen estática vacía: solo warning suave si visible
        if (block.layout.visible) {
          warnings.push({
            code: "image_without_url",
            message: "bloque IMAGE sin src",
            blockId: block.id,
          });
        }
      }
    }
  }

  return { ...block, config: cfg };
}

/**
 * Resuelve un TemplateDocument contra `data` + registry.
 * No lanza por variables opcionales ausentes; acumula warnings/errors.
 */
export function resolveTemplateDocument(
  input: ResolveTemplateDocumentInput
): TemplateResolutionResult {
  const warnings: TemplateResolutionWarning[] = [];
  const errors: TemplateResolutionError[] = [];
  const { template, data, registry } = input;

  // Validar formatters en bindings
  for (const binding of template.bindings ?? []) {
    if (binding.formatter && !isKnownFormatter(binding.formatter) && binding.formatter !== "none") {
      warnings.push({
        code: "unknown_formatter",
        message: `formatter desconocido: ${binding.formatter}`,
        path: binding.variableKey,
        blockId: binding.blockId,
      });
    }
    const def = registry.getVariableDefinition(binding.variableKey);
    if (!def) {
      warnings.push({
        code: "unknown_variable",
        message: `binding.variableKey desconocido: ${binding.variableKey}`,
        path: binding.variableKey,
        blockId: binding.blockId,
      });
    }
  }

  const blocks = template.blocks.map((b) =>
    resolveBlock(b, data, registry, warnings, errors)
  );

  const document: ResolvedTemplateDocument = {
    ...template,
    blocks,
    resolvedAt: new Date().toISOString(),
  };

  return { document, warnings, errors };
}
