import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, Prisma } from "@repo/db";
import { getAllowedVariableKeysForProduct } from "@repo/template-editor-core";
import {
  documentoAEditor,
  editorADocumento,
  type VariableSintetica,
} from "@/lib/carnet/bridge";

/**
 * Plantillas con marca: las que el sistema necesita encontrar por lo que son —el carnet, cada
 * placa de Comunicación— y no por cómo se llaman.
 *
 * La marca vive en `metaJson.templateKey` de la versión vigente. El editor la conserva al
 * guardar (manda `meta` con lo que recibió del servidor), así que sobrevive a cualquier edición.
 *
 * Existe porque el carnet se buscaba como "la plantilla editada más recientemente" y después se
 * fijaba si era la suya. Con una sola plantilla en la institución daba lo mismo; con una segunda
 * —cualquier placa— el carnet volvía sin aviso al diseño de fábrica cada vez que alguien tocaba
 * la otra. Acá se busca por la marca, entre todas.
 */

export type KeyedTemplateRef = {
  templateId: string;
  versionId: string;
  templateKey: string;
  name: string;
  updatedAt: Date;
};

export function templateKeyOf(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const key = (meta as { templateKey?: unknown }).templateKey;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/**
 * Las plantillas con marca de una institución, con la marca de su versión vigente.
 *
 * Si dos plantillas tuvieran la misma marca (una duplicada a mano, por ejemplo), gana la editada
 * más recientemente: es la que la persona está mirando.
 */
export async function listKeyedTemplates(workspaceId: string): Promise<KeyedTemplateRef[]> {
  const plantillas = await prisma.templateV2.findMany({
    where: { workspaceId, status: { not: "ARCHIVED" }, currentVersionId: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, name: true, currentVersionId: true, updatedAt: true },
  });
  if (plantillas.length === 0) return [];

  const versiones = await prisma.templateV2Version.findMany({
    where: { id: { in: plantillas.map((p) => p.currentVersionId as string) } },
    select: { id: true, metaJson: true },
  });
  const marcaPorVersion = new Map(versiones.map((v) => [v.id, templateKeyOf(v.metaJson)]));

  const vistas = new Set<string>();
  const resultado: KeyedTemplateRef[] = [];
  for (const p of plantillas) {
    const key = marcaPorVersion.get(p.currentVersionId as string);
    if (!key || vistas.has(key)) continue;
    vistas.add(key);
    resultado.push({
      templateId: p.id,
      versionId: p.currentVersionId as string,
      templateKey: key,
      name: p.name,
      updatedAt: p.updatedAt,
    });
  }
  return resultado;
}

/** La marca de una plantilla concreta de la institución, o `null` si no la tiene o no es suya. */
export async function templateKeyForTemplate(
  workspaceId: string,
  templateId: string,
): Promise<{ found: boolean; templateKey: string | null }> {
  const plantilla = await prisma.templateV2.findFirst({
    where: { id: templateId, workspaceId },
    select: { currentVersionId: true },
  });
  if (!plantilla) return { found: false, templateKey: null };
  if (!plantilla.currentVersionId) return { found: true, templateKey: null };
  const version = await prisma.templateV2Version.findUnique({
    where: { id: plantilla.currentVersionId },
    select: { metaJson: true },
  });
  return { found: true, templateKey: templateKeyOf(version?.metaJson) };
}

export type LoadedTemplate = {
  templateId: string;
  versionId: string;
  /** El documento con el que dibujar, ya traducido desde el modelo del editor. */
  document: unknown;
  /** Variables que inventó el puente y que la emisión tiene que recibir (QR de URL fija). */
  variablesSinteticas: VariableSintetica[];
  /** Lo que no se pudo traducir del diseño. */
  avisos: string[];
};

/** Distingue una plantilla sembrada antes del puente de una del editor. */
function esDocumentoDeImpresion(canvasJson: unknown): boolean {
  if (!canvasJson || typeof canvasJson !== "object" || Array.isArray(canvasJson)) return false;
  const c = canvasJson as Record<string, unknown>;
  return Array.isArray(c.sides) && typeof c.format === "object";
}

/**
 * Busca la plantilla con esa marca y la devuelve lista para dibujar.
 *
 * `null` si la institución todavía no la creó: quien llama decide si usar el diseño de fábrica.
 */
export async function loadKeyedTemplate(input: {
  workspaceId: string;
  templateKey: string;
  /** Nombre del documento traducido; sólo aparece en los metadatos del PDF. */
  documentName: string;
  /** Lienzo a suponer si la versión no guardó su tamaño. */
  fallbackCanvas: { width: number; height: number };
}): Promise<LoadedTemplate | null> {
  const ref = (await listKeyedTemplates(input.workspaceId)).find(
    (t) => t.templateKey === input.templateKey,
  );
  if (!ref) return null;

  const version = await prisma.templateV2Version.findUnique({
    where: { id: ref.versionId },
    select: { id: true, canvasJson: true },
  });
  if (!version) return null;

  /*
   * Plantillas sembradas antes del puente: `canvasJson` guardaba el documento de impresión
   * entero, y no había filas de bloques. Se devuelve tal cual —ya es un documento válido— en
   * vez de migrarla: la próxima vez que alguien la edite se guardará en el formato nuevo.
   */
  if (esDocumentoDeImpresion(version.canvasJson)) {
    return {
      templateId: ref.templateId,
      versionId: version.id,
      document: version.canvasJson,
      variablesSinteticas: [],
      avisos: [],
    };
  }

  // Los bloques no viven en `canvasJson` —ahí sólo está el tamaño del lienzo—, sino en su propia
  // tabla. Leer únicamente el canvas devolvía un diseño sin ningún bloque.
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
    // Lo mismo que en la vista previa: `{clave}` y `{{clave}}` tienen que valer igual.
    variablesConocidas: getAllowedVariableKeysForProduct("fotoffice"),
  });

  return {
    templateId: ref.templateId,
    versionId: version.id,
    document: puente.document,
    variablesSinteticas: puente.variablesSinteticas,
    avisos: puente.avisos,
  };
}

export type CreateKeyedTemplateResult =
  | { ok: true; templateId: string; versionId: string; created: boolean }
  | { ok: false; error: string };

/**
 * Copia un diseño de fábrica a una plantilla editable de la institución, con su marca.
 *
 * Idempotente: si ya hay una con esa marca, la devuelve sin tocarla. Volver a crearla borraría
 * el trabajo de quien la haya editado.
 */
export async function createKeyedTemplate(input: {
  workspaceId: string;
  userId: number;
  templateKey: string;
  name: string;
  description: string;
  /** Documento de `@repo/design-studio` (milímetros y puntos). */
  document: unknown;
}): Promise<CreateKeyedTemplateResult> {
  try {
    const existente = (await listKeyedTemplates(input.workspaceId)).find(
      (t) => t.templateKey === input.templateKey,
    );
    if (existente) {
      return {
        ok: true,
        templateId: existente.templateId,
        versionId: existente.versionId,
        created: false,
      };
    }

    const creado = await prisma.$transaction(async (tx) => {
      const template = await tx.templateV2.create({
        data: {
          ownerUserId: input.userId,
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      // El diseño de fábrica se guarda traducido al modelo del editor. Guardarlo como documento
      // de impresión haría que el editor lo abriera en blanco: no entiende ese formato.
      const semilla = documentoAEditor(input.document);

      const version = await tx.templateV2Version.create({
        data: {
          templateId: template.id,
          versionNumber: 1,
          canvasJson: semilla.canvas as object,
          metaJson: { templateKey: input.templateKey, product: "fotoffice", origin: "system" },
          createdByUserId: input.userId,
        },
        select: { id: true },
      });

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

      await tx.templateV2.update({
        where: { id: template.id },
        data: { currentVersionId: version.id },
      });

      return { templateId: template.id, versionId: version.id };
    });

    return { ok: true, ...creado, created: true };
  } catch (error) {
    // Las tablas del módulo de diseño podrían no existir en una base sin migrar.
    const message = error instanceof Error ? error.message : String(error);
    if (/(?:table|relation).*does not exist/i.test(message)) {
      return { ok: false, error: "El módulo de diseño todavía no está habilitado en esta base." };
    }
    throw error;
  }
}
