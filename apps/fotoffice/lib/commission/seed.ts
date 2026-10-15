import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";
import { isUniqueViolation } from "./rules";
import { OFFICE_TEMPLATES, ROLE_TEMPLATES } from "./templates";

/**
 * Siembra las plantillas la primera vez que la institución abre la Comisión directiva.
 *
 * Sólo si no tiene NINGÚN rol ni cargo (archivados incluidos): si ya armó los suyos, o borró
 * plantillas a propósito, volver a sembrar le devolvería lo que sacó. Corre en una transacción
 * para que dos pestañas abiertas a la vez no siembren dos veces; si igual chocan, la clave única
 * (workspace, nombre) frena a la segunda, que sigue con lo que sembró la primera.
 */
export async function ensureCommissionSetup(workspaceId: string): Promise<{ seeded: boolean }> {
  try {
    return await seed(workspaceId);
  } catch (e) {
    if (isUniqueViolation(e)) return { seeded: false };
    throw e;
  }
}

/**
 * Para layout y páginas: se renderizan en paralelo y las dos siembran. `cache` de React hace que
 * dentro de un mismo pedido compartan una sola siembra, y la página espera a que termine antes de
 * leer (si no, la primera visita podía mostrar las listas vacías).
 */
export const ensureCommissionSetupOnce = cache(ensureCommissionSetup);

async function seed(workspaceId: string): Promise<{ seeded: boolean }> {
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
