import "server-only";
import { prisma } from "@repo/db";
import { OFFICE_TEMPLATES, ROLE_TEMPLATES } from "./templates";

/**
 * Siembra las plantillas la primera vez que la institución abre la Comisión directiva.
 *
 * Sólo si no tiene NINGÚN rol ni cargo (archivados incluidos): si ya armó los suyos, o borró
 * plantillas a propósito, volver a sembrar le devolvería lo que sacó. Corre en una transacción
 * para que dos pestañas abiertas a la vez no siembren dos veces; si igual chocan, la clave única
 * (workspace, nombre) hace fallar a la segunda y la pantalla se recarga con lo de la primera.
 */
export async function ensureCommissionSetup(workspaceId: string): Promise<{ seeded: boolean }> {
  return prisma.$transaction(async (tx) => {
    const [roles, offices] = await Promise.all([
      tx.workspaceCustomRole.count({ where: { workspaceId } }),
      tx.workspaceOffice.count({ where: { workspaceId } }),
    ]);
    if (roles > 0 || offices > 0) return { seeded: false };

    for (const t of ROLE_TEMPLATES) {
      await tx.workspaceCustomRole.create({
        data: {
          workspaceId,
          name: t.name,
          description: t.description,
          templateKey: t.key,
          permissions: {
            create: t.permissions.map((p) => ({ moduleKey: p.moduleKey, level: p.level, actions: [...(p.actions ?? [])] })),
          },
        },
      });
    }
    await tx.workspaceOffice.createMany({
      data: OFFICE_TEMPLATES.map((o) => ({ workspaceId, name: o.name, votes: o.votes, order: o.order, templateKey: o.key })),
      skipDuplicates: true,
    });
    return { seeded: true };
  });
}
