import { prisma } from "@repo/db";

export type DeleteFormatOutcome = "deleted" | "deactivated" | "not_found";

/**
 * Borra el formato sólo si ningún pedido lo usa; si no, lo desactiva. El borrado es condicional
 * en una sola sentencia: no queda hueco entre "comprobar" y "borrar" en el que un pedido nuevo
 * pierda su `printFormatId` (la clave foránea es SetNull).
 */
export async function deleteOrDeactivatePrintFormat(workspaceId: string, id: string): Promise<DeleteFormatOutcome> {
  const { count } = await prisma.printFormat.deleteMany({ where: { id, workspaceId, orderItems: { none: {} } } });
  if (count > 0) return "deleted";
  const { count: desactivados } = await prisma.printFormat.updateMany({ where: { id, workspaceId }, data: { isActive: false } });
  return desactivados > 0 ? "deactivated" : "not_found";
}
