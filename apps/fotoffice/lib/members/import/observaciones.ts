import type { Prisma } from "@repo/db";

/** Mismo id que la conversión única del SQL: así importar dos veces nunca duplica la nota. */
export function idObservacionesDeSocio(memberId: string): string {
  return `obs_m_${memberId}`;
}

/**
 * Las observaciones que trae el CSV (columna `notes`) se guardan también como nota fijada de
 * la ficha, con el mismo formato que la conversión de la migración: categoría nula
 * ("Observaciones"), sin autor, "Importado". Si el socio ya tiene cliente enlazado, la nota
 * es del cliente (el dueño de lo nuevo en la ficha). La columna vieja se sigue escribiendo
 * aparte, para el listado y la exportación. Corre dentro de la transacción de la importación.
 */
export async function guardarObservacionesImportadas(
  tx: Pick<Prisma.TransactionClient, "client" | "fotofficeNote">,
  workspaceId: string,
  member: { id: string; notes: string | null },
): Promise<void> {
  const body = member.notes;
  if (!body || !body.trim()) return;
  const cliente = await tx.client.findFirst({
    where: { workspaceId, memberId: member.id },
    select: { id: true },
  });
  await tx.fotofficeNote.createMany({
    data: [
      {
        id: idObservacionesDeSocio(member.id),
        workspaceId,
        clientId: cliente?.id ?? null,
        memberId: cliente ? null : member.id,
        categoryId: null,
        body,
        pinned: true,
        authorUserId: null,
        authorLabel: "Importado",
      },
    ],
    // Si ya existe (misma persona importada o convertida antes), se deja como está.
    skipDuplicates: true,
  });
}
