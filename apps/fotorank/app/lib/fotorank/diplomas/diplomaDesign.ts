import "server-only";
import { prisma } from "@repo/db";
import { DIPLOMA_TEMPLATE_KEY, readDiplomaDesignLink, type DiplomaDesignLink } from "../design/constants";
import { diplomaDesignDocument } from "../design/documents";
import {
  archiveDesignTemplate,
  copyDesignTemplate,
  createDesignTemplate,
} from "../design/templates";

/**
 * Las plantillas de diploma de un concurso, diseñadas en el diseñador compartido.
 *
 * `FotorankDiplomaTemplate` sigue siendo la fila por concurso —la referencian los diplomas
 * emitidos y guarda nombre y estado—, pero el diseño vive en `TemplateV2`. La fila sólo guarda a
 * cuál apunta (`layoutJson = { engine: "designer", designTemplateId }`).
 */

/** A4 apaisado en puntos: lo que la fila declara como tamaño (sólo informativo). */
const A4_APAISADO_PT = { widthPt: 842, heightPt: 595 };

export async function createDiplomaTemplate(input: {
  organizationId: string;
  contestId: string;
  userId: number;
  name: string;
  status: "DRAFT" | "ACTIVE";
}): Promise<{ id: string }> {
  const diseno = await createDesignTemplate({
    organizationId: input.organizationId,
    userId: input.userId,
    name: input.name,
    description: "Diploma de concurso",
    meta: { templateKey: DIPLOMA_TEMPLATE_KEY, contestId: input.contestId },
    document: diplomaDesignDocument(),
  });
  const link: DiplomaDesignLink = { engine: "designer", designTemplateId: diseno.templateId };
  return prisma.fotorankDiplomaTemplate.create({
    data: {
      organizationId: input.organizationId,
      contestId: input.contestId,
      name: input.name.slice(0, 120),
      status: input.status,
      ...A4_APAISADO_PT,
      backgroundColor: "#fbf8f1",
      layoutJson: link,
      createdByUserId: input.userId,
    },
    select: { id: true },
  });
}

export async function duplicateDiplomaTemplate(input: {
  organizationId: string;
  contestId: string;
  userId: number;
  sourceLayoutJson: unknown;
  name: string;
}): Promise<{ id: string } | null> {
  const origen = readDiplomaDesignLink(input.sourceLayoutJson);
  if (!origen) return null;
  const copia = await copyDesignTemplate({
    organizationId: input.organizationId,
    templateId: origen.designTemplateId,
    userId: input.userId,
    name: input.name,
  });
  if (!copia) return null;
  const link: DiplomaDesignLink = { engine: "designer", designTemplateId: copia.templateId };
  return prisma.fotorankDiplomaTemplate.create({
    data: {
      organizationId: input.organizationId,
      contestId: input.contestId,
      name: input.name.slice(0, 120),
      status: "DRAFT",
      ...A4_APAISADO_PT,
      backgroundColor: "#fbf8f1",
      layoutJson: link,
      createdByUserId: input.userId,
    },
    select: { id: true },
  });
}

/** Al borrar la fila se archiva su diseño (nunca se borra: podría tener imágenes compartidas). */
export async function archiveDiplomaDesign(organizationId: string, layoutJson: unknown): Promise<void> {
  const link = readDiplomaDesignLink(layoutJson);
  if (link) await archiveDesignTemplate(organizationId, link.designTemplateId);
}

/**
 * Si el concurso no tiene ninguna plantilla del diseñador, crea el "Diploma estándar".
 * Sin `revalidatePath`: la llama la página mientras se dibuja, y ahí Next no lo permite.
 */
export async function ensureDefaultDiplomaTemplate(input: {
  organizationId: string;
  contestId: string;
  userId: number;
}): Promise<boolean> {
  const existentes = await prisma.fotorankDiplomaTemplate.findMany({
    where: { contestId: input.contestId, organizationId: input.organizationId },
    select: { layoutJson: true },
  });
  // Sólo cuentan las del diseñador: las del editor anterior ya no sirven para emitir.
  if (existentes.some((t) => readDiplomaDesignLink(t.layoutJson))) return false;
  await createDiplomaTemplate({ ...input, name: "Diploma estándar", status: "ACTIVE" });
  return true;
}
