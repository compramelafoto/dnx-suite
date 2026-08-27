/**
 * Lectura de plantillas Template V2 desde la base compartida.
 *
 * El editor visual vive hoy en ComprameLaFoto, pero las plantillas se guardan
 * en esta base. Este repositorio permite que cualquier app las consuma sin
 * depender del código de otra app: devuelve el payload legacy
 * (`canvas` + `blocks` + `variableBindings`), que es la entrada del bridge de
 * `@repo/template-engine`.
 */
import type { PrismaClient } from "@prisma/client";

/** Igual a `LegacyTemplateV2Payload` de `@repo/template-engine`, sin importarlo. */
export type TemplateV2LegacyPayload = {
  canvas: {
    width: number;
    height: number;
    background?: string;
    dpi?: number;
    bleedMm?: number;
    safeAreaMm?: number;
  };
  blocks: Array<{
    id: string;
    type: string;
    name?: string;
    pageIndex?: number;
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
      zIndex?: number;
      opacity?: number;
      locked?: boolean;
      visible?: boolean;
    };
    configJson: Record<string, unknown>;
  }>;
  variableBindings?: Array<{
    id?: string;
    blockId: string;
    targetPath: string;
    variableKey: string;
    formatter?: string;
    fallbackOverride?: string | null;
  }>;
  meta?: Record<string, unknown>;
};

export type TemplateV2LoadResult = {
  templateId: string;
  templateName: string;
  versionId: string;
  versionNumber: number;
  /** Cambia en cada guardado; sirve para invalidar cachés y hashes de render. */
  revision: number;
  updatedAt: Date;
  /** `metaJson.product` de la versión: "school" | "clickaton" | ausente. */
  product: string | null;
  payload: TemplateV2LegacyPayload;
};

export type TemplateV2Summary = {
  templateId: string;
  name: string;
  description: string | null;
  status: string;
  versionId: string | null;
  versionNumber: number | null;
  updatedAt: Date;
  product: string | null;
  canvasWidth: number | null;
  canvasHeight: number | null;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function canvasFromJson(canvasJson: unknown): TemplateV2LegacyPayload["canvas"] {
  const raw = asObject(canvasJson);
  return {
    width: numberOr(raw.width, 1080),
    height: numberOr(raw.height, 1920),
    background: typeof raw.background === "string" ? raw.background : undefined,
    dpi: optionalNumber(raw.dpi),
    bleedMm: optionalNumber(raw.bleedMm),
    safeAreaMm: optionalNumber(raw.safeAreaMm),
  };
}

function productFromMeta(metaJson: unknown): string | null {
  const product = asObject(metaJson).product;
  return typeof product === "string" && product.trim() ? product.trim() : null;
}

type TemplateV2Db = Pick<
  PrismaClient,
  "templateV2" | "templateV2Version" | "templateV2Block" | "templateV2VariableBinding"
>;

/**
 * Carga una plantilla lista para renderizar.
 *
 * Sin `versionId` usa `currentVersionId` y, si falta, la versión de número más
 * alto: una plantilla recién creada puede no tener todavía current apuntado.
 * Devuelve null si la plantilla o la versión no existen.
 */
export async function loadTemplateV2LegacyPayload(
  db: TemplateV2Db,
  input: { templateId: string; versionId?: string | null }
): Promise<TemplateV2LoadResult | null> {
  const template = await db.templateV2.findUnique({
    where: { id: input.templateId },
    select: { id: true, name: true, currentVersionId: true },
  });
  if (!template) return null;

  const version = input.versionId
    ? await db.templateV2Version.findFirst({
        where: { id: input.versionId, templateId: template.id },
        select: VERSION_SELECT,
      })
    : template.currentVersionId
      ? await db.templateV2Version.findFirst({
          where: { id: template.currentVersionId, templateId: template.id },
          select: VERSION_SELECT,
        })
      : await db.templateV2Version.findFirst({
          where: { templateId: template.id },
          orderBy: { versionNumber: "desc" },
          select: VERSION_SELECT,
        });

  if (!version) return null;

  const [blocks, bindings] = await Promise.all([
    db.templateV2Block.findMany({
      where: { templateVersionId: version.id },
      orderBy: { zIndex: "asc" },
      select: {
        id: true,
        type: true,
        name: true,
        pageIndex: true,
        x: true,
        y: true,
        width: true,
        height: true,
        rotation: true,
        zIndex: true,
        opacity: true,
        locked: true,
        visible: true,
        configJson: true,
      },
    }),
    db.templateV2VariableBinding.findMany({
      where: { templateVersionId: version.id },
      select: {
        id: true,
        blockId: true,
        targetPath: true,
        variableKey: true,
        formatter: true,
        fallbackOverride: true,
      },
    }),
  ]);

  return {
    templateId: template.id,
    templateName: template.name,
    versionId: version.id,
    versionNumber: version.versionNumber,
    revision: version.revision,
    updatedAt: version.updatedAt,
    product: productFromMeta(version.metaJson),
    payload: {
      canvas: canvasFromJson(version.canvasJson),
      blocks: blocks.map((b) => ({
        id: b.id,
        type: String(b.type),
        name: b.name ?? undefined,
        pageIndex: b.pageIndex ?? 0,
        layout: {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          rotation: b.rotation,
          zIndex: b.zIndex,
          opacity: b.opacity,
          locked: b.locked,
          visible: b.visible,
        },
        configJson: asObject(b.configJson),
      })),
      variableBindings: bindings.map((vb) => ({
        id: vb.id,
        blockId: vb.blockId,
        targetPath: vb.targetPath,
        variableKey: vb.variableKey,
        formatter: vb.formatter ?? undefined,
        fallbackOverride: vb.fallbackOverride,
      })),
      meta: asObject(version.metaJson),
    },
  };
}

const VERSION_SELECT = {
  id: true,
  versionNumber: true,
  revision: true,
  updatedAt: true,
  canvasJson: true,
  metaJson: true,
} as const;

/**
 * Lista plantillas para un selector. `product` filtra por `metaJson.product` de
 * la versión vigente; se resuelve en memoria porque vive dentro de un JSON.
 */
export async function listTemplateV2ForPicker(
  db: TemplateV2Db,
  options?: { product?: string; limit?: number; includeUnknownProduct?: boolean }
): Promise<TemplateV2Summary[]> {
  const limit = Math.max(1, Math.min(200, options?.limit ?? 100));

  const templates = await db.templateV2.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      currentVersionId: true,
      updatedAt: true,
    },
  });

  const versionIds = templates
    .map((t) => t.currentVersionId)
    .filter((id): id is string => Boolean(id));

  const versions = versionIds.length
    ? await db.templateV2Version.findMany({
        where: { id: { in: versionIds } },
        select: {
          id: true,
          templateId: true,
          versionNumber: true,
          canvasJson: true,
          metaJson: true,
        },
      })
    : [];

  const byTemplate = new Map(versions.map((v) => [v.templateId, v]));

  const rows: TemplateV2Summary[] = templates.map((t) => {
    const version = byTemplate.get(t.id);
    const canvas = version ? canvasFromJson(version.canvasJson) : null;
    return {
      templateId: t.id,
      name: t.name,
      description: t.description,
      status: String(t.status),
      versionId: version?.id ?? null,
      versionNumber: version?.versionNumber ?? null,
      updatedAt: t.updatedAt,
      product: version ? productFromMeta(version.metaJson) : null,
      canvasWidth: canvas?.width ?? null,
      canvasHeight: canvas?.height ?? null,
    };
  });

  if (!options?.product) return rows;

  return rows.filter(
    (row) =>
      row.product === options.product ||
      (options.includeUnknownProduct === true && row.product == null)
  );
}
