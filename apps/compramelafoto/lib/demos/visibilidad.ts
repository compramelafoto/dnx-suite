/**
 * Visibilidad de los datos de prueba en las demos grabables. Los paneles del fotógrafo y del
 * colegio esconden los pedidos de prueba (`isTest`) o los muestran como "DEMO" en cero; en una demo
 * eso arruina la grabación. Solo los dueños demo los ven como pedidos normales. Los informes, las
 * estadísticas y las finanzas de admin no pasan por acá y siguen excluyéndolos.
 */

import { prisma } from "@/lib/prisma";
import { esUsuarioDemo } from "@/lib/demos/identidad";

export function incluirPedidosDePrueba(viewer: { tags?: string[] | null } | null | undefined): boolean {
  return esUsuarioDemo(viewer);
}

export async function usuarioIncluyePruebas(userId: number): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tags: true } });
  return incluirPedidosDePrueba(u);
}

/** Una escuela es de demo si su dueño (el fotógrafo) es un usuario demo. */
export async function esEscuelaDemo(schoolId: number): Promise<boolean> {
  const s = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { owner: { select: { tags: true } } },
  });
  return esUsuarioDemo(s?.owner);
}
