import "server-only";
import { prisma } from "@repo/db";
import { numeroDe } from "@/lib/numeracion/asignar";
import { TIPO_CONSULTA } from "@/lib/service-leads/numero";
import { nombreDeContacto } from "./listado";

/**
 * Lecturas de "Nuevo presupuesto" (sólo servidor, acotadas al workspace de la sesión). La página
 * decide con los permisos qué se pide: las consultas recientes sólo con "Ver" en Consultas.
 */

export type ConsultaParaElegir = { id: string; etiqueta: string };

const TOPE_RECIENTES = 100;

function etiqueta(numero: string | undefined, contacto: string, categoria: string | null): string {
  return [numero ? `N° ${numero}` : null, contacto, categoria].filter(Boolean).join(" · ");
}

async function etiquetas(workspaceId: string, filas: { leadId: string; client: Parameters<typeof nombreDeContacto>[0]; category: { name: string } | null }[]) {
  const numeros = await numeroDe(workspaceId, TIPO_CONSULTA, filas.map((f) => f.leadId));
  return filas.map((f) => ({ id: f.leadId, etiqueta: etiqueta(numeros.get(f.leadId), nombreDeContacto(f.client), f.category?.name ?? null) }));
}

const SELECT = {
  leadId: true,
  client: { select: { firstName: true, lastName: true, businessName: true } },
  category: { select: { name: true } },
} as const;

/** Una consulta del workspace (con contacto), o null. */
export async function consultaParaPresupuesto(workspaceId: string, leadId: string): Promise<ConsultaParaElegir | null> {
  const f = await prisma.fotofficeConsulta.findFirst({ where: { workspaceId, leadId }, select: SELECT });
  return f ? (await etiquetas(workspaceId, [f]))[0]! : null;
}

/** Las consultas más recientes del workspace, o las de un contacto. */
export async function consultasParaPresupuesto(workspaceId: string, clientId?: string | null): Promise<ConsultaParaElegir[]> {
  const filas = await prisma.fotofficeConsulta.findMany({
    where: { workspaceId, ...(clientId ? { clientId } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: TOPE_RECIENTES,
    select: SELECT,
  });
  return etiquetas(workspaceId, filas);
}

/** El contacto del workspace, para precargar "Nuevo presupuesto" desde su ficha. */
export async function contactoParaPresupuesto(workspaceId: string, clientId: string) {
  const c = await prisma.client.findFirst({
    where: { workspaceId, id: clientId },
    select: { id: true, firstName: true, lastName: true, businessName: true, email: true, phone: true },
  });
  return c ? { id: c.id, nombre: nombreDeContacto(c), email: c.email, telefono: c.phone } : null;
}
