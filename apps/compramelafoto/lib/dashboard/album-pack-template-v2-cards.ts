import { prisma } from "@/lib/prisma";
import { isTemplateDesignerMetaV2 } from "@/lib/dashboard/template-v2-design-meta";

export type AlbumPackTemplateV2Card = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  preview: { width: number; height: number; background: string | null };
  /** Fotógrafo puede editar; no es entrada del catálogo “oficial”. */
  kind: "owned" | "catalog";
};

function pickThumbFromMeta(metaJson: unknown): string | null {
  if (!metaJson || typeof metaJson !== "object") return null;
  const m = metaJson as Record<string, unknown>;
  for (const key of ["thumbnailUrl", "previewThumbUrl", "previewUrl"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

function parsePreviewFromCanvas(canvasJson: unknown): { width: number; height: number; background: string | null } {
  if (!canvasJson || typeof canvasJson !== "object") {
    return { width: 3, height: 4, background: "#f1f5f9" };
  }
  const c = canvasJson as Record<string, unknown>;
  const w = typeof c.width === "number" && Number.isFinite(c.width) ? c.width : 1200;
  const h = typeof c.height === "number" && Number.isFinite(c.height) ? c.height : 1800;
  const bg =
    typeof c.background === "string" && c.background.trim() !== ""
      ? c.background.trim()
      : "#f1f5f9";
  return { width: w, height: h, background: bg };
}

async function hydrateTemplateV2Cards(
  templates: Array<{
    id: string;
    name: string;
    currentVersionId: string | null;
  }>,
  kind: AlbumPackTemplateV2Card["kind"]
): Promise<AlbumPackTemplateV2Card[]> {
  const vidSet = [...new Set(templates.map((t) => t.currentVersionId).filter(Boolean))] as string[];
  if (vidSet.length === 0) return [];

  const versions = await prisma.templateV2Version.findMany({
    where: { id: { in: vidSet } },
    select: { id: true, canvasJson: true, metaJson: true },
  });
  const vById = new Map(versions.map((v) => [v.id, v]));

  return templates.map((row) => {
    const vid = row.currentVersionId ?? undefined;
    const vRow = vid ? vById.get(vid) : undefined;
    const metaJson = vRow?.metaJson ?? null;
    const canvasJson = vRow?.canvasJson ?? null;
    const v2Designer = isTemplateDesignerMetaV2(metaJson ?? undefined);
    if (!v2Designer) {
      return {
        id: row.id,
        name: row.name,
        thumbnailUrl: null,
        preview: parsePreviewFromCanvas(null),
        kind,
      };
    }

    const preview = parsePreviewFromCanvas(canvasJson);
    const thumbnailUrl = pickThumbFromMeta(metaJson ?? undefined);
    return {
      id: row.id,
      name: row.name,
      thumbnailUrl,
      preview,
      kind,
    };
  });
}

export async function listAlbumPackTemplateV2CardGroups(params: {
  ownerUserId: number;
}): Promise<{ templatesV2Owned: AlbumPackTemplateV2Card[]; templatesV2Catalog: AlbumPackTemplateV2Card[] }> {
  const publicRows = await prisma.templateV2Publication.findMany({
    where: { reviewStatus: "APPROVED", visibility: "PUBLIC" },
    select: { templateId: true },
  });
  const publicIdSet = new Set(publicRows.map((r) => r.templateId));

  const ownedRows = await prisma.templateV2.findMany({
    where: { ownerUserId: params.ownerUserId },
    select: { id: true, name: true, currentVersionId: true },
    orderBy: { name: "asc" },
  });

  const catalogRowsRaw =
    publicIdSet.size > 0 ?
      await prisma.templateV2.findMany({
        where: {
          id: { in: [...publicIdSet] },
          ownerUserId: { not: params.ownerUserId },
        },
        select: { id: true, name: true, currentVersionId: true },
        orderBy: { name: "asc" },
      })
    : [];

  const templatesV2Owned = await hydrateTemplateV2Cards(ownedRows, "owned");
  const templatesV2Catalog = await hydrateTemplateV2Cards(catalogRowsRaw, "catalog");

  return { templatesV2Owned, templatesV2Catalog };
}
