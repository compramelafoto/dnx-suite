/**
 * Origen de la plantilla de una placa de participante.
 *
 * Por defecto se usa el preset oficial del código. Si la edición tiene asignada
 * una plantilla del editor visual (Template V2), se usa esa.
 *
 * Regla central: **ante cualquier duda se vuelve al preset**. Una plantilla mal
 * armada no puede dejar sin placa a un participante que ya pagó; el motivo
 * queda en `warnings` para que el panel lo muestre.
 */
import {
  createTemplateVariableRegistry,
  clickatonTemplateVariablesPlugin,
  type LegacyTemplateV2Payload,
} from "@repo/template-engine";
import {
  loadTemplateV2LegacyPayload,
  type TemplateV2LegacyPayload,
  type TemplateV2LoadResult,
} from "@repo/db/template-v2-repository";
import { prisma } from "@/lib/admin/db";
import {
  getClickatonParticipantCardPreset,
  type ClickatonCardPreset,
} from "./participant-card-presets";
import type { ClickatonParticipantCardType } from "./participant-card-types";

const DB_CARD_TYPE = { welcome: "WELCOME", member: "MEMBER" } as const;

/** Bloques que el motor sabe renderizar. */
const SUPPORTED_BLOCK_TYPES = [
  "BACKGROUND",
  "PHOTO",
  "TEXT",
  "VARIABLE_TEXT",
  "IMAGE",
  "SHAPE",
] as const;

type SupportedBlockType = (typeof SUPPORTED_BLOCK_TYPES)[number];

function isSupportedBlockType(type: string): type is SupportedBlockType {
  return (SUPPORTED_BLOCK_TYPES as readonly string[]).includes(type);
}

export type ParticipantCardTemplateOrigin = "preset" | "template_v2";

export type ResolvedParticipantCardTemplate = {
  origin: ParticipantCardTemplateOrigin;
  preset: ClickatonCardPreset;
  /** Presente sólo cuando `origin === "template_v2"`. */
  source?: {
    templateId: string;
    templateName: string;
    versionId: string;
    versionNumber: number;
    revision: number;
  };
  /** Por qué se ignoró la plantilla asignada, si se ignoró. */
  warnings: string[];
};

export type ParticipantCardTemplateIssue = {
  code:
    | "TEMPLATE_NOT_FOUND"
    | "NO_BLOCKS"
    | "UNSUPPORTED_BLOCK"
    | "UNKNOWN_VARIABLE"
    | "CANVAS_INVALID";
  message: string;
};

/**
 * Verifica que la plantilla se pueda renderizar con los datos de Clickatón.
 * No mira `meta.product`: lo que importa es que sus variables existan en el
 * vocabulario de Clickatón, que es lo que realmente se va a resolver.
 */
export function validateClickatonCardTemplate(
  payload: TemplateV2LegacyPayload
): ParticipantCardTemplateIssue[] {
  const issues: ParticipantCardTemplateIssue[] = [];

  const width = payload.canvas?.width ?? 0;
  const height = payload.canvas?.height ?? 0;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    issues.push({
      code: "CANVAS_INVALID",
      message: `Medidas de lienzo inválidas (${width}×${height})`,
    });
  }

  if (!payload.blocks || payload.blocks.length === 0) {
    issues.push({ code: "NO_BLOCKS", message: "La plantilla no tiene bloques" });
    return issues;
  }

  for (const block of payload.blocks) {
    if (!isSupportedBlockType(block.type)) {
      issues.push({
        code: "UNSUPPORTED_BLOCK",
        message: `Bloque no soportado: ${block.type}`,
      });
    }
  }

  const registry = createTemplateVariableRegistry({
    plugins: [clickatonTemplateVariablesPlugin],
  });
  const known = new Set(registry.listVariableDefinitions().map((d) => d.path));

  const usedKeys = new Set<string>();
  for (const block of payload.blocks) {
    const cfg = (block.configJson ?? {}) as Record<string, unknown>;
    if (typeof cfg.variableKey === "string" && cfg.variableKey) {
      usedKeys.add(cfg.variableKey);
    }
    const source = cfg.source;
    if (source && typeof source === "object" && !Array.isArray(source)) {
      const key = (source as { variableKey?: unknown }).variableKey;
      if (typeof key === "string" && key) usedKeys.add(key);
    }
  }
  for (const binding of payload.variableBindings ?? []) {
    if (binding.variableKey) usedKeys.add(binding.variableKey);
  }

  for (const key of usedKeys) {
    if (!known.has(key)) {
      issues.push({
        code: "UNKNOWN_VARIABLE",
        message: `Variable desconocida para Clickatón: ${key}`,
      });
    }
  }

  return issues;
}

/**
 * Convierte el payload de la base al tipo estricto del motor.
 * Sólo debe llamarse tras `validateClickatonCardTemplate`, que garantiza que
 * todos los tipos de bloque son soportados.
 */
function toEnginePayload(payload: TemplateV2LegacyPayload): LegacyTemplateV2Payload {
  return {
    canvas: payload.canvas,
    blocks: payload.blocks.flatMap((block) => {
      if (!isSupportedBlockType(block.type)) return [];
      return [
        {
          id: block.id,
          type: block.type,
          name: block.name,
          pageIndex: block.pageIndex ?? 0,
          layout: {
            x: block.layout.x,
            y: block.layout.y,
            width: block.layout.width,
            height: block.layout.height,
            rotation: block.layout.rotation ?? 0,
            zIndex: block.layout.zIndex ?? 0,
            opacity: block.layout.opacity ?? 1,
            locked: block.layout.locked ?? false,
            visible: block.layout.visible ?? true,
          },
          configJson: block.configJson,
        },
      ];
    }),
    variableBindings: payload.variableBindings ?? [],
    meta: payload.meta ?? {},
  };
}

/** Envuelve el payload de la base en la forma de preset que espera el pipeline. */
export function templateV2ToCardPreset(
  loaded: TemplateV2LoadResult,
  cardType: ClickatonParticipantCardType
): ClickatonCardPreset {
  return {
    presetId: `template-v2:${loaded.templateId}:${loaded.versionId}`,
    name: loaded.templateName,
    description: `Plantilla del editor visual (v${loaded.versionNumber}, rev ${loaded.revision})`,
    meta: {
      product: "clickaton",
      templateKey: `TEMPLATE_V2_${cardType.toUpperCase()}`,
      templateVersion: loaded.versionNumber,
      format: "instagram_story",
      purpose:
        cardType === "welcome" ? "participant_welcome" : "participant_member",
      status: "published",
      createdAt: loaded.updatedAt.toISOString().slice(0, 10),
      official: true,
    },
    payload: toEnginePayload(loaded.payload),
  };
}

export type ParticipantCardTemplateDeps = {
  loadAssignment?: (input: {
    editionId: string;
    cardType: ClickatonParticipantCardType;
  }) => Promise<{ templateId: string; versionId: string | null; enabled: boolean } | null>;
  loadTemplate?: (input: {
    templateId: string;
    versionId: string | null;
  }) => Promise<TemplateV2LoadResult | null>;
};

async function defaultLoadAssignment(input: {
  editionId: string;
  cardType: ClickatonParticipantCardType;
}) {
  const row = await prisma.clickatonCardTemplateAssignment.findUnique({
    where: {
      editionId_cardType: {
        editionId: input.editionId,
        cardType: DB_CARD_TYPE[input.cardType],
      },
    },
    select: { templateId: true, versionId: true, enabled: true },
  });
  return row;
}

async function defaultLoadTemplate(input: {
  templateId: string;
  versionId: string | null;
}) {
  return loadTemplateV2LegacyPayload(prisma, {
    templateId: input.templateId,
    versionId: input.versionId,
  });
}

/**
 * Devuelve la plantilla a usar para una placa.
 * `editionId` ausente (o sin asignación) → preset del código.
 */
export async function resolveParticipantCardTemplate(
  input: {
    cardType: ClickatonParticipantCardType;
    editionId?: string | null;
  },
  deps: ParticipantCardTemplateDeps = {}
): Promise<ResolvedParticipantCardTemplate> {
  const fallback = (): ResolvedParticipantCardTemplate => ({
    origin: "preset",
    preset: getClickatonParticipantCardPreset(input.cardType),
    warnings: [],
  });

  if (!input.editionId) return fallback();

  const loadAssignment = deps.loadAssignment ?? defaultLoadAssignment;
  const loadTemplate = deps.loadTemplate ?? defaultLoadTemplate;

  let assignment: Awaited<ReturnType<typeof defaultLoadAssignment>>;
  try {
    assignment = await loadAssignment({
      editionId: input.editionId,
      cardType: input.cardType,
    });
  } catch (err) {
    return {
      ...fallback(),
      warnings: [
        `No se pudo leer la plantilla asignada: ${
          err instanceof Error ? err.message : "error desconocido"
        }`,
      ],
    };
  }

  if (!assignment || !assignment.enabled) return fallback();

  let loaded: TemplateV2LoadResult | null;
  try {
    loaded = await loadTemplate({
      templateId: assignment.templateId,
      versionId: assignment.versionId,
    });
  } catch (err) {
    return {
      ...fallback(),
      warnings: [
        `No se pudo cargar la plantilla ${assignment.templateId}: ${
          err instanceof Error ? err.message : "error desconocido"
        }`,
      ],
    };
  }

  if (!loaded) {
    return {
      ...fallback(),
      warnings: [
        `La plantilla asignada ya no existe (${assignment.templateId}); se usa el diseño oficial`,
      ],
    };
  }

  const issues = validateClickatonCardTemplate(loaded.payload);
  if (issues.length > 0) {
    return {
      ...fallback(),
      warnings: [
        `Plantilla «${loaded.templateName}» no utilizable; se usa el diseño oficial: ` +
          issues.map((i) => i.message).join(" · "),
      ],
    };
  }

  return {
    origin: "template_v2",
    preset: templateV2ToCardPreset(loaded, input.cardType),
    source: {
      templateId: loaded.templateId,
      templateName: loaded.templateName,
      versionId: loaded.versionId,
      versionNumber: loaded.versionNumber,
      revision: loaded.revision,
    },
    warnings: [],
  };
}
