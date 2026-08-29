/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma TemplateV2 client tipado parcial / sin relations */
import { templateV2Db } from "./template-v2-runtime";
import {
  requireTemplateV2ReadAccess,
  type TemplateV2AuthUser,
  resolveTemplateV2Policy,
} from "./template-v2-authorization";
import { TemplateV2DomainError } from "./template-v2-errors";
import {
  canvasFromJson,
  editorPayloadFromLegacy,
  legacyPayloadToCore,
  versionRowsToLegacyPayload,
  type TemplateSummary,
} from "./template-v2-mappers";
import { loadTemplateV2BlocksForVersion } from "./load-template-v2-blocks-from-db";
import { TEMPLATE_SCHEMA_VERSION } from "@repo/template-engine";


const ALLOWED_SORT = new Set(["updatedAt", "createdAt", "name"] as const);
type SortField = "updatedAt" | "createdAt" | "name";

export type ListTemplatesQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
  /** Solo propias (default true salvo admin con scope=all). */
  scope?: "mine" | "public" | "all";
};

function pickThumb(metaJson: unknown): string | null {
  if (!metaJson || typeof metaJson !== "object") return null;
  const m = metaJson as Record<string, unknown>;
  for (const key of ["thumbnailUrl", "previewThumbUrl", "previewUrl"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export async function listTemplateV2Summaries(
  user: TemplateV2AuthUser,
  query: ListTemplatesQuery
): Promise<{
  items: TemplateSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 20)));
  const sort: SortField =
    query.sort && ALLOWED_SORT.has(query.sort as SortField)
      ? (query.sort as SortField)
      : "updatedAt";
  const order = query.order === "asc" ? "asc" : "desc";
  const scope = query.scope ?? "mine";

  const where: Record<string, unknown> = {};
  const db = templateV2Db() as any;

  if (scope === "mine") {
    where.ownerUserId = user.id;
  } else if (scope === "public") {
    // TemplateV2Publication no tiene relation field en TemplateV2 (schema actual).
    const pubs = await db.templateV2Publication.findMany({
      where: { visibility: "PUBLIC", reviewStatus: "APPROVED" },
      select: { templateId: true },
    });
    where.id = { in: pubs.map((p: { templateId: string }) => p.templateId) };
  } else if (scope === "all") {
    if (user.role !== "ADMIN") {
      throw new TemplateV2DomainError("TEMPLATE_FORBIDDEN", "Scope all solo para admin", 403);
    }
  }

  if (query.status && ["DRAFT", "ACTIVE", "ARCHIVED"].includes(query.status)) {
    where.status = query.status;
  } else if (scope === "mine" || scope === "public") {
    where.status = { not: "ARCHIVED" };
  }

  if (query.q && query.q.trim()) {
    where.name = { contains: query.q.trim(), mode: "insensitive" };
  }

  // scope public sin IDs → vacío
  if (scope === "public" && Array.isArray((where.id as { in?: string[] })?.in) && (where.id as { in: string[] }).in.length === 0) {
    return {
      items: [],
      pagination: { page, pageSize, total: 0, totalPages: 1 },
    };
  }

  const total = await db.templateV2.count({ where });
  const rows = await db.templateV2.findMany({
    where,
    orderBy: { [sort]: order },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      name: true,
      status: true,
      ownerUserId: true,
      workspaceId: true,
      currentVersionId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const versionIds = rows
    .map((r: { currentVersionId: string | null }) => r.currentVersionId)
    .filter((id: string | null): id is string => !!id);

  type VersionPreview = { id: string; canvasJson: unknown; metaJson: unknown };
  const versions: VersionPreview[] =
    versionIds.length > 0
      ? await db.templateV2Version.findMany({
          where: { id: { in: versionIds } },
          select: { id: true, canvasJson: true, metaJson: true },
        })
      : [];
  const versionMap = new Map<string, VersionPreview>(versions.map((v) => [v.id, v]));

  const pubs = await db.templateV2Publication.findMany({
    where: { templateId: { in: rows.map((r: { id: string }) => r.id) } },
    select: { templateId: true, visibility: true, reviewStatus: true },
  });
  const pubMap = new Map(
    pubs.map((p: { templateId: string; visibility: string; reviewStatus: string }) => [
      p.templateId,
      p,
    ])
  );

  const items: TemplateSummary[] = rows.map(
    (r: {
      id: string;
      name: string;
      status: string;
      ownerUserId: number;
      currentVersionId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }) => {
      const ver = r.currentVersionId ? versionMap.get(r.currentVersionId) : null;
      const canvas = canvasFromJson(ver?.canvasJson);
      const pub = pubMap.get(r.id) as
        | { visibility: string; reviewStatus: string }
        | undefined;
      return {
        id: r.id,
        name: r.name,
        status: r.status,
        dimensions: { width: canvas.width, height: canvas.height },
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        thumbnailUrl: pickThumb(ver?.metaJson),
        ownerUserId: r.ownerUserId,
        currentVersionId: r.currentVersionId,
        schemaVersion: TEMPLATE_SCHEMA_VERSION,
        publication: pub
          ? { visibility: pub.visibility, reviewStatus: pub.reviewStatus }
          : null,
      };
    }
  );

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getTemplateV2Detail(
  user: TemplateV2AuthUser,
  templateId: string,
  options?: { includeLegacy?: boolean; versionId?: string }
) {
  const db = templateV2Db() as any;
  const template = await db.templateV2.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      ownerUserId: true,
      workspaceId: true,
      currentVersionId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const publication = template
    ? await db.templateV2Publication.findUnique({
        where: { templateId },
        select: { visibility: true, reviewStatus: true },
      })
    : null;

  requireTemplateV2ReadAccess({ user, template, publication, policy: resolveTemplateV2Policy() });

  const versionId = options?.versionId ?? template!.currentVersionId;
  if (!versionId) {
    throw new TemplateV2DomainError(
      "TEMPLATE_INVALID",
      "Plantilla sin versión",
      422
    );
  }

  const version = await db.templateV2Version.findFirst({
    where: { id: versionId, templateId },
  });
  if (!version) {
    throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Versión no encontrada", 404);
  }

  const [blocks, bindings] = await Promise.all([
    loadTemplateV2BlocksForVersion(templateV2Db() as never, version.id),
    db.templateV2VariableBinding.findMany({ where: { templateVersionId: version.id } }),
  ]);

  const legacy = versionRowsToLegacyPayload({
    canvasJson: version.canvasJson,
    metaJson: version.metaJson,
    blocks,
    bindings,
  });

  const { document, warnings } = legacyPayloadToCore(legacy, {
    id: template!.id,
    name: template!.name,
  });

  return {
    template: document,
    legacy: options?.includeLegacy === false ? undefined : editorPayloadFromLegacy(legacy),
    compatibilityWarnings: warnings,
    meta: {
      templateId: template!.id,
      name: template!.name,
      description: template!.description,
      status: template!.status,
      ownerUserId: template!.ownerUserId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      revision: version.revision,
      isLocked: version.isLocked,
      updatedAt: version.updatedAt.toISOString(),
      createdAt: template!.createdAt.toISOString(),
      publication,
    },
  };
}

/** Contrato editor: GET save. */
export async function loadEditorVersion(
  user: TemplateV2AuthUser,
  templateId: string,
  versionId: string
) {
  const detail = await getTemplateV2Detail(user, templateId, {
    includeLegacy: true,
    versionId,
  });
  const legacy = detail.legacy!;
  return {
    ok: true as const,
    template: {
      id: detail.meta.templateId,
      name: detail.meta.name,
      status: detail.meta.status,
    },
    revision: detail.meta.revision,
    canvas: legacy.canvas,
    blocks: legacy.blocks,
    variableBindings: legacy.variableBindings,
    meta: legacy.meta,
    updatedAt: detail.meta.updatedAt,
    versionNumber: detail.meta.versionNumber,
  };
}

export async function listTemplateVersions(user: TemplateV2AuthUser, templateId: string) {
  const db = templateV2Db() as any;
  const template = await db.templateV2.findUnique({
    where: { id: templateId },
    select: { id: true, ownerUserId: true, workspaceId: true, status: true, currentVersionId: true },
  });
  const publication = template
    ? await db.templateV2Publication.findUnique({
        where: { templateId },
        select: { visibility: true, reviewStatus: true },
      })
    : null;
  requireTemplateV2ReadAccess({ user, template, publication, policy: resolveTemplateV2Policy() });

  const versions = await db.templateV2Version.findMany({
    where: { templateId },
    orderBy: { versionNumber: "desc" },
    select: { id: true, versionNumber: true, updatedAt: true },
  });

  return {
    ok: true as const,
    currentVersionId: template!.currentVersionId,
    versions: versions.map((v: { id: string; versionNumber: number; updatedAt: Date }) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      updatedAt: v.updatedAt.toISOString(),
      isCurrent: v.id === template!.currentVersionId,
    })),
  };
}

export async function listPublicTemplates() {
  const db = templateV2Db() as any;
  const pubs = await db.templateV2Publication.findMany({
    where: { visibility: "PUBLIC", reviewStatus: "APPROVED" },
    select: { templateId: true },
  });
  const ids = pubs.map((p: { templateId: string }) => p.templateId);
  if (ids.length === 0) return { templates: [] as unknown[] };

  const templates = await db.templateV2.findMany({
    where: { id: { in: ids }, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      description: true,
      ownerUserId: true,
      workspaceId: true,
      currentVersionId: true,
    },
  });

  const owners = await db.user.findMany({
    where: { id: { in: templates.map((t: { ownerUserId: number }) => t.ownerUserId) } },
    select: { id: true, name: true, email: true },
  });
  const ownerMap = new Map(
    owners.map((o: { id: number; name: string | null; email: string | null }) => [o.id, o])
  );

  const versionIds = templates
    .map((t: { currentVersionId: string | null }) => t.currentVersionId)
    .filter(Boolean);
  type VerMeta = { id: string; metaJson: unknown };
  const verRows = (await db.templateV2Version.findMany({
    where: { id: { in: versionIds } },
    select: { id: true, metaJson: true },
  })) as VerMeta[];
  const verMap = new Map<string, VerMeta>(verRows.map((v) => [v.id, v]));

  return {
    templates: templates.map(
      (t: {
        id: string;
        name: string;
        description: string | null;
        ownerUserId: number;
        currentVersionId: string | null;
      }) => {
        const owner = ownerMap.get(t.ownerUserId) as
          | { name: string | null; email: string | null }
          | undefined;
        const ver = t.currentVersionId ? verMap.get(t.currentVersionId) : undefined;
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          author: owner?.name || owner?.email || "Autor",
          publication: { visibility: "PUBLIC", reviewStatus: "APPROVED" },
          thumbnailUrl: pickThumb(ver?.metaJson ?? null),
        };
      }
    ),
  };
}
