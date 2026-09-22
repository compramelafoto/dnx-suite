/**
 * Plantilla del diploma de participación.
 *
 * A diferencia de las placas de bienvenida y "Soy parte", el diploma **no
 * tiene diseño de fábrica**. Es una decisión de producto, no técnica: el
 * diploma de cada maratón es el que diseñó su dueño, nunca uno genérico. Si
 * la plantilla asignada falta, está deshabilitada, desapareció o es
 * inválida, esta función no dibuja nada: devuelve el motivo para que el
 * panel lo explique.
 */
import { prisma } from "@/lib/admin/db";
import {
  loadTemplateV2LegacyPayload,
  type TemplateV2LegacyPayload,
} from "@repo/db/template-v2-repository";
import {
  templateV2ToCardPreset,
  validateClickatonCardTemplate,
} from "@/lib/participant-cards/participant-card-template-source";
import type { ClickatonCardPreset } from "@/lib/participant-cards/participant-card-presets";
import type { DiplomaErrorCode } from "./diploma-types";

export type DiplomaTemplateAssignment = {
  templateId: string;
  versionId: string | null;
  enabled: boolean;
};

/** Forma que devuelve `loadTemplate`: la plantilla ya cargada de la base. */
export type DiplomaTemplateLoadResult = {
  template: { id: string; name: string };
  version: { id: string; versionNumber: number; revision: number; updatedAt?: Date };
  payload: TemplateV2LegacyPayload;
};

export type DiplomaTemplateDeps = {
  loadAssignment?: (input: { editionId: string }) => Promise<DiplomaTemplateAssignment | null>;
  loadTemplate?: (input: {
    templateId: string;
    versionId: string | null;
  }) => Promise<DiplomaTemplateLoadResult | null>;
};

export type DiplomaTemplateResult =
  | {
      ok: true;
      preset: ClickatonCardPreset;
      source: {
        templateId: string;
        templateName: string;
        versionId: string;
        versionNumber: number;
        revision: number;
      };
      usesParticipantPhoto: boolean;
    }
  | { ok: false; code: DiplomaErrorCode; issues: string[] };

const PHOTO_VARIABLE_PATHS = new Set(["participant.photoUrl", "participant.photo"]);
const PHOTO_BLOCK_TYPES = new Set(["PHOTO", "IMAGE"]);

/** Mismo patrón de extracción que `validateClickatonCardTemplate`: variableKey directo o en `source`. */
function variableKeysOf(configJson: Record<string, unknown>): string[] {
  const keys: string[] = [];
  if (typeof configJson.variableKey === "string" && configJson.variableKey) {
    keys.push(configJson.variableKey);
  }
  const source = configJson.source;
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const key = (source as { variableKey?: unknown }).variableKey;
    if (typeof key === "string" && key) keys.push(key);
  }
  return keys;
}

/** La plantilla usa la foto del participante si algún bloque de imagen la referencia. */
function usesParticipantPhoto(payload: TemplateV2LegacyPayload): boolean {
  for (const block of payload.blocks) {
    if (!PHOTO_BLOCK_TYPES.has(block.type)) continue;
    const configJson = (block.configJson ?? {}) as Record<string, unknown>;
    if (variableKeysOf(configJson).some((key) => PHOTO_VARIABLE_PATHS.has(key))) {
      return true;
    }
  }
  return false;
}

/**
 * Lectura real de la asignación de plantilla de diploma de una edición.
 * A diferencia de las placas, el diploma no tiene fallback: esta consulta
 * es la única fuente de verdad.
 */
async function defaultLoadAssignment(input: {
  editionId: string;
}): Promise<DiplomaTemplateAssignment | null> {
  const row = await prisma.clickatonCardTemplateAssignment.findUnique({
    where: { editionId_cardType: { editionId: input.editionId, cardType: "DIPLOMA" } },
    select: { templateId: true, versionId: true, enabled: true },
  });
  return row ?? null;
}

async function defaultLoadTemplate(input: {
  templateId: string;
  versionId: string | null;
}): Promise<DiplomaTemplateLoadResult | null> {
  const loaded = await loadTemplateV2LegacyPayload(prisma, {
    templateId: input.templateId,
    versionId: input.versionId,
  });
  if (!loaded) return null;
  return {
    template: { id: loaded.templateId, name: loaded.templateName },
    version: {
      id: loaded.versionId,
      versionNumber: loaded.versionNumber,
      revision: loaded.revision,
      updatedAt: loaded.updatedAt,
    },
    payload: loaded.payload,
  };
}

/**
 * Resuelve la plantilla del diploma de una edición.
 *
 * Nunca devuelve un preset genérico: si la asignación falta o está
 * deshabilitada, si la plantilla ya no existe, o si es inválida, `ok` es
 * `false` y el llamador no dibuja nada.
 */
export async function resolveDiplomaTemplate(
  input: { editionId: string },
  deps: DiplomaTemplateDeps = {}
): Promise<DiplomaTemplateResult> {
  const loadAssignment = deps.loadAssignment ?? defaultLoadAssignment;
  const loadTemplate = deps.loadTemplate ?? defaultLoadTemplate;

  const assignment = await loadAssignment({ editionId: input.editionId });
  if (!assignment || !assignment.enabled) {
    return { ok: false, code: "DIPLOMA_TEMPLATE_MISSING", issues: [] };
  }

  let loaded: DiplomaTemplateLoadResult | null;
  try {
    loaded = await loadTemplate({
      templateId: assignment.templateId,
      versionId: assignment.versionId,
    });
  } catch (err) {
    return {
      ok: false,
      code: "DIPLOMA_TEMPLATE_UNAVAILABLE",
      issues: [err instanceof Error ? err.message : "error desconocido"],
    };
  }
  if (!loaded) {
    return { ok: false, code: "DIPLOMA_TEMPLATE_UNAVAILABLE", issues: [] };
  }

  const issues = validateClickatonCardTemplate(loaded.payload);
  if (issues.length > 0) {
    return {
      ok: false,
      code: "DIPLOMA_TEMPLATE_INVALID",
      issues: issues.map((issue) => issue.message),
    };
  }

  return {
    ok: true,
    preset: templateV2ToCardPreset(
      {
        templateId: loaded.template.id,
        templateName: loaded.template.name,
        versionId: loaded.version.id,
        versionNumber: loaded.version.versionNumber,
        revision: loaded.version.revision,
        updatedAt: loaded.version.updatedAt,
        payload: loaded.payload,
      },
      "diploma"
    ),
    source: {
      templateId: loaded.template.id,
      templateName: loaded.template.name,
      versionId: loaded.version.id,
      versionNumber: loaded.version.versionNumber,
      revision: loaded.version.revision,
    },
    usesParticipantPhoto: usesParticipantPhoto(loaded.payload),
  };
}
