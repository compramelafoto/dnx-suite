import { randomUUID } from "node:crypto";
import { forkVersionMetaJsonFromCatalog } from "@/lib/template-v2/fork-template-v2-meta";

type DuplicateSourceVersionShape = {
  canvasJson?: unknown;
  metaJson?: unknown;
  blocks?: unknown[];
  assets?: unknown[];
  variableBindings?: unknown[];
};

type DuplicateSourceShape = {
  id: string;
  name: string;
  description: string | null;
  currentVersion?: DuplicateSourceVersionShape | null;
  versions?: DuplicateSourceVersionShape[] | null;
};

/**
 * Clona contenido desde `source` cargada con blocks/assets/bindings/version.
 */
export async function duplicateTemplateV2InsideTransaction(tx: Record<string, any>, opts: {
  source: DuplicateSourceShape;
  newOwnerUserId: number;
  createdByUserId: number;
  versionMetaStrategy: "copy" | "fork_from_public_catalog";
  /** Si strategy=fork_from_public_catalog, id catálogo a guardar en meta (default source.id). */
  catalogTemplateIdForMeta?: string;
  /** Nombre opcional para la nueva plantilla (reemplaza "Copia de …"). */
  customCloneName?: string | null;
}): Promise<{ templateId: string; versionId: string; name: string }> {
  const { source, newOwnerUserId, createdByUserId, versionMetaStrategy } = opts;
  const sourceVersion =
    source.currentVersion ?? source.versions?.[0];

  if (!sourceVersion || !Array.isArray(sourceVersion.blocks)) {
    throw new Error("source_version_missing");
  }

  const blocks = sourceVersion.blocks as any[];
  const bindingSource = Array.isArray(sourceVersion.variableBindings)
    ? (sourceVersion.variableBindings as any[])
    : [];

  let metaPayload: Record<string, unknown> =
    typeof sourceVersion.metaJson === "object" &&
    sourceVersion.metaJson !== null &&
    !Array.isArray(sourceVersion.metaJson)
      ? { ...(sourceVersion.metaJson as Record<string, unknown>) }
      : {};

  if (versionMetaStrategy === "fork_from_public_catalog") {
    const catalogId = opts.catalogTemplateIdForMeta ?? source.id;
    metaPayload = forkVersionMetaJsonFromCatalog(metaPayload, catalogId);
  }

  const displayName =
    typeof opts.customCloneName === "string" && opts.customCloneName.trim() !== ""
      ? opts.customCloneName.trim().slice(0, 240)
      : `Copia de ${source.name}`;

  const newTemplate = await tx.templateV2.create({
    data: {
      ownerUserId: newOwnerUserId,
      name: displayName,
      description: source.description ?? null,
      status: "DRAFT",
    },
  });

  const newVersion = await tx.templateV2Version.create({
    data: {
      templateId: newTemplate.id,
      versionNumber: 1,
      canvasJson: sourceVersion.canvasJson ?? {},
      metaJson: metaPayload,
      revision: 0,
      isLocked: false,
      createdByUserId,
    },
  });

  await tx.templateV2.update({
    where: { id: newTemplate.id },
    data: { currentVersionId: newVersion.id },
  });

  const blockIdMap = new Map<string, string>();
  for (const b of blocks) {
    blockIdMap.set(b.id, randomUUID());
  }

  if (blocks.length > 0) {
    await tx.templateV2Block.createMany({
      data: blocks.map((b: any) => ({
        id: blockIdMap.get(b.id),
        templateVersionId: newVersion.id,
        pageIndex: typeof b.pageIndex === "number" ? b.pageIndex : 0,
        type: b.type,
        name: b.name ?? null,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        rotation: b.rotation,
        zIndex: b.zIndex,
        opacity: b.opacity,
        visible: b.visible,
        configJson: b.configJson ?? {},
      })),
    });
  }

  const assetsArr = Array.isArray(sourceVersion.assets) ? (sourceVersion.assets as any[]) : [];
  if (assetsArr.length > 0) {
    await tx.templateV2Asset.createMany({
      data: assetsArr.map((a: any) => ({
        templateVersionId: newVersion.id,
        kind: a.kind,
        storageKey: a.storageKey,
        mimeType: a.mimeType ?? null,
        metaJson: a.metaJson ?? null,
      })),
    });
  }

  if (bindingSource.length > 0) {
    await tx.templateV2VariableBinding.createMany({
      data: bindingSource
        .map((vb: any) => {
          const mappedBlockId = blockIdMap.get(vb.blockId);
          if (!mappedBlockId) return null;
          return {
            id: randomUUID(),
            templateVersionId: newVersion.id,
            blockId: mappedBlockId,
            targetPath: vb.targetPath,
            variableKey: vb.variableKey,
            formatter: vb.formatter ?? null,
            fallbackOverride: vb.fallbackOverride ?? null,
          };
        })
        .filter(Boolean),
    });
  }

  await tx.templateV2Publication.create({
    data: {
      templateId: newTemplate.id,
      visibility: "PRIVATE",
      reviewStatus: "DRAFT",
    },
  });

  return {
    templateId: newTemplate.id,
    versionId: newVersion.id,
    name: newTemplate.name ?? "",
  };
}
