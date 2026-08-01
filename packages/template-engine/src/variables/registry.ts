import { normalizeBraceSlug } from "../bindings/parse";
import { applyFormatter } from "./formatters";
import { isEmptyValue, safeGetByPath } from "./resolve-path";
import type {
  ResolveVariableResult,
  TemplateVariableDefinition,
  TemplateVariablePlugin,
} from "./types";

export type TemplateVariableRegistry = {
  listVariableDefinitions: () => TemplateVariableDefinition[];
  getVariableDefinition: (path: string) => TemplateVariableDefinition | undefined;
  registerVariableDefinitions: (defs: TemplateVariableDefinition[]) => void;
  registerPlugin: (plugin: TemplateVariablePlugin) => void;
  getAliases: () => Record<string, string>;
  resolvePathFromAlias: (token: string) => string | undefined;
  resolveTemplateVariable: (
    pathOrAlias: string,
    data: unknown,
    opts?: { formatter?: string; fallback?: string | null }
  ) => ResolveVariableResult;
};

export type CreateRegistryOptions = {
  plugins?: TemplateVariablePlugin[];
  /** Si true, paths duplicados lanzan. Default: true. */
  throwOnDuplicatePath?: boolean;
  /** Si true, alias conflictivos lanzan. Default: true. */
  throwOnAliasConflict?: boolean;
};

export function createTemplateVariableRegistry(
  pluginsOrOptions?: TemplateVariablePlugin[] | CreateRegistryOptions
): TemplateVariableRegistry {
  const options: CreateRegistryOptions = Array.isArray(pluginsOrOptions)
    ? { plugins: pluginsOrOptions }
    : (pluginsOrOptions ?? {});

  const throwOnDuplicatePath = options.throwOnDuplicatePath !== false;
  const throwOnAliasConflict = options.throwOnAliasConflict !== false;

  const byPath = new Map<string, TemplateVariableDefinition>();
  const aliases = new Map<string, string>();

  function registerAlias(alias: string, path: string, source: string) {
    const slug = normalizeBraceSlug(alias);
    if (!slug) return;
    const existing = aliases.get(slug);
    if (existing && existing !== path) {
      if (throwOnAliasConflict) {
        throw new Error(
          `alias conflict: "${slug}" → "${existing}" vs "${path}" (from ${source})`
        );
      }
      return;
    }
    aliases.set(slug, path);
  }

  function registerVariableDefinitions(defs: TemplateVariableDefinition[]) {
    for (const def of defs) {
      if (!def.path || typeof def.path !== "string") {
        throw new Error("variable definition sin path");
      }
      if (byPath.has(def.path)) {
        if (throwOnDuplicatePath) {
          throw new Error(`duplicate variable path: ${def.path}`);
        }
        continue;
      }
      byPath.set(def.path, def);
      for (const a of def.aliases ?? []) {
        registerAlias(a, def.path, def.path);
      }
    }
  }

  function registerPlugin(plugin: TemplateVariablePlugin) {
    registerVariableDefinitions(plugin.definitions);
    if (plugin.aliases) {
      for (const [alias, path] of Object.entries(plugin.aliases)) {
        registerAlias(alias, path, plugin.id);
      }
    }
  }

  for (const plugin of options.plugins ?? []) {
    registerPlugin(plugin);
  }

  function getVariableDefinition(path: string): TemplateVariableDefinition | undefined {
    return byPath.get(path);
  }

  function resolvePathFromAlias(token: string): string | undefined {
    const trimmed = token.trim();
    if (byPath.has(trimmed)) return trimmed;
    const slug = normalizeBraceSlug(trimmed);
    if (aliases.has(slug)) return aliases.get(slug);
    // compact match
    for (const path of byPath.keys()) {
      if (normalizeBraceSlug(path.replace(/\./g, "")) === slug) return path;
    }
    return undefined;
  }

  function resolveTemplateVariable(
    pathOrAlias: string,
    data: unknown,
    opts?: { formatter?: string; fallback?: string | null }
  ): ResolveVariableResult {
    const canonical = resolvePathFromAlias(pathOrAlias) ?? pathOrAlias;
    const aliasUsed =
      normalizeBraceSlug(pathOrAlias) !== normalizeBraceSlug(canonical)
        ? normalizeBraceSlug(pathOrAlias)
        : undefined;

    const got = safeGetByPath(data, canonical);
    if (!got.ok) {
      return {
        status: "unsafe_path",
        path: canonical,
        value: undefined,
        aliasUsed,
      };
    }

    const definition = getVariableDefinition(canonical);
    const formatter = opts?.formatter ?? definition?.formatter ?? "none";
    const fallback =
      opts?.fallback !== undefined
        ? opts.fallback
        : (definition?.defaultFallback ?? null);

    if (!definition && !got.found) {
      return {
        status: "unknown",
        path: canonical,
        value: undefined,
        aliasUsed,
      };
    }

    if (!got.found || isEmptyValue(got.value)) {
      if (fallback != null && String(fallback).trim() !== "") {
        const { text, unknownFormatter } = applyFormatter(fallback, formatter);
        return {
          status: got.found ? "empty" : "missing",
          path: canonical,
          value: fallback,
          formatted: unknownFormatter ? String(fallback) : text,
          usedFallback: true,
          aliasUsed,
          definition,
        };
      }
      return {
        status: got.found ? "empty" : "missing",
        path: canonical,
        value: got.found ? got.value : undefined,
        aliasUsed,
        definition,
      };
    }

    // Type soft-check
    if (definition) {
      const mismatch = softTypeMismatch(definition.valueType, got.value);
      if (mismatch) {
        const { text } = applyFormatter(got.value, formatter);
        return {
          status: "type_mismatch",
          path: canonical,
          value: got.value,
          formatted: text,
          aliasUsed,
          definition,
        };
      }
    }

    const { text, unknownFormatter } = applyFormatter(got.value, formatter);
    return {
      status: "resolved",
      path: canonical,
      value: got.value,
      formatted: unknownFormatter ? String(got.value) : text,
      usedFallback: false,
      aliasUsed,
      definition,
    };
  }

  return {
    listVariableDefinitions: () => Array.from(byPath.values()),
    getVariableDefinition,
    registerVariableDefinitions,
    registerPlugin,
    getAliases: () => Object.fromEntries(aliases.entries()),
    resolvePathFromAlias,
    resolveTemplateVariable,
  };
}

function softTypeMismatch(
  valueType: TemplateVariableDefinition["valueType"],
  value: unknown
): boolean {
  if (value == null) return false;
  switch (valueType) {
    case "number":
      return typeof value !== "number" || !Number.isFinite(value);
    case "boolean":
      return typeof value !== "boolean";
    case "image":
    case "qrUrl":
    case "text":
    case "date":
      // date puede ser string formateado o Date
      if (valueType === "date") {
        return !(value instanceof Date || typeof value === "string" || typeof value === "number");
      }
      return typeof value !== "string" && typeof value !== "number";
    default:
      return false;
  }
}

/** Alias de API pedido en el brief. */
export function registerVariableDefinitions(
  registry: TemplateVariableRegistry,
  defs: TemplateVariableDefinition[]
): void {
  registry.registerVariableDefinitions(defs);
}

export function getVariableDefinition(
  registry: TemplateVariableRegistry,
  path: string
): TemplateVariableDefinition | undefined {
  return registry.getVariableDefinition(path);
}

export function listVariableDefinitions(
  registry: TemplateVariableRegistry
): TemplateVariableDefinition[] {
  return registry.listVariableDefinitions();
}

export function resolveTemplateVariable(
  registry: TemplateVariableRegistry,
  pathOrAlias: string,
  data: unknown,
  opts?: { formatter?: string; fallback?: string | null }
): ResolveVariableResult {
  return registry.resolveTemplateVariable(pathOrAlias, data, opts);
}
