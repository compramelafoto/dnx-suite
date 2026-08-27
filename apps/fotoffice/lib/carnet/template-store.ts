import "server-only";
import { prisma } from "@repo/db";
import { CARNET_TEMPLATE_KEY, carnetDesignDocument } from "./template";

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

export type CarnetTemplate = {
  templateId: string;
  versionId: string;
  /** El documento con el que dibujar. */
  document: unknown;
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

  return { templateId: template.id, versionId: version.id, document: version.canvasJson };
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

      const version = await tx.templateV2Version.create({
        data: {
          templateId: template.id,
          versionNumber: 1,
          canvasJson: carnetDesignDocument() as object,
          metaJson: { templateKey: CARNET_TEMPLATE_KEY, product: "fotoffice", origin: "system" },
          createdByUserId: input.userId,
        },
        select: { id: true },
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
