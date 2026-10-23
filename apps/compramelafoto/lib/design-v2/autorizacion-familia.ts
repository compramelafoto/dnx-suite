import "server-only";
import type { Prisma } from "@prisma/client";
import { anularAutorizacion, parseRevisionDelCliente } from "@/lib/revision-de-impresion/autorizacion";

/**
 * La autorización que da la familia al diseño en el canje deja de valer cuando el diseño cambia
 * por algo que la familia no vio: se pasó a otra versión de la plantilla o el fotógrafo retocó el
 * armado a mano.
 *
 * La autorización vive en el JSON de la revisión vigente (`dataJson.clientReview`). Se anula y
 * queda guardada en `clientReview.revoked` con la fecha y el motivo (la prueba no se borra).
 * Devuelve `true` si había una autorización vigente.
 */
export async function invalidarAutorizacionDeLaFamilia(
  tx: Prisma.TransactionClient,
  designProjectId: number,
  motivo: string,
): Promise<boolean> {
  const d = await tx.designProject.findUnique({
    where: { id: designProjectId },
    select: { currentRevision: { select: { id: true, dataJson: true } } },
  });
  const rev = d?.currentRevision;
  const data = rev?.dataJson;
  if (!rev || !data || typeof data !== "object" || Array.isArray(data)) return false;
  const actual = parseRevisionDelCliente((data as Record<string, unknown>).clientReview);
  const { revision, anulada } = anularAutorizacion(actual, motivo, new Date());
  if (!anulada) return false;
  await tx.designRevision.update({
    where: { id: rev.id },
    data: { dataJson: { ...(data as Record<string, unknown>), clientReview: revision } as Prisma.InputJsonValue },
  });
  return true;
}
