import { randomUUID } from "node:crypto";
import type { TemplateV2SavePayloadCore } from "@/lib/template-v2/validate-save-payload";
import { normalizeBlockConfig } from "@/lib/template-v2/render-core";

export type CreateTemplateV2VersionFromPayloadResult = {
  newVersionId: string;
  versionNumber: number;
  revision: number;
  updatedAt: Date;
};

/**
 * Crea una nueva fila TemplateV2Version con bloques/bindings desde el payload del editor,
 * remapeando IDs de bloque (ids son únicos globalmente en TemplateV2Block).
 * Copia assets desde branchFromVersionId (mismos storageKey que en clone).
 */
export async function createTemplateV2VersionFromEditorPayload(
  tx: any,
  args: {
    templateId: string;
    branchFromVersionId: string;
    userId: number;
    payload: TemplateV2SavePayloadCore;
  }
): Promise<CreateTemplateV2VersionFromPayloadResult> {
  const { templateId, branchFromVersionId, userId, payload } = args;

  const branch = await tx.templateV2Version.findFirst({
    where: { id: branchFromVersionId, templateId },
    select: { id: true },
  });
  if (!branch) {
    throw Object.assign(new Error("branch_version_not_found"), { code: "branch_version_not_found" });
  }

  const agg = await tx.templateV2Version.aggregate({
    where: { templateId },
    _max: { versionNumber: true },
  });
  const nextVersionNumber = (agg._max.versionNumber ?? 0) + 1;

  const blockIdMap = new Map<string, string>();
  for (const block of payload.blocks) {
    blockIdMap.set(block.id, randomUUID());
  }

  const newVersion = await tx.templateV2Version.create({
    data: {
      templateId,
      versionNumber: nextVersionNumber,
      canvasJson: payload.canvas as object,
      metaJson: payload.meta as object,
      revision: 0,
      isLocked: false,
      createdByUserId: userId,
    },
  });

  const { blocks, variableBindings } = payload;

  if (blocks.length > 0) {
    await tx.templateV2Block.createMany({
      data: blocks.map((block) => {
        const newId = blockIdMap.get(block.id);
        if (!newId) {
          throw new Error("block id map inconsistente");
        }
        const normalizedConfig = normalizeBlockConfig(block.type, block.configJson);
        return {
          id: newId,
          templateVersionId: newVersion.id,
          pageIndex: block.pageIndex ?? 0,
          type: block.type,
          name: block.name ?? null,
          x: block.layout.x,
          y: block.layout.y,
          width: block.layout.width,
          height: block.layout.height,
          rotation: block.layout.rotation,
          zIndex: block.layout.zIndex,
          opacity: block.layout.opacity,
          locked: block.layout.locked ?? false,
          visible: block.layout.visible,
          configJson: normalizedConfig as object,
        };
      }),
    });
  }

  const assets = await tx.templateV2Asset.findMany({
    where: { templateVersionId: branchFromVersionId },
  });
  if (assets.length > 0) {
    await tx.templateV2Asset.createMany({
      data: assets.map((a: { kind: unknown; storageKey: string; mimeType: string | null; metaJson: unknown }) => ({
        templateVersionId: newVersion.id,
        kind: a.kind,
        storageKey: a.storageKey,
        mimeType: a.mimeType ?? null,
        metaJson: a.metaJson ?? null,
      })),
    });
  }

  if (variableBindings.length > 0) {
    await tx.templateV2VariableBinding.createMany({
      data: variableBindings.map((binding, index) => {
        const mappedBlockId = blockIdMap.get(binding.blockId);
        if (!mappedBlockId) {
          throw new Error("binding blockId no mapeado");
        }
        const id = `vb-${newVersion.id}-${index + 1}`;
        return {
          id,
          templateVersionId: newVersion.id,
          blockId: mappedBlockId,
          targetPath: binding.targetPath,
          variableKey: binding.variableKey,
          formatter: binding.formatter ?? null,
          fallbackOverride: binding.fallbackOverride ?? null,
        };
      }),
    });
  }

  await tx.templateV2.update({
    where: { id: templateId },
    data: { currentVersionId: newVersion.id },
  });

  const refreshed = await tx.templateV2Version.findUnique({
    where: { id: newVersion.id },
    select: { updatedAt: true },
  });

  return {
    newVersionId: newVersion.id,
    versionNumber: nextVersionNumber,
    revision: 0,
    updatedAt: refreshed?.updatedAt ?? new Date(),
  };
}
