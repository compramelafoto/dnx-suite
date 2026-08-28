import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, Prisma } from "@repo/db";
import { CARNET_TEMPLATE_KEY, carnetDesignDocument } from "./template";
import {
  documentoAEditor,
  editorADocumento,
  type VariableSintetica,
} from "./bridge";

/**
 * La plantilla del carnet, guardada en el módulo de diseño.
 *
 * Hasta ahora el diseño vivía en código y no había forma de editarlo. Acá se lo copia a una
 * plantilla real que la institución puede abrir en el editor y modificar.
 *
 * La creación es **explícita**: nunca ocurre por visitar una ruta. Es el mismo criterio que
 * gobierna el resto de FotoOffice — visitar una pantalla no debe crear datos.
 */

const CARNET_NAME = "Carnet de socio";

/** Marca que identifica a la plantilla del carnet entre las demás del workspace. */
function esCarnet(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  return (meta as { templateKey?: unknown }).templateKey === CARNET_TEMPLATE_KEY;
}

/** Distingue una plantilla sembrada antes del puente de una del editor. */
function esDocumentoDeImpresion(canvasJson: unknown): boolean {
  if (!canvasJson || typeof canvasJson !== "object" || Array.isArray(canvasJson)) return false;
  const c = canvasJson as Record<string, unknown>;
  return Array.isArray(c.sides) && typeof c.format === "object";
}

export type CarnetTemplate = {
  templateId: string;
  versionId: string;
  /** El documento con el que dibujar, ya traducido desde el modelo del editor. */
  document: unknown;
  /** Variables que inventó el puente y que la emisión tiene que recibir (QR de URL fija). */
  variablesSinteticas: VariableSintetica[];
  /** Lo que no se pudo traducir del diseño. */
  avisos: string[];
};

/**
 * Busca la plantilla del carnet de una institución.
 *
 * Devuelve `null` si todavía no la creó: quien llama decide si usar el diseño de fábrica o
 * pedirle a alguien que la cree.
 */
export async function findCarnetTemplate(workspaceId: string): Promise<CarnetTemplate | null> {
  const template = await prisma.templateV2.findFirst({
    where: { workspaceId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, currentVersionId: true },
  });
  if (!template?.currentVersionId) return null;

  const version = await prisma.templateV2Version.findUnique({
    where: { id: template.currentVersionId },
    select: { id: true, canvasJson: true, metaJson: true },
  });
  if (!version || !esCarnet(version.metaJson)) return null;

  /*
   * Plantillas sembradas antes del puente: `canvasJson` guardaba el documento de impresión
   * entero, y no había filas de bloques. Se reconoce por tener `sides`, que el lienzo del
   * editor no tiene. Se devuelve tal cual —ya es un documento válido— en vez de migrarla:
   * una migración de datos acá arriesga el diseño de una institución para no ganar nada,
   * porque la próxima vez que alguien la edite se guardará en el formato nuevo.
   */
  if (esDocumentoDeImpresion(version.canvasJson)) {
    return {
      templateId: template.id,
      versionId: version.id,
      document: version.canvasJson,
      variablesSinteticas: [],
      avisos: [],
    };
  }

  // Los bloques no viven en `canvasJson` —ahí solo está el tamaño del lienzo—, sino en su
  // propia tabla. Leer únicamente el canvas devolvía un diseño sin ningún bloque, que es
  // como imprimir una tarjeta en blanco.
  const bloques = await prisma.templateV2Block.findMany({
    where: { templateVersionId: version.id },
    orderBy: [{ pageIndex: "asc" }, { zIndex: "asc" }],
  });

  const canvas = version.canvasJson as Record<string, unknown> | null;
  const puente = editorADocumento({
    canvas: {
      width: typeof canvas?.width === "number" ? canvas.width : 1011,
      height: typeof canvas?.height === "number" ? canvas.height : 638,
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
    nombre: CARNET_NAME,
  });

  return {
    templateId: template.id,
    versionId: version.id,
    document: puente.document,
    variablesSinteticas: puente.variablesSinteticas,
    avisos: puente.avisos,
  };
}

export type CreateCarnetResult =
  | { ok: true; templateId: string; versionId: string; created: boolean }
  | { ok: false; error: string };

/**
 * Copia el diseño de fábrica a una plantilla editable de la institución.
 *
 * Idempotente: si ya existe, la devuelve sin tocarla. Volver a crearla borraría el trabajo de
 * quien la haya editado.
 */
export async function createCarnetTemplate(input: {
  workspaceId: string;
  userId: number;
}): Promise<CreateCarnetResult> {
  const existente = await findCarnetTemplate(input.workspaceId);
  if (existente) {
    return {
      ok: true,
      templateId: existente.templateId,
      versionId: existente.versionId,
      created: false,
    };
  }

  try {
    const creado = await prisma.$transaction(async (tx) => {
      const template = await tx.templateV2.create({
        data: {
          ownerUserId: input.userId,
          workspaceId: input.workspaceId,
          name: CARNET_NAME,
          description: "El diseño de la credencial de socio, frente y dorso.",
          status: "ACTIVE",
        },
        select: { id: true },
      });

      // El diseño de fábrica se guarda traducido al modelo del editor. Guardarlo como
      // documento de impresión haría que el editor lo abriera en blanco: no entiende ese
      // formato, y quien fuera a retocar el carnet perdería el diseño de vista.
      const semilla = documentoAEditor(carnetDesignDocument());

      const version = await tx.templateV2Version.create({
        data: {
          templateId: template.id,
          versionNumber: 1,
          canvasJson: semilla.canvas as object,
          metaJson: { templateKey: CARNET_TEMPLATE_KEY, product: "fotoffice", origin: "system" },
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
