/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma TemplateV2 client tipado parcial / sin relations */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  assertCanClone,
  requireTemplateV2WriteAccess,
  type TemplateV2AuthUser,
} from "@/lib/template-v2/services/template-v2-authorization";
import { TemplateV2DomainError } from "@/lib/template-v2/services/template-v2-errors";
import {
  assertLegacyPayloadLimits,
  legacyPayloadToCore,
} from "@/lib/template-v2/services/template-v2-mappers";
import { sanitizeTemplateName } from "@/lib/template-v2/services/template-v2-limits";
import {
  parseTemplateV2EditorPayload,
  type TemplateV2SavePayloadCore,
} from "@/lib/template-v2/validate-save-payload";
import { normalizeBlockConfig } from "@/lib/template-v2/render-core";
import { duplicateTemplateV2InsideTransaction } from "@/lib/template-v2/duplicate-template-v2-in-transaction";
import { loadTemplateV2DuplicateGraph } from "@/lib/template-v2/load-template-v2-duplicate-graph";
import { createTemplateV2VersionFromEditorPayload } from "@/lib/template-v2/create-version-from-editor-payload";
import { validateLegacyTemplatePayload } from "@/lib/template-v2/services/template-v2-validation-service";
import { generateR2Key, getR2PublicUrl, uploadToR2 } from "@/lib/r2-client";
import { TEMPLATE_V2_LIMITS } from "@/lib/template-v2/services/template-v2-limits";

const DEFAULT_CANVAS = {
  width: 1200,
  height: 1800,
  background: "#ffffff",
  dpi: 300,
  safeAreaMm: 5,
};

function assertNotPublishedLocked(publication: { reviewStatus?: string } | null) {
  if (publication?.reviewStatus === "APPROVED") {
    throw new TemplateV2DomainError(
      "TEMPLATE_PUBLISHED_LOCKED",
      "template_publicado_bloqueado",
      403
    );
  }
}

export async function createTemplateV2(args: {
  user: TemplateV2AuthUser;
  name?: string;
  description?: string;
  payload?: unknown;
}) {
  const name = sanitizeTemplateName(args.name, "Nueva plantilla");
  let savePayload: TemplateV2SavePayloadCore | null = null;

  if (args.payload != null) {
    const parsed = parseTemplateV2EditorPayload(args.payload);
    if (!parsed.ok) {
      throw new TemplateV2DomainError("TEMPLATE_INVALID", parsed.error, 422);
    }
    assertLegacyPayloadLimits(parsed.data);
    legacyPayloadToCore(parsed.data, { name });
    const validation = validateLegacyTemplatePayload(parsed.data, { name });
    if (!validation.valid) {
      throw new TemplateV2DomainError(
        "TEMPLATE_INVALID",
        "Plantilla inválida",
        422,
        validation.errors
      );
    }
    savePayload = parsed.data;
  }

  const canvas = savePayload?.canvas ?? DEFAULT_CANVAS;
  const meta = savePayload?.meta ?? { templatePageCount: 1 };
  const blocks = savePayload?.blocks ?? [
    {
      id: randomUUID(),
      type: "BACKGROUND" as const,
      pageIndex: 0,
      name: "Fondo",
      layout: {
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
        rotation: 0,
        zIndex: 0,
        opacity: 1,
        locked: true,
        visible: true,
      },
      configJson: {
        backgroundColor: typeof canvas.background === "string" ? canvas.background : "#ffffff",
        src: "",
        fit: "cover",
      },
    },
  ];
  const bindings = savePayload?.variableBindings ?? [];

  const result = await prisma.$transaction(async (tx) => {
    const db = tx as any;
    const template = await db.templateV2.create({
      data: {
        ownerUserId: args.user.id,
        name,
        description:
          typeof args.description === "string" ? args.description.slice(0, 2000) : null,
        status: "DRAFT",
      },
    });

    const version = await db.templateV2Version.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        canvasJson: canvas,
        metaJson: meta,
        revision: 0,
        isLocked: false,
        createdByUserId: args.user.id,
      },
    });

    await db.templateV2.update({
      where: { id: template.id },
      data: { currentVersionId: version.id },
    });

    if (blocks.length > 0) {
      await db.templateV2Block.createMany({
        data: blocks.map((b) => ({
          id: b.id,
          templateVersionId: version.id,
          pageIndex: b.pageIndex ?? 0,
          type: b.type,
          name: b.name ?? null,
          x: b.layout.x,
          y: b.layout.y,
          width: b.layout.width,
          height: b.layout.height,
          rotation: b.layout.rotation,
          zIndex: b.layout.zIndex,
          opacity: b.layout.opacity,
          locked: b.layout.locked ?? false,
          visible: b.layout.visible,
          configJson: normalizeBlockConfig(b.type, b.configJson) as object,
        })),
      });
    }

    if (bindings.length > 0) {
      await db.templateV2VariableBinding.createMany({
        data: bindings.map((vb, index) => ({
          id: vb.id ?? `vb-${version.id}-${index + 1}`,
          templateVersionId: version.id,
          blockId: vb.blockId,
          targetPath: vb.targetPath,
          variableKey: vb.variableKey,
          formatter: vb.formatter ?? null,
          fallbackOverride: vb.fallbackOverride ?? null,
        })),
      });
    }

    await db.templateV2Publication.create({
      data: {
        templateId: template.id,
        visibility: "PRIVATE",
        reviewStatus: "DRAFT",
      },
    });

    return { templateId: template.id as string, versionId: version.id as string, name };
  });

  return { ok: true as const, ...result };
}

export async function saveTemplateV2Version(args: {
  user: TemplateV2AuthUser;
  templateId: string;
  versionId: string;
  body: unknown;
}) {
  const parsed = parseTemplateV2EditorPayload(
    typeof args.body === "object" && args.body && !Array.isArray(args.body)
      ? {
          canvas: (args.body as any).canvas,
          blocks: (args.body as any).blocks,
          variableBindings: (args.body as any).variableBindings,
          meta: (args.body as any).meta,
        }
      : args.body
  );
  if (!parsed.ok) {
    throw new TemplateV2DomainError("TEMPLATE_INVALID", parsed.error, 422);
  }
  assertLegacyPayloadLimits(parsed.data);
  legacyPayloadToCore(parsed.data);

  const expectedRevision =
    typeof (args.body as any)?.revision === "number"
      ? (args.body as any).revision
      : null;

  const db = prisma as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, status: true, name: true },
  });
  requireTemplateV2WriteAccess({ user: args.user, template });

  const publication = await db.templateV2Publication.findUnique({
    where: { templateId: args.templateId },
    select: { reviewStatus: true },
  });
  assertNotPublishedLocked(publication);

  const version = await db.templateV2Version.findFirst({
    where: { id: args.versionId, templateId: args.templateId },
  });
  if (!version) {
    throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Versión no encontrada", 404);
  }
  if (version.isLocked) {
    throw new TemplateV2DomainError(
      "TEMPLATE_PUBLISHED_LOCKED",
      "template_publicado_bloqueado",
      403
    );
  }

  if (expectedRevision != null && version.revision !== expectedRevision) {
    throw new TemplateV2DomainError(
      "TEMPLATE_EDIT_CONFLICT",
      "revision_conflict",
      409,
      { currentRevision: version.revision }
    );
  }

  const nextRevision = version.revision + 1;
  const payload = parsed.data;

  await prisma.$transaction(async (tx) => {
    const t = tx as any;
    await t.templateV2VariableBinding.deleteMany({
      where: { templateVersionId: args.versionId },
    });
    await t.templateV2Block.deleteMany({
      where: { templateVersionId: args.versionId },
    });

    if (payload.blocks.length > 0) {
      await t.templateV2Block.createMany({
        data: payload.blocks.map((b) => ({
          id: b.id,
          templateVersionId: args.versionId,
          pageIndex: b.pageIndex ?? 0,
          type: b.type,
          name: b.name ?? null,
          x: b.layout.x,
          y: b.layout.y,
          width: b.layout.width,
          height: b.layout.height,
          rotation: b.layout.rotation,
          zIndex: b.layout.zIndex,
          opacity: b.layout.opacity,
          locked: b.layout.locked ?? false,
          visible: b.layout.visible,
          configJson: normalizeBlockConfig(b.type, b.configJson) as object,
        })),
      });
    }

    if (payload.variableBindings.length > 0) {
      await t.templateV2VariableBinding.createMany({
        data: payload.variableBindings.map((vb, index) => ({
          id: vb.id ?? `vb-${args.versionId}-${index + 1}`,
          templateVersionId: args.versionId,
          blockId: vb.blockId,
          targetPath: vb.targetPath,
          variableKey: vb.variableKey,
          formatter: vb.formatter ?? null,
          fallbackOverride: vb.fallbackOverride ?? null,
        })),
      });
    }

    await t.templateV2Version.update({
      where: { id: args.versionId },
      data: {
        canvasJson: payload.canvas,
        metaJson: payload.meta,
        revision: nextRevision,
      },
    });

    await t.templateV2.update({
      where: { id: args.templateId },
      data: { updatedAt: new Date() },
    });
  });

  const refreshed = await db.templateV2Version.findUnique({
    where: { id: args.versionId },
    select: { revision: true, updatedAt: true },
  });

  return {
    ok: true as const,
    revision: refreshed?.revision ?? nextRevision,
    updatedAt: (refreshed?.updatedAt ?? new Date()).toISOString(),
  };
}

export async function patchTemplateV2(args: {
  user: TemplateV2AuthUser;
  templateId: string;
  body: {
    name?: string;
    description?: string | null;
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
    document?: unknown;
    expectedUpdatedAt?: string;
  };
}) {
  const db = prisma as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: {
      id: true,
      ownerUserId: true,
      status: true,
      currentVersionId: true,
      updatedAt: true,
      name: true,
    },
  });
  requireTemplateV2WriteAccess({ user: args.user, template });

  if (args.body.expectedUpdatedAt) {
    const expected = new Date(args.body.expectedUpdatedAt).getTime();
    const actual = new Date(template!.updatedAt).getTime();
    if (!Number.isNaN(expected) && expected !== actual) {
      throw new TemplateV2DomainError(
        "TEMPLATE_EDIT_CONFLICT",
        "La plantilla fue modificada por otro proceso",
        409,
        { updatedAt: template!.updatedAt.toISOString() }
      );
    }
  }

  const publication = await db.templateV2Publication.findUnique({
    where: { templateId: args.templateId },
    select: { reviewStatus: true },
  });
  assertNotPublishedLocked(publication);

  const data: Record<string, unknown> = {};
  if (typeof args.body.name === "string") {
    data.name = sanitizeTemplateName(args.body.name, template!.name);
  }
  if (args.body.description !== undefined) {
    data.description =
      typeof args.body.description === "string"
        ? args.body.description.slice(0, 2000)
        : null;
  }
  if (args.body.status && ["DRAFT", "ACTIVE", "ARCHIVED"].includes(args.body.status)) {
    data.status = args.body.status;
  }

  if (args.body.document != null && template!.currentVersionId) {
    await saveTemplateV2Version({
      user: args.user,
      templateId: args.templateId,
      versionId: template!.currentVersionId,
      body: args.body.document,
    });
  }

  if (Object.keys(data).length > 0) {
    await db.templateV2.update({
      where: { id: args.templateId },
      data,
    });
  }

  return { ok: true as const, templateId: args.templateId };
}

export async function duplicateTemplateV2(args: {
  user: TemplateV2AuthUser;
  templateId: string;
  name?: string;
}) {
  const db = prisma as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, status: true, name: true },
  });
  const publication = await db.templateV2Publication.findUnique({
    where: { templateId: args.templateId },
    select: { visibility: true, reviewStatus: true },
  });
  assertCanClone({ user: args.user, template, publication });

  const source = await loadTemplateV2DuplicateGraph(args.templateId);
  if (!source) {
    throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Plantilla no encontrada", 404);
  }

  const customName =
    typeof args.name === "string" && args.name.trim()
      ? sanitizeTemplateName(args.name)
      : `${template!.name} — copia`;

  const created = await prisma.$transaction(async (tx) =>
    duplicateTemplateV2InsideTransaction(tx as any, {
      source,
      newOwnerUserId: args.user.id,
      createdByUserId: args.user.id,
      versionMetaStrategy:
        template!.ownerUserId === args.user.id ? "copy" : "fork_from_public_catalog",
      catalogTemplateIdForMeta: args.templateId,
      customCloneName: customName,
    })
  );

  // Publication ya se crea dentro de duplicateTemplateV2InsideTransaction.
  return {
    ok: true as const,
    templateId: created.templateId,
    versionId: created.versionId,
    name: created.name,
  };
}

/**
 * Soft-delete vía ARCHIVED si está en uso (AlbumPack).
 * Hard-delete solo si no hay referencias.
 * Assets R2: no se borran (pueden estar referenciados por clones vía storageKey compartido).
 */
export async function deleteTemplateV2(args: {
  user: TemplateV2AuthUser;
  templateId: string;
}) {
  const db = prisma as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, status: true },
  });
  requireTemplateV2WriteAccess({ user: args.user, template });

  const packCount = await db.albumPack.count({
    where: { templateV2Id: args.templateId },
  });

  if (packCount > 0) {
    await db.templateV2.update({
      where: { id: args.templateId },
      data: { status: "ARCHIVED" },
    });
    return {
      ok: true as const,
      softDeleted: true,
      message: "Plantilla archivada porque está asociada a productos",
    };
  }

  // Borrado físico de filas hijas + template (sin tocar R2)
  const versions = await db.templateV2Version.findMany({
    where: { templateId: args.templateId },
    select: { id: true },
  });
  const versionIds = versions.map((v: { id: string }) => v.id);

  await prisma.$transaction(async (tx) => {
    const t = tx as any;
    if (versionIds.length > 0) {
      await t.templateV2VariableBinding.deleteMany({
        where: { templateVersionId: { in: versionIds } },
      });
      await t.templateV2Asset.deleteMany({
        where: { templateVersionId: { in: versionIds } },
      });
      await t.templateV2Block.deleteMany({
        where: { templateVersionId: { in: versionIds } },
      });
    }
    await t.templateV2.update({
      where: { id: args.templateId },
      data: { currentVersionId: null },
    });
    await t.templateV2Version.deleteMany({ where: { templateId: args.templateId } });
    await t.templateV2Publication.deleteMany({ where: { templateId: args.templateId } });
    await t.templateV2.delete({ where: { id: args.templateId } });
  });

  return { ok: true as const, softDeleted: false };
}

export async function saveAsNewVersion(args: {
  user: TemplateV2AuthUser;
  templateId: string;
  body: unknown;
}) {
  const body = args.body as Record<string, unknown>;
  const branchFromVersionId =
    typeof body.branchFromVersionId === "string" ? body.branchFromVersionId : "";
  if (!branchFromVersionId) {
    throw new TemplateV2DomainError(
      "TEMPLATE_INVALID",
      "branchFromVersionId requerido",
      422
    );
  }

  const parsed = parseTemplateV2EditorPayload(body);
  if (!parsed.ok) {
    throw new TemplateV2DomainError("TEMPLATE_INVALID", parsed.error, 422);
  }
  assertLegacyPayloadLimits(parsed.data);

  const db = prisma as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, status: true },
  });
  requireTemplateV2WriteAccess({ user: args.user, template });

  const publication = await db.templateV2Publication.findUnique({
    where: { templateId: args.templateId },
    select: { reviewStatus: true },
  });
  assertNotPublishedLocked(publication);

  const created = await prisma.$transaction(async (tx) =>
    createTemplateV2VersionFromEditorPayload(tx as any, {
      templateId: args.templateId,
      branchFromVersionId,
      userId: args.user.id,
      payload: parsed.data,
    })
  );

  return { ok: true as const, versionId: created.newVersionId };
}

export async function submitTemplateForReview(args: {
  user: TemplateV2AuthUser;
  templateId: string;
}) {
  const db = prisma as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, status: true },
  });
  requireTemplateV2WriteAccess({ user: args.user, template });

  await db.templateV2Publication.upsert({
    where: { templateId: args.templateId },
    update: { reviewStatus: "IN_REVIEW" },
    create: {
      templateId: args.templateId,
      visibility: "PRIVATE",
      reviewStatus: "IN_REVIEW",
    },
  });

  return { ok: true as const };
}

export async function uploadTemplateVersionImage(args: {
  user: TemplateV2AuthUser;
  templateId: string;
  versionId: string;
  file: File;
}) {
  const db = prisma as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, status: true },
  });
  requireTemplateV2WriteAccess({ user: args.user, template });

  const version = await db.templateV2Version.findFirst({
    where: { id: args.versionId, templateId: args.templateId },
    select: { id: true, isLocked: true },
  });
  if (!version) {
    throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Versión no encontrada", 404);
  }
  if (version.isLocked) {
    throw new TemplateV2DomainError(
      "TEMPLATE_PUBLISHED_LOCKED",
      "template_publicado_bloqueado",
      403
    );
  }

  const contentType = (args.file.type || "image/jpeg").toLowerCase().split(";")[0]?.trim() ?? "";
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowed.has(contentType)) {
    throw new TemplateV2DomainError(
      "TEMPLATE_ASSET_INVALID",
      "Formato de imagen no soportado",
      422
    );
  }
  if (args.file.size > TEMPLATE_V2_LIMITS.maxImageUploadBytes) {
    throw new TemplateV2DomainError(
      "TEMPLATE_PAYLOAD_TOO_LARGE",
      "Imagen demasiado grande",
      413
    );
  }

  const ext =
    contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "jpg";
  const key = generateR2Key(
    `block_${randomUUID()}.${ext}`,
    `template-v2/${args.user.id}/${args.templateId}/${args.versionId}`
  );
  const buffer = Buffer.from(await args.file.arrayBuffer());
  await uploadToR2(buffer, key, contentType, {
    type: "template_v2_image",
    templateId: args.templateId,
    versionId: args.versionId,
    userId: String(args.user.id),
  });

  await db.templateV2Asset.create({
    data: {
      templateVersionId: args.versionId,
      kind: "IMAGE",
      storageKey: key,
      mimeType: contentType,
      metaJson: { originalName: args.file.name?.slice(0, 200) ?? null },
    },
  });

  const url = getR2PublicUrl(key);
  return { ok: true as const, url };
}
