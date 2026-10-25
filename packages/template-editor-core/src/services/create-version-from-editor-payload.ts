import { randomUUID } from "node:crypto";
import type { TemplateV2SavePayloadCore } from "../validate-save-payload";
import { normalizeBlockConfig } from "../render-core";
import {
  mergeServerOwnedMeta,
  type TemplateV2PrivateCopy,
  type TemplateV2VersionOriginReason,
} from "../template-v2-version-lineage";

export type CreateTemplateV2VersionFromPayloadResult = {
  newVersionId: string;
  versionNumber: number;
  revision: number;
  updatedAt: Date;
  /** id que mandó el editor → id nuevo, para todos los bloques del payload. */
  blockIdMap: Record<string, string>;
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
    /** Por qué nace la versión: queda anotado en su meta junto con el mapa de bloques. */
    reason?: TemplateV2VersionOriginReason;
    /** Si es la copia privada de un diseño, de quién. */
    privateCopy?: TemplateV2PrivateCopy | null;
    /** Pasa a ser la versión vigente de la plantilla (sí, salvo las copias privadas). */
    setAsCurrent?: boolean;
  }
): Promise<CreateTemplateV2VersionFromPayloadResult> {
  const { templateId, branchFromVersionId, userId, payload } = args;
  const setAsCurrent = args.setAsCurrent ?? !args.privateCopy;

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

  // Sólo los bloques que ya estaban en la versión de origen sirven para pasar diseños de una a la
  // otra; los que el editor agregó recién no tienen a quién corresponder.
  const branchBlocks: { id: string }[] = await tx.templateV2Block.findMany({
    where: { templateVersionId: branchFromVersionId },
    select: { id: true },
  });
  const lineageMap: Record<string, string> = {};
  for (const { id } of branchBlocks) {
    const mapped = blockIdMap.get(id);
    if (mapped) lineageMap[id] = mapped;
  }
  const metaJson = mergeServerOwnedMeta(payload.meta, null, {
    origenDeVersion: {
      versionId: branchFromVersionId,
      blockIdMap: lineageMap,
      at: new Date().toISOString(),
      reason: args.reason ?? "nueva-version",
    },
    copiaPrivada: args.privateCopy ?? null,
  });

  const newVersion = await tx.templateV2Version.create({
    data: {
      templateId,
      versionNumber: nextVersionNumber,
      canvasJson: payload.canvas as object,
      metaJson: metaJson as object,
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
    data: setAsCurrent ? { currentVersionId: newVersion.id } : { updatedAt: new Date() },
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
    blockIdMap: Object.fromEntries(blockIdMap),
  };
}

/**
 * Copia una versión tal como está en la base a una versión nueva de la misma plantilla que es de
 * un solo dueño (p. ej. un diseño que se retoca a mano). No pasa a ser la vigente, no aparece en
 * la lista de versiones y anota el mapa de bloques para poder traducir lo que apuntaba a la
 * original.
 */
export async function copyTemplateV2VersionAsPrivate(
  tx: any,
  args: {
    templateId: string;
    versionId: string;
    userId: number;
    privateCopy: TemplateV2PrivateCopy;
  }
): Promise<{ newVersionId: string; versionNumber: number; blockIdMap: Record<string, string> }> {
  const source = await tx.templateV2Version.findFirst({
    where: { id: args.versionId, templateId: args.templateId },
    select: { id: true, canvasJson: true, metaJson: true },
  });
  if (!source) {
    throw Object.assign(new Error("version_not_found"), { code: "version_not_found" });
  }
  const [blocks, bindings, assets] = await Promise.all([
    tx.templateV2Block.findMany({ where: { templateVersionId: source.id } }),
    tx.templateV2VariableBinding.findMany({ where: { templateVersionId: source.id } }),
    tx.templateV2Asset.findMany({ where: { templateVersionId: source.id } }),
  ]);

  const agg = await tx.templateV2Version.aggregate({
    where: { templateId: args.templateId },
    _max: { versionNumber: true },
  });
  const versionNumber = (agg._max.versionNumber ?? 0) + 1;

  const blockIdMap: Record<string, string> = {};
  for (const b of blocks as { id: string }[]) blockIdMap[b.id] = randomUUID();

  const metaJson = mergeServerOwnedMeta(source.metaJson, null, {
    origenDeVersion: {
      versionId: source.id,
      blockIdMap,
      at: new Date().toISOString(),
      reason: "copia-privada",
    },
    copiaPrivada: args.privateCopy,
  });

  const created = await tx.templateV2Version.create({
    data: {
      templateId: args.templateId,
      versionNumber,
      canvasJson: source.canvasJson ?? {},
      metaJson: metaJson as object,
      revision: 0,
      isLocked: false,
      createdByUserId: args.userId,
    },
  });

  if (blocks.length > 0) {
    await tx.templateV2Block.createMany({
      data: (blocks as Record<string, unknown>[]).map((b) => ({
        id: blockIdMap[b.id as string],
        templateVersionId: created.id,
        pageIndex: b.pageIndex ?? 0,
        type: b.type,
        name: b.name ?? null,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        rotation: b.rotation,
        zIndex: b.zIndex,
        opacity: b.opacity,
        locked: b.locked,
        visible: b.visible,
        configJson: b.configJson ?? {},
      })),
    });
  }
  if (bindings.length > 0) {
    await tx.templateV2VariableBinding.createMany({
      data: (bindings as Record<string, unknown>[]).map((vb, index) => ({
        id: `vb-${created.id}-${index + 1}`,
        templateVersionId: created.id,
        blockId: blockIdMap[vb.blockId as string] ?? (vb.blockId as string),
        targetPath: vb.targetPath,
        variableKey: vb.variableKey,
        formatter: vb.formatter ?? null,
        fallbackOverride: vb.fallbackOverride ?? null,
      })),
    });
  }
  if (assets.length > 0) {
    await tx.templateV2Asset.createMany({
      data: (assets as Record<string, unknown>[]).map((a) => ({
        templateVersionId: created.id,
        kind: a.kind,
        storageKey: a.storageKey,
        mimeType: a.mimeType ?? null,
        metaJson: a.metaJson ?? null,
      })),
    });
  }

  return { newVersionId: created.id, versionNumber, blockIdMap };
}
