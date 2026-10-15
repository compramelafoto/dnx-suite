import "server-only";
import { prisma } from "@repo/db";

import { esSlugDnx } from "@/lib/slug-dnx";

export { SLUG_DNX } from "@/lib/slug-dnx";

/** El único campo que DNX usa en Alboom; la migración (etapa 8) completa sus valores. */
export const CAMPO_INICIAL_DNX = {
  entityType: "CLIENTE",
  key: "archivos_del_cliente",
  name: "Archivos del cliente",
  type: "ENLACE",
} as const;

/**
 * DNX Estudio arranca con "Archivos del cliente" (Enlace) en Clientes. Se crea sólo si el
 * workspace no tiene ningún campo de clientes (archivados incluidos): si alguien lo borró o
 * armó los suyos, no vuelve. Idempotente; el resto de los workspaces arranca sin campos.
 */
export async function asegurarCamposIniciales(workspaceId: string, slug: string): Promise<void> {
  if (!esSlugDnx(slug)) return;
  // Lo común es que ya tenga campos: un conteo simple, sin abrir transacción.
  if ((await prisma.fotofficeCustomField.count({ where: { workspaceId, entityType: CAMPO_INICIAL_DNX.entityType } })) > 0) return;
  try {
    await prisma.$transaction(async (tx) => {
      if ((await tx.fotofficeCustomField.count({ where: { workspaceId, entityType: CAMPO_INICIAL_DNX.entityType } })) > 0) return;
      await tx.fotofficeCustomField.create({
        data: { workspaceId, ...CAMPO_INICIAL_DNX, required: false, showInList: false, order: 0 },
        select: { id: true },
      });
    });
  } catch (e) {
    // Otra pestaña lo creó en el mismo instante: el índice único nos frena; da igual.
    if ((e as { code?: unknown })?.code !== "P2002") throw e;
  }
}
