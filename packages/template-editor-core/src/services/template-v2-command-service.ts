/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma TemplateV2 client tipado parcial / sin relations */
import { randomUUID } from "node:crypto";
import { templateV2Db } from "./template-v2-runtime";
import {
  assertCanClone,
  requireTemplateV2WriteAccess,
  type TemplateV2AuthUser,
  resolveTemplateV2Policy,
} from "./template-v2-authorization";
import { TemplateV2DomainError } from "./template-v2-errors";
import {
  assertLegacyPayloadLimits,
  legacyPayloadToCore,
} from "./template-v2-mappers";
import { sanitizeTemplateName } from "./template-v2-limits";
import {
  parseTemplateV2EditorPayload,
  type TemplateV2SavePayloadCore,
} from "../validate-save-payload";
import { normalizeBlockConfig } from "../render-core";
import { duplicateTemplateV2InsideTransaction } from "./duplicate-template-v2-in-transaction";
import { loadTemplateV2DuplicateGraph } from "../load-template-v2-duplicate-graph";
import { createTemplateV2VersionFromEditorPayload } from "./create-version-from-editor-payload";
import { validateLegacyTemplatePayload } from "./template-v2-validation-service";
import { getTemplateV2Runtime } from "./template-v2-runtime";
import { TEMPLATE_V2_LIMITS } from "./template-v2-limits";
import type { TemplateV2VersionSaveDecision } from "./template-v2-runtime";
import {
  mergeServerOwnedMeta,
  readPrivateCopy,
  readVersionOrigin,
  remapBlockId,
} from "../template-v2-version-lineage";


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
  /**
   * Producto de la plantilla ("school" | "clickaton"). Define qué variables
   * ofrece el editor. La app hospedadora lo fija al crear.
   */
  product?: string;
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
  const baseMeta = savePayload?.meta ?? { templatePageCount: 1 };
  const meta = args.product
    ? { ...(baseMeta as Record<string, unknown>), product: args.product }
    : baseMeta;
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

  const result = await (templateV2Db() as any).$transaction(async (tx: any) => {
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

/**
 * Respuesta de guardar. Si la versión estaba en uso, los cambios quedaron en una versión nueva
 * (`versionId` distinto del pedido) y el editor tiene que pasar a usarla: sus bloques cambiaron de
 * id según `blockIdMap`.
 */
export type SaveTemplateV2VersionResult = {
  ok: true;
  revision: number;
  updatedAt: string;
  versionId: string;
  versionNumber: number;
  /** La versión que quedó congelada, cuando se creó una nueva. */
  forkedFromVersionId: string | null;
  /** id que mandó el editor → id con el que quedó guardado. Vacío si no cambió ninguno. */
  blockIdMap: Record<string, string>;
};

async function decideVersionSave(input: {
  user: TemplateV2AuthUser;
  templateId: string;
  version: { id: string; versionNumber: number; metaJson: unknown; isLocked: boolean };
  isCurrent: boolean;
}): Promise<TemplateV2VersionSaveDecision> {
  const hook = getTemplateV2Runtime().resolveVersionSave;
  const decided: TemplateV2VersionSaveDecision = hook
    ? await hook({
        user: input.user,
        templateId: input.templateId,
        versionId: input.version.id,
        versionNumber: input.version.versionNumber,
        metaJson: input.version.metaJson,
        isCurrent: input.isCurrent,
      })
    : { mode: "in-place" };
  if (decided.mode === "read-only") return decided;
  // Una versión congelada no se pisa nunca, diga lo que diga la app.
  if (input.version.isLocked) return { mode: "fork" };
  return decided;
}

export async function saveTemplateV2Version(args: {
  user: TemplateV2AuthUser;
  templateId: string;
  versionId: string;
  body: unknown;
}): Promise<SaveTemplateV2VersionResult> {
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

  const db = templateV2Db() as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: {
      id: true,
      ownerUserId: true,
      workspaceId: true,
      status: true,
      name: true,
      currentVersionId: true,
    },
  });
  requireTemplateV2WriteAccess({ user: args.user, template, policy: resolveTemplateV2Policy() });

  const publication = await db.templateV2Publication.findUnique({
    where: { templateId: args.templateId },
    select: { reviewStatus: true },
  });
  assertNotPublishedLocked(publication);

  const version = await db.templateV2Version.findFirst({
    where: { id: args.versionId, templateId: args.templateId },
    select: { id: true, versionNumber: true, revision: true, isLocked: true, metaJson: true },
  });
  if (!version) {
    throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Versión no encontrada", 404);
  }

  if (expectedRevision != null && version.revision !== expectedRevision) {
    throw new TemplateV2DomainError(
      "TEMPLATE_EDIT_CONFLICT",
      "revision_conflict",
      409,
      { currentRevision: version.revision }
    );
  }

  const isCurrent = template!.currentVersionId === version.id;
  const decision = await decideVersionSave({
    user: args.user,
    templateId: args.templateId,
    version,
    isCurrent,
  });
  if (decision.mode === "read-only") {
    throw new TemplateV2DomainError("TEMPLATE_PUBLISHED_LOCKED", decision.message, 403);
  }

  const payload = parsed.data;

  if (decision.mode === "fork") {
    if (readPrivateCopy(version.metaJson)) {
      throw new TemplateV2DomainError(
        "TEMPLATE_PUBLISHED_LOCKED",
        "Esta copia ya no se puede cambiar.",
        403
      );
    }
    // Una versión ya congelada que no es la vigente: alguien ya guardó encima desde otra pestaña
    // (o es una versión vieja). Guardar acá crearía una rama paralela que pisa la vigente.
    if (version.isLocked && !isCurrent) {
      throw new TemplateV2DomainError(
        "TEMPLATE_EDIT_CONFLICT",
        "revision_conflict",
        409,
        { currentRevision: version.revision }
      );
    }

    const created = await (templateV2Db() as any).$transaction(async (tx: any) => {
      // Se congela antes de crear la nueva: si dos guardados compiten, el segundo ve el candado.
      const locked = await tx.templateV2Version.updateMany({
        where: { id: version.id, revision: version.revision },
        data: { isLocked: true },
      });
      if (locked.count !== 1) {
        throw new TemplateV2DomainError(
          "TEMPLATE_EDIT_CONFLICT",
          "revision_conflict",
          409,
          { currentRevision: version.revision }
        );
      }
      return createTemplateV2VersionFromEditorPayload(tx, {
        templateId: args.templateId,
        branchFromVersionId: version.id,
        userId: args.user.id,
        payload,
        reason: "en-uso",
        setAsCurrent: true,
      });
    });

    const newMeta = await db.templateV2Version.findUnique({
      where: { id: created.newVersionId },
      select: { metaJson: true },
    });
    await getTemplateV2Runtime().onVersionSaved?.({
      user: args.user,
      templateId: args.templateId,
      versionId: created.newVersionId,
      forkedFromVersionId: version.id,
      metaJson: newMeta?.metaJson ?? null,
    });

    return {
      ok: true as const,
      revision: created.revision,
      updatedAt: created.updatedAt.toISOString(),
      versionId: created.newVersionId,
      versionNumber: created.versionNumber,
      forkedFromVersionId: version.id,
      blockIdMap: created.blockIdMap,
    };
  }

  const nextRevision = version.revision + 1;

  /*
   * Ids que ya usa otra versión. Pasa si el editor sigue con ids de la versión de la que salió
   * esta (por ejemplo, deshizo hasta antes de que se creara): en la base el id de un bloque es
   * único entre todas las versiones. Se traducen con el mapa de origen o se les da uno nuevo, y
   * el editor se entera por `blockIdMap`.
   */
  const remapped: Record<string, string> = {};
  const payloadBlockIds = payload.blocks.map((b) => b.id);
  if (payloadBlockIds.length > 0) {
    const taken: { id: string }[] = await db.templateV2Block.findMany({
      where: { id: { in: payloadBlockIds }, templateVersionId: { not: args.versionId } },
      select: { id: true },
    });
    if (taken.length > 0) {
      const originMap = readVersionOrigin(version.metaJson)?.blockIdMap ?? {};
      const inPayload = new Set(payloadBlockIds);
      for (const { id } of taken) {
        const candidate = originMap[id];
        remapped[id] = candidate && !inPayload.has(candidate) ? candidate : randomUUID();
      }
    }
  }
  const bindingIds = payload.variableBindings
    .map((vb) => vb.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const takenBindingIds = new Set<string>(
    bindingIds.length > 0
      ? (
          await db.templateV2VariableBinding.findMany({
            where: { id: { in: bindingIds }, templateVersionId: { not: args.versionId } },
            select: { id: true },
          })
        ).map((r: { id: string }) => r.id)
      : []
  );
  const metaJson = mergeServerOwnedMeta(payload.meta, version.metaJson);

  await (templateV2Db() as any).$transaction(async (tx: any) => {
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
          id: remapBlockId(b.id, remapped),
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
          id:
            vb.id && !takenBindingIds.has(vb.id) ? vb.id : `vb-${args.versionId}-${index + 1}`,
          templateVersionId: args.versionId,
          blockId: remapBlockId(vb.blockId, remapped),
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
        metaJson,
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

  await getTemplateV2Runtime().onVersionSaved?.({
    user: args.user,
    templateId: args.templateId,
    versionId: args.versionId,
    forkedFromVersionId: null,
    metaJson,
  });

  return {
    ok: true as const,
    revision: refreshed?.revision ?? nextRevision,
    updatedAt: (refreshed?.updatedAt ?? new Date()).toISOString(),
    versionId: args.versionId,
    versionNumber: version.versionNumber,
    forkedFromVersionId: null,
    blockIdMap: remapped,
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
  const db = templateV2Db() as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: {
      id: true,
      ownerUserId: true,
      workspaceId: true,
      status: true,
      currentVersionId: true,
      updatedAt: true,
      name: true,
    },
  });
  requireTemplateV2WriteAccess({ user: args.user, template, policy: resolveTemplateV2Policy() });

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
  const db = templateV2Db() as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, workspaceId: true, status: true, name: true },
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

  const created = await (templateV2Db() as any).$transaction(async (tx: any) =>
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
  const db = templateV2Db() as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, workspaceId: true, status: true },
  });
  requireTemplateV2WriteAccess({ user: args.user, template, policy: resolveTemplateV2Policy() });

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

  await (templateV2Db() as any).$transaction(async (tx: any) => {
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

  const db = templateV2Db() as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, workspaceId: true, status: true },
  });
  requireTemplateV2WriteAccess({ user: args.user, template, policy: resolveTemplateV2Policy() });

  const publication = await db.templateV2Publication.findUnique({
    where: { templateId: args.templateId },
    select: { reviewStatus: true },
  });
  assertNotPublishedLocked(publication);

  const branch = await db.templateV2Version.findFirst({
    where: { id: branchFromVersionId, templateId: args.templateId },
    select: { metaJson: true },
  });
  if (branch && readPrivateCopy(branch.metaJson)) {
    // La copia de un solo diseño no puede volverse la versión vigente de la plantilla.
    throw new TemplateV2DomainError(
      "TEMPLATE_PUBLISHED_LOCKED",
      "Esta es la copia de un solo diseño: no se puede convertir en una versión de la plantilla.",
      403
    );
  }

  const created = await (templateV2Db() as any).$transaction(async (tx: any) =>
    createTemplateV2VersionFromEditorPayload(tx as any, {
      templateId: args.templateId,
      branchFromVersionId,
      userId: args.user.id,
      payload: parsed.data,
      reason: "nueva-version",
    })
  );

  return { ok: true as const, versionId: created.newVersionId };
}

export async function submitTemplateForReview(args: {
  user: TemplateV2AuthUser;
  templateId: string;
}) {
  const db = templateV2Db() as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, workspaceId: true, status: true },
  });
  requireTemplateV2WriteAccess({ user: args.user, template, policy: resolveTemplateV2Policy() });

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
  const db = templateV2Db() as any;
  const template = await db.templateV2.findUnique({
    where: { id: args.templateId },
    select: { id: true, ownerUserId: true, workspaceId: true, status: true },
  });
  requireTemplateV2WriteAccess({ user: args.user, template, policy: resolveTemplateV2Policy() });

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
  const buffer = Buffer.from(await args.file.arrayBuffer());
  const uploaded = await getTemplateV2Runtime().uploadImage({
    body: buffer,
    contentType,
    extension: ext,
    templateId: args.templateId,
    versionId: args.versionId,
  });

  await db.templateV2Asset.create({
    data: {
      templateVersionId: args.versionId,
      kind: "IMAGE",
      storageKey: uploaded.key,
      mimeType: contentType,
      metaJson: { originalName: args.file.name?.slice(0, 200) ?? null },
    },
  });

  return { ok: true as const, url: uploaded.url };
}
