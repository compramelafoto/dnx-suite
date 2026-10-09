import "server-only";
import { prisma } from "@repo/db";
import { puedeVerContratos, type CtxContratos } from "./acceso";
import { esEstadoContrato } from "./constantes";
import type { ContratoDeTarjeta } from "./tarjeta-tipos";
import { contratosEncendidos } from "./contexto";

export type { ContratoDeTarjeta };

const TOPE_TARJETA = 50;

/**
 * Contratos de un pedido o de un contacto, para las tarjetas. null si el módulo está apagado o la
 * persona no tiene "Ver" en Contratos (así la tarjeta no aparece y no se lee nada).
 */
export async function contratosParaTarjeta(ctx: CtxContratos, filtro: { pedidoId: string } | { clientId: string }): Promise<ContratoDeTarjeta[] | null> {
  if (!puedeVerContratos(ctx) || !(await contratosEncendidos(ctx.workspaceId))) return null;
  const filas = await prisma.fotofficeContrato.findMany({
    where: { workspaceId: ctx.workspaceId, ...filtro },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: TOPE_TARJETA,
    select: { id: true, number: true, name: true, status: true, createdAt: true, pedidoId: true, pedido: { select: { number: true } } },
  });
  return filas.map((f) => ({
    id: f.id,
    numero: f.number,
    nombre: f.name,
    estado: esEstadoContrato(f.status) ? f.status : "BORRADOR",
    creadoEn: f.createdAt.toISOString(),
    pedido: { id: f.pedidoId, numero: f.pedido.number },
  }));
}
