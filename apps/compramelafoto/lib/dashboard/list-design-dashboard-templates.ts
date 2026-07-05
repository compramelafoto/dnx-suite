import type { Role, TemplateV2Status } from "@/lib/prisma";
import { Role as RoleEnum } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { isTemplateDesignerMetaV2, isTemplateSystemFlagInMeta } from "@/lib/dashboard/template-v2-design-meta";

export type DesignDashboardTemplateCard = {
  id: string;
  ownerUserId: number;
  isOwnedByViewer: boolean;
  name: string;
  description: string | null;
  status: TemplateV2Status;
  currentVersionId: string | null;
  thumbnailUrl: string | null;
  preview: { width: number; height: number; background: string | null };
  tipoLabel: string;
  publication: {
    reviewStatus: string;
    visibility: string;
  } | null;
  isSystemCatalog: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
};

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

function pickThumbFromMeta(metaJson: unknown): string | null {
  if (!metaJson || typeof metaJson !== "object") return null;
  const m = metaJson as Record<string, unknown>;
  for (const key of ["thumbnailUrl", "previewThumbUrl", "previewUrl"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

function statusLabel(status: TemplateV2Status): string {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "ARCHIVED":
      return "Archivada";
    case "DRAFT":
    default:
      return "Borrador";
  }
}

type TemplateRow = {
  id: string;
  ownerUserId: number;
  name: string;
  description: string | null;
  status: TemplateV2Status;
  currentVersionId: string | null;
  updatedAt: Date;
};

type VersionMetaRow = Map<string, { canvasJson: unknown; metaJson: unknown | null }>;

function cvMeta(metaByVersionId: VersionMetaRow, currentVersionId: string | null): unknown | null {
  if (!currentVersionId) return null;
  return metaByVersionId.get(currentVersionId)?.metaJson ?? null;
}

/**
 * Dashboard `/dashboard/designs`:
 * - Sistema: `meta.system`, diseño ≠ v1, PUBLIC+APPROVED.
 * - Mías: mismo criterio v2 por meta, sin flag sistema, dueña del usuario.
 * - Admin todas: todas las filas TemplateV2 con meta de diseño v2.
 */
export async function listDesignDashboardTemplateGroups(params: {
  userId: number;
  role: Role;
}): Promise<{
  systemTemplates: DesignDashboardTemplateCard[];
  userTemplates: DesignDashboardTemplateCard[];
  adminAllTemplates: DesignDashboardTemplateCard[];
  isAdmin: boolean;
}> {
  const isAdmin = params.role === RoleEnum.ADMIN;

  const pubApproved = await prisma.templateV2Publication.findMany({
    where: { reviewStatus: "APPROVED", visibility: "PUBLIC" },
    select: { templateId: true },
  });
  const pubApprovedSet = new Set(pubApproved.map((p) => p.templateId));

  const templateRows: TemplateRow[] =
    isAdmin ?
      await prisma.templateV2.findMany({
        select: {
          id: true,
          ownerUserId: true,
          name: true,
          description: true,
          status: true,
          currentVersionId: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: "desc" }],
      })
    : await prisma.templateV2.findMany({
        where: {
          OR: [{ ownerUserId: params.userId }, { id: { in: [...pubApprovedSet] } }],
        },
        select: {
          id: true,
          ownerUserId: true,
          name: true,
          description: true,
          status: true,
          currentVersionId: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: "desc" }],
      });

  const ownerIds = [...new Set(templateRows.map((r) => r.ownerUserId))];
  const owners =
    ownerIds.length > 0 ?
      await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const ownerById = new Map(owners.map((u) => [u.id, u]));

  const templateIds = templateRows.map((r) => r.id);
  const pubs =
    templateIds.length > 0 ?
      await prisma.templateV2Publication.findMany({
        where: { templateId: { in: templateIds } },
        select: { templateId: true, reviewStatus: true, visibility: true },
      })
    : [];
  const pubByTplId = new Map(pubs.map((p) => [p.templateId, p]));

  const versionIds = [
    ...new Set(templateRows.map((r) => r.currentVersionId).filter((id): id is string => Boolean(id))),
  ];

  const versions =
    versionIds.length > 0 ?
      await prisma.templateV2Version.findMany({
        where: { id: { in: versionIds } },
        select: { id: true, canvasJson: true, metaJson: true },
      })
    : [];
  const metaByVersionId: VersionMetaRow = new Map(
    versions.map((v) => [v.id, { canvasJson: v.canvasJson, metaJson: v.metaJson ?? null }])
  );

  const mapToCard = (row: TemplateRow): DesignDashboardTemplateCard => {
    const metaJson = cvMeta(metaByVersionId, row.currentVersionId);
    const systemFlag = isTemplateSystemFlagInMeta(metaJson);
    const owner = ownerById.get(row.ownerUserId);
    const pub = pubByTplId.get(row.id) ?? null;

    let tipoParts: string[] = [];
    if (systemFlag && pubApprovedSet.has(row.id)) tipoParts.push("Plantilla sistema");
    else if (row.ownerUserId === params.userId) tipoParts.push("Tuya");
    tipoParts.push(statusLabel(row.status));

    const cvRow = row.currentVersionId ? metaByVersionId.get(row.currentVersionId) : undefined;

    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      isOwnedByViewer: row.ownerUserId === params.userId,
      name: row.name,
      description: row.description,
      status: row.status,
      currentVersionId: row.currentVersionId,
      thumbnailUrl: pickThumbFromMeta(metaJson),
      preview: parsePreviewFromCanvas(cvRow?.canvasJson),
      tipoLabel: tipoParts.join(" · "),
      publication:
        pub ?
          {
            reviewStatus: pub.reviewStatus,
            visibility: pub.visibility,
          }
        : null,
      isSystemCatalog: systemFlag,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
    };
  };

  const v2Rows = templateRows.filter((row) =>
    isTemplateDesignerMetaV2(cvMeta(metaByVersionId, row.currentVersionId))
  );

  const rowById = new Map(templateRows.map((r) => [r.id, r]));

  const cardsV2 = v2Rows.map(mapToCard);

  const pubOk = (id: string) => {
    const p = pubByTplId.get(id);
    return p?.visibility === "PUBLIC" && p.reviewStatus === "APPROVED";
  };

  const systemTemplates = cardsV2
    .filter((c) => {
      const metaJson = cvMeta(metaByVersionId, rowById.get(c.id)?.currentVersionId ?? null);
      return (
        isTemplateDesignerMetaV2(metaJson) &&
        isTemplateSystemFlagInMeta(metaJson) &&
        pubApprovedSet.has(c.id) &&
        pubOk(c.id)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const userTemplates = cardsV2
    .filter((c) => {
      const metaJson = cvMeta(metaByVersionId, rowById.get(c.id)?.currentVersionId ?? null);
      return (
        c.ownerUserId === params.userId &&
        isTemplateDesignerMetaV2(metaJson) &&
        !isTemplateSystemFlagInMeta(metaJson)
      );
    })
    .sort((a, b) => {
      const ua = templateRows.find((t) => t.id === a.id)?.updatedAt.getTime() ?? 0;
      const ub = templateRows.find((t) => t.id === b.id)?.updatedAt.getTime() ?? 0;
      return ub - ua;
    });

  let adminAllTemplates: DesignDashboardTemplateCard[] = [];
  if (isAdmin) {
    adminAllTemplates = [...cardsV2].sort((a, b) => {
      const ua = templateRows.find((t) => t.id === a.id)?.updatedAt.getTime() ?? 0;
      const ub = templateRows.find((t) => t.id === b.id)?.updatedAt.getTime() ?? 0;
      return ub - ua;
    });
  }

  return {
    systemTemplates,
    userTemplates,
    adminAllTemplates,
    isAdmin,
  };
}
