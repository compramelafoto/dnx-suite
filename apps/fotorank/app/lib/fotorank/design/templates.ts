import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, Prisma } from "@repo/db";
import { getAllowedVariableKeysForProduct } from "@repo/template-editor-core";
import {
  documentoAEditor,
  editorADocumento,
  type VariableSintetica,
} from "@repo/template-editor-core/rendering";
import {
  winnerTemplateKey,
  type WinnerFormat,
} from "./constants";

/**
 * Las plantillas de FotoRank dentro del diseñador compartido (tablas `TemplateV2*`).
 *
 * Cada plantilla es de una organización (`workspaceId`) y su versión vigente lleva en
 * `metaJson` el producto (`"fotorank"`, que decide qué variables ofrece el editor), una marca
 * (`templateKey`: qué pieza es) y el concurso al que pertenece. Es el mismo esquema de las
 * placas y el carnet de FOTOFFICE.
 */

export type DesignMeta = {
  product: "fotorank";
  templateKey: string;
  contestId: string;
  origin: "system";
};

function metaDe(raw: unknown): { templateKey: string | null; contestId: string | null } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { templateKey: null, contestId: null };
  }
  const m = raw as { templateKey?: unknown; contestId?: unknown };
  return {
    templateKey: typeof m.templateKey === "string" ? m.templateKey : null,
    contestId: typeof m.contestId === "string" ? m.contestId : null,
  };
}

export type CreatedDesign = { templateId: string; versionId: string };

/**
 * Los textos con datos mezclados ("{{prizeLabel}} · {{categoryName}}") pasan a la escritura del
 * editor, `{clave}`: con llaves dobles el lienzo los mostraba como código en vez de con los datos
 * de muestra. Al dibujar, `loadDesignDocument` declara las variables de FotoRank y el puente las
 * vuelve a pasar a dobles.
 */
function conMarcadoresDelEditor<T extends { blocks: Array<{ type: string; configJson: unknown }> }>(
  semilla: T,
): T {
  for (const b of semilla.blocks) {
    const cfg = b.configJson as { content?: unknown } | null;
    if (b.type === "TEXT" && cfg && typeof cfg.content === "string") {
      cfg.content = cfg.content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, "{$1}");
    }
  }
  return semilla;
}

/**
 * Crea una plantilla del diseñador a partir de un documento de `@repo/design-studio`.
 *
 * El documento se guarda traducido al modelo del editor (filas de bloques): guardarlo como
 * documento de impresión haría que el editor lo abriera en blanco.
 */
export async function createDesignTemplate(input: {
  organizationId: string;
  userId: number;
  name: string;
  description?: string;
  meta: Omit<DesignMeta, "product" | "origin">;
  document: unknown;
}): Promise<CreatedDesign> {
  const semilla = conMarcadoresDelEditor(documentoAEditor(input.document));
  return prisma.$transaction(async (tx) => {
    const template = await tx.templateV2.create({
      data: {
        ownerUserId: input.userId,
        workspaceId: input.organizationId,
        name: input.name.slice(0, 120),
        description: input.description ?? null,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    const meta: DesignMeta = { ...input.meta, product: "fotorank", origin: "system" };
    const version = await tx.templateV2Version.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        canvasJson: semilla.canvas as object,
        metaJson: meta,
        createdByUserId: input.userId,
      },
      select: { id: true },
    });
    if (semilla.blocks.length > 0) {
      await tx.templateV2Block.createMany({
        // Los ids de bloque son explícitos en este modelo: la base no los genera.
        data: semilla.blocks.map((b) => ({
          id: randomUUID(),
          templateVersionId: version.id,
          pageIndex: b.pageIndex,
          type: b.type as Prisma.TemplateV2BlockCreateManyInput["type"],
          name: b.name,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          rotation: b.rotation,
          zIndex: b.zIndex,
          opacity: b.opacity,
          locked: b.locked,
          visible: b.visible,
          configJson: b.configJson as object,
        })),
      });
    }
    await tx.templateV2.update({
      where: { id: template.id },
      data: { currentVersionId: version.id },
    });
    return { templateId: template.id, versionId: version.id };
  });
}

/**
 * Copia la versión vigente de una plantilla en una plantilla nueva de la misma organización.
 * Las imágenes no se copian: los bloques siguen apuntando a los mismos archivos, que nunca se
 * borran.
 */
export async function copyDesignTemplate(input: {
  organizationId: string;
  templateId: string;
  userId: number;
  name: string;
}): Promise<CreatedDesign | null> {
  const origen = await prisma.templateV2.findFirst({
    where: { id: input.templateId, workspaceId: input.organizationId },
    select: { description: true, currentVersionId: true },
  });
  if (!origen?.currentVersionId) return null;
  const version = await prisma.templateV2Version.findUnique({
    where: { id: origen.currentVersionId },
    select: { canvasJson: true, metaJson: true },
  });
  if (!version) return null;
  const bloques = await prisma.templateV2Block.findMany({
    where: { templateVersionId: origen.currentVersionId },
  });

  return prisma.$transaction(async (tx) => {
    const template = await tx.templateV2.create({
      data: {
        ownerUserId: input.userId,
        workspaceId: input.organizationId,
        name: input.name.slice(0, 120),
        description: origen.description,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    const nueva = await tx.templateV2Version.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        canvasJson: version.canvasJson as object,
        metaJson: (version.metaJson ?? undefined) as object | undefined,
        createdByUserId: input.userId,
      },
      select: { id: true },
    });
    if (bloques.length > 0) {
      await tx.templateV2Block.createMany({
        data: bloques.map((b) => ({
          id: randomUUID(),
          templateVersionId: nueva.id,
          pageIndex: b.pageIndex,
          type: b.type,
          name: b.name,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          rotation: b.rotation,
          zIndex: b.zIndex,
          opacity: b.opacity,
          locked: b.locked,
          visible: b.visible,
          configJson: (b.configJson ?? {}) as object,
        })),
      });
    }
    await tx.templateV2.update({
      where: { id: template.id },
      data: { currentVersionId: nueva.id },
    });
    return { templateId: template.id, versionId: nueva.id };
  });
}

/** Archiva una plantilla: deja de aparecer, pero lo emitido con ella sigue intacto. */
export async function archiveDesignTemplate(organizationId: string, templateId: string): Promise<void> {
  await prisma.templateV2.updateMany({
    where: { id: templateId, workspaceId: organizationId },
    data: { status: "ARCHIVED" },
  });
}

/** La versión vigente de una plantilla de la organización, para abrirla en el editor. */
export async function currentDesignVersion(
  organizationId: string,
  templateId: string,
): Promise<string | null> {
  const t = await prisma.templateV2.findFirst({
    where: { id: templateId, workspaceId: organizationId, status: { not: "ARCHIVED" } },
    select: { currentVersionId: true },
  });
  return t?.currentVersionId ?? null;
}

/**
 * La plantilla de imagen de ganador de un concurso en ese formato, si la organización ya la
 * creó. Si hubiera dos (una duplicada a mano), gana la editada más recientemente.
 */
export async function findWinnerTemplate(input: {
  organizationId: string;
  contestId: string;
  format: WinnerFormat;
}): Promise<CreatedDesign | null> {
  const plantillas = await prisma.templateV2.findMany({
    where: {
      workspaceId: input.organizationId,
      status: { not: "ARCHIVED" },
      currentVersionId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: { id: true, currentVersionId: true },
  });
  if (plantillas.length === 0) return null;
  const versiones = await prisma.templateV2Version.findMany({
    where: { id: { in: plantillas.map((p) => p.currentVersionId as string) } },
    select: { id: true, metaJson: true },
  });
  const metaPorVersion = new Map(versiones.map((v) => [v.id, metaDe(v.metaJson)]));
  const marca = winnerTemplateKey(input.format);
  for (const p of plantillas) {
    const m = metaPorVersion.get(p.currentVersionId as string);
    if (m?.templateKey === marca && m.contestId === input.contestId) {
      return { templateId: p.id, versionId: p.currentVersionId as string };
    }
  }
  return null;
}

export type LoadedDesign = {
  templateId: string;
  versionId: string;
  /** El documento con el que dibujar, ya traducido desde el modelo del editor. */
  document: unknown;
  /** Variables que inventó el puente y que la emisión tiene que recibir (QR de URL fija). */
  variablesSinteticas: VariableSintetica[];
  avisos: string[];
};

/** Lee la versión vigente de una plantilla de la organización y la deja lista para dibujar. */
export async function loadDesignDocument(input: {
  organizationId: string;
  templateId: string;
  documentName: string;
  fallbackCanvas: { width: number; height: number };
}): Promise<LoadedDesign | null> {
  const plantilla = await prisma.templateV2.findFirst({
    where: { id: input.templateId, workspaceId: input.organizationId },
    select: { id: true, currentVersionId: true },
  });
  if (!plantilla?.currentVersionId) return null;
  const version = await prisma.templateV2Version.findUnique({
    where: { id: plantilla.currentVersionId },
    select: { id: true, canvasJson: true },
  });
  if (!version) return null;

  // Los bloques no viven en `canvasJson` —ahí sólo está el tamaño del lienzo—, sino en su tabla.
  const bloques = await prisma.templateV2Block.findMany({
    where: { templateVersionId: version.id },
    orderBy: [{ pageIndex: "asc" }, { zIndex: "asc" }],
  });

  const canvas = version.canvasJson as Record<string, unknown> | null;
  const puente = editorADocumento({
    canvas: {
      width: typeof canvas?.width === "number" ? canvas.width : input.fallbackCanvas.width,
      height: typeof canvas?.height === "number" ? canvas.height : input.fallbackCanvas.height,
      background: typeof canvas?.background === "string" ? canvas.background : null,
      dpi: typeof canvas?.dpi === "number" ? canvas.dpi : null,
      bleedMm: typeof canvas?.bleedMm === "number" ? canvas.bleedMm : null,
      safeAreaMm: typeof canvas?.safeAreaMm === "number" ? canvas.safeAreaMm : null,
    },
    blocks: bloques.map((b) => ({
      id: b.id,
      type: b.type,
      name: b.name,
      pageIndex: b.pageIndex,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      rotation: b.rotation,
      zIndex: b.zIndex,
      opacity: b.opacity,
      locked: b.locked,
      visible: b.visible,
      configJson: b.configJson,
    })),
    nombre: input.documentName,
    // `{clave}` y `{{clave}}` tienen que valer igual, como en la vista previa del editor.
    variablesConocidas: getAllowedVariableKeysForProduct("fotorank"),
  });

  return {
    templateId: plantilla.id,
    versionId: version.id,
    document: puente.document,
    variablesSinteticas: puente.variablesSinteticas,
    avisos: puente.avisos,
  };
}

