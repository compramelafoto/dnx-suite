import "server-only";
import { prisma } from "@repo/db";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import type { CuantoCobroStudioStructure, StudioLocalSales } from "@repo/cuanto-cobro-core";
import { diaArgentino } from "@/lib/dnx-bot/dia-argentino";
import { ofreceMiEstudio } from "./estudio";
import { ventasDelLocal } from "./local-servidor";

export type MiembroParaVincular = { userId: number; etiqueta: string };

/**
 * Lo que necesita «Mi estudio» en Configuración → Precios: si el workspace es de tipo estudio y los
 * miembros del workspace (para vincular cada persona del equipo con su usuario). Sólo lee; nunca
 * invita a nadie. Se recorren las dos tablas de membresía (conviven durante la unificación).
 */
export type DatosDeMiEstudio = {
  ofrece: boolean;
  miembros: MiembroParaVincular[];
  categoriasIngreso: { id: string; nombre: string }[];
  ventasLocal: StudioLocalSales | null;
};

export async function datosDeMiEstudio(workspaceId: string, estructura?: CuantoCobroStudioStructure | null): Promise<DatosDeMiEstudio> {
  const [branding, unificadas, legado, categorias, ventasLocal] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { organizationType: true, activityType: true } }),
    prisma.workspaceMembership.findMany({ where: { workspaceId }, select: { userId: true, user: { select: { name: true, email: true } } } }),
    prisma.membership.findMany({ where: { workspaceId }, select: { userId: true, user: { select: { name: true, email: true } } } }),
    prisma.cashCategory.findMany({ where: { workspaceId, kind: "INGRESO", isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    estructura ? ventasDelLocal(workspaceId, estructura, diaArgentino()) : Promise.resolve(null),
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
    categoriasIngreso: categorias.map((c) => ({ id: c.id, nombre: c.name })),
    ventasLocal,
  };
}
