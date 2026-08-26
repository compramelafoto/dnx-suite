/**
 * Compatibilidad mínima con @repo/template-engine (P0-02).
 *
 * NO reemplaza el flujo productivo del editor ni school-render.
 * Expone helpers puros para validación/bridge y tests de smoke.
 */

import {
  createTemplateVariableRegistry,
  fromLegacyTemplateV2,
  parseTemplateBinding,
  parseTemplateDocument,
  resolveTemplateDocument,
  schoolTemplateVariablesPlugin,
  toLegacyTemplateV2,
  type LegacyTemplateV2Payload,
  type TemplateDocument,
  type TemplateResolutionResult,
  type TemplateVariableRegistry,
} from "@repo/template-engine";

/** Registry escolar compartido (catálogo + aliases). Sin I/O. */
export function createSchoolTemplateEngineRegistry(): TemplateVariableRegistry {
  return createTemplateVariableRegistry([schoolTemplateVariablesPlugin]);
}

/**
 * Valida que un payload legacy V2 pueda convertirse al schema canónico
 * y volver (round-trip estructural). No persiste ni renderiza.
 */
export function assertLegacyTemplateV2EngineCompat(
  payload: LegacyTemplateV2Payload,
  options?: { name?: string; id?: string }
): {
  ok: boolean;
  document: TemplateDocument | null;
  roundTrip: LegacyTemplateV2Payload | null;
  parseOk: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  try {
    const { document } = fromLegacyTemplateV2(payload, options);
    const parsed = parseTemplateDocument(document);
    if (!parsed.ok) {
      errors.push(parsed.error);
      return { ok: false, document: null, roundTrip: null, parseOk: false, errors };
    }
    const { payload: roundTrip } = toLegacyTemplateV2(parsed.data);
    return {
      ok: true,
      document: parsed.data,
      roundTrip,
      parseOk: true,
      errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { ok: false, document: null, roundTrip: null, parseOk: false, errors };
  }
}

/** Resuelve un documento canónico con datos ya materializados. */
export function resolveSchoolTemplateDocument(
  template: TemplateDocument,
  data: unknown,
  registry: TemplateVariableRegistry = createSchoolTemplateEngineRegistry()
): TemplateResolutionResult {
  return resolveTemplateDocument({ template, data, registry });
}

/** Parser de binding compartido (smoke / futuros usos). */
export { parseTemplateBinding };
