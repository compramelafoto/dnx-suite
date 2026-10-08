import "server-only";
import { prisma } from "@repo/db";

/**
 * Ata una plantilla recién creada (o duplicada) a la organización de quien la creó.
 *
 * El servicio compartido no conoce organizaciones —en ComprameLaFoto y Clickatón la plantilla
 * es de una persona—, así que el vínculo se establece acá. Sin esto la copia de un diploma
 * quedaría sólo a nombre de quien apretó "duplicar".
 */
export async function atarAOrganizacion(
  templateId: string,
  organizationId: string | null | undefined,
): Promise<void> {
  if (!organizationId) return;
  await prisma.templateV2.update({ where: { id: templateId }, data: { workspaceId: organizationId } });
}
