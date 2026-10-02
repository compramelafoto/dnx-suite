import "server-only";
import type { Prisma } from "@repo/db";

type Extremo = { clientId: string | null; memberId: string | null };

function claveExtremo(e: Extremo): string {
  return e.clientId ? `c:${e.clientId}` : `m:${e.memberId}`;
}

/**
 * Cuando un socio se vincula a un cliente, lo que estaba guardado bajo el socio pasa al
 * cliente, que es el dueño de la persona (ver `duenoDe`). Corre dentro de la transacción
 * del vínculo: o se muda todo o no se muda nada.
 *
 * - Notas, adjuntos y eventos: cambian de dueño.
 * - Etiquetas: se mueven las que el cliente no tiene; las repetidas se borran del socio.
 * - Relaciones: el extremo del socio pasa a ser el cliente; se borran las que quedarían
 *   apuntando a sí mismas o repetidas (el mismo par de personas en cualquier sentido).
 */
export async function mudarPiezasDelSocioAlCliente(
  tx: Prisma.TransactionClient,
  { workspaceId, memberId, clientId }: { workspaceId: string; memberId: string; clientId: string },
): Promise<{ notas: number; etiquetas: number; adjuntos: number; relaciones: number; eventos: number }> {
  const alCliente = { clientId, memberId: null };
  const suyas = { workspaceId, memberId };

  const notas = await tx.fotofficeNote.updateMany({ where: suyas, data: alCliente });
  const adjuntos = await tx.fotofficeAttachment.updateMany({ where: suyas, data: alCliente });
  const eventos = await tx.fotofficePersonEvent.updateMany({ where: suyas, data: alCliente });

  // Etiquetas.
  const delCliente = await tx.fotofficeTagAssignment.findMany({
    where: { workspaceId, clientId },
    select: { tagId: true },
  });
  const yaTiene = new Set(delCliente.map((a) => a.tagId));
  const delSocio = await tx.fotofficeTagAssignment.findMany({ where: suyas, select: { id: true, tagId: true } });
  const repetidas = delSocio.filter((a) => yaTiene.has(a.tagId)).map((a) => a.id);
  const aMover = delSocio.filter((a) => !yaTiene.has(a.tagId)).map((a) => a.id);
  if (repetidas.length > 0) {
    await tx.fotofficeTagAssignment.deleteMany({ where: { workspaceId, id: { in: repetidas } } });
  }
  if (aMover.length > 0) {
    await tx.fotofficeTagAssignment.updateMany({ where: { workspaceId, id: { in: aMover } }, data: alCliente });
  }

  // Relaciones.
  const conSocio = await tx.fotofficePersonRelation.findMany({
    where: { workspaceId, OR: [{ fromMemberId: memberId }, { toMemberId: memberId }] },
  });
  const delClienteRel = await tx.fotofficePersonRelation.findMany({
    where: { workspaceId, OR: [{ fromClientId: clientId }, { toClientId: clientId }] },
  });
  // Repetida = el mismo par de personas en CUALQUIER sentido (A→B y B→A son lo mismo), sin
  // mirar el tipo de vínculo: la ficha no admite dos vínculos entre las mismas dos personas.
  const clave = (r: { from: Extremo; to: Extremo }) => [claveExtremo(r.from), claveExtremo(r.to)].sort().join("|");
  const vistas = new Set(
    delClienteRel.map((r) =>
      clave({
        from: { clientId: r.fromClientId, memberId: r.fromMemberId },
        to: { clientId: r.toClientId, memberId: r.toMemberId },
      }),
    ),
  );

  const aBorrar: string[] = [];
  let relaciones = 0;
  for (const r of conSocio) {
    const desdeSocio = r.fromMemberId === memberId;
    const haciaSocio = r.toMemberId === memberId;
    const from: Extremo = desdeSocio ? alCliente : { clientId: r.fromClientId, memberId: r.fromMemberId };
    const to: Extremo = haciaSocio ? alCliente : { clientId: r.toClientId, memberId: r.toMemberId };
    const k = clave({ from, to });
    if (claveExtremo(from) === claveExtremo(to) || vistas.has(k)) {
      aBorrar.push(r.id);
      continue;
    }
    vistas.add(k);
    const data: Prisma.FotofficePersonRelationUncheckedUpdateInput = {};
    if (desdeSocio) Object.assign(data, { fromClientId: clientId, fromMemberId: null });
    if (haciaSocio) Object.assign(data, { toClientId: clientId, toMemberId: null });
    await tx.fotofficePersonRelation.updateMany({ where: { workspaceId, id: r.id }, data });
    relaciones++;
  }
  if (aBorrar.length > 0) {
    await tx.fotofficePersonRelation.deleteMany({ where: { workspaceId, id: { in: aBorrar } } });
  }

  return { notas: notas.count, etiquetas: aMover.length, adjuntos: adjuntos.count, relaciones, eventos: eventos.count };
}
