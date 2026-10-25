import "server-only";
import { prisma } from "@repo/db";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { ofreceMiEstudio } from "./estudio";

export type MiembroParaVincular = { userId: number; etiqueta: string };

/**
 * Lo que necesita «Mi estudio» en Configuración → Precios: si el workspace es de tipo estudio y los
 * miembros del workspace (para vincular cada persona del equipo con su usuario). Sólo lee; nunca
 * invita a nadie. Se recorren las dos tablas de membresía (conviven durante la unificación).
 */
export async function datosDeMiEstudio(workspaceId: string): Promise<{ ofrece: boolean; miembros: MiembroParaVincular[] }> {
  const [branding, unificadas, legado] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { organizationType: true, activityType: true } }),
    prisma.workspaceMembership.findMany({ where: { workspaceId }, select: { userId: true, user: { select: { name: true, email: true } } } }),
    prisma.membership.findMany({ where: { workspaceId }, select: { userId: true, user: { select: { name: true, email: true } } } }),
  ]);
  const porUsuario = new Map<number, MiembroParaVincular>();
  for (const fila of [...unificadas, ...legado]) {
    if (!porUsuario.has(fila.userId)) {
      porUsuario.set(fila.userId, { userId: fila.userId, etiqueta: etiquetaDeUsuario({ id: fila.userId, ...fila.user }) });
    }
  }
  return {
    ofrece: ofreceMiEstudio(branding),
    miembros: [...porUsuario.values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
  };
}
