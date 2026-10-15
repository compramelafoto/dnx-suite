import "server-only";
import { prisma } from "@/lib/prisma";
import {
  listClientPhotoSlots,
  loadTemplateV2BlocksForVersion,
  versionRowsToLegacyPayload,
  type ClientPhotoSlot,
} from "@/lib/template-v2/server";
import type { LegacyTemplateV2Payload } from "@repo/template-engine";

/**
 * Una versión de plantilla V2 lista para armar un diseño: el documento del editor y sus huecos
 * de foto del cliente.
 *
 * Se carga sin pasar por los permisos del editor (`getTemplateV2Detail`): quien arma un diseño
 * puede ser el sistema al confirmarse un pago, sin usuario logueado. El permiso lo valida quien
 * llama (el fotógrafo dueño del álbum, o el cron).
 */
export type DesignTemplateVersion = {
  templateId: string;
  versionId: string;
  name: string;
  ownerUserId: number;
  legacy: LegacyTemplateV2Payload;
  slots: ClientPhotoSlot[];
  pageCount: number;
};

function pageCountOf(legacy: LegacyTemplateV2Payload): number {
  const meta = legacy.meta as { templatePageCount?: unknown } | undefined;
  const declared = typeof meta?.templatePageCount === "number" ? meta.templatePageCount : 0;
  const used = legacy.blocks.reduce((max, b) => Math.max(max, (b.pageIndex ?? 0) + 1), 1);
  return Math.max(1, declared, used);
}

export async function loadDesignTemplateVersion(input: {
  templateId: string;
  /** Sin versión, la actual de la plantilla. */
  versionId?: string | null;
}): Promise<DesignTemplateVersion | null> {
  const template = await prisma.templateV2.findUnique({
    where: { id: input.templateId },
    select: { id: true, name: true, ownerUserId: true, currentVersionId: true },
  });
  if (!template) return null;
  const versionId = input.versionId || template.currentVersionId;
  if (!versionId) return null;

  const version = await prisma.templateV2Version.findFirst({
    where: { id: versionId, templateId: template.id },
    select: { id: true, canvasJson: true, metaJson: true },
  });
  if (!version) return null;

  const [blocks, bindings] = await Promise.all([
    loadTemplateV2BlocksForVersion(prisma as never, version.id),
    prisma.templateV2VariableBinding.findMany({ where: { templateVersionId: version.id } }),
  ]);

  const legacy = versionRowsToLegacyPayload({
    canvasJson: version.canvasJson,
    metaJson: version.metaJson,
    blocks,
    bindings,
  });

  return {
    templateId: template.id,
    versionId: version.id,
    name: template.name,
    ownerUserId: template.ownerUserId,
    legacy,
    slots: listClientPhotoSlots(legacy.blocks, legacy.meta),
    pageCount: pageCountOf(legacy),
  };
}
