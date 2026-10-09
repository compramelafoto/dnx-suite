import "server-only";
import type { CtxProyectos } from "./acceso";
import { proyectosParaTarjeta, type ProyectoDeTarjeta } from "./tarjetas";

export type ProyectoDelPedido = ProyectoDeTarjeta;

/** Los proyectos de un pedido, para su ficha. Sin "Ver" en Proyectos, nada. Sólo del workspace. */
export async function proyectosDeUnPedido(ctx: CtxProyectos, pedidoId: string): Promise<ProyectoDelPedido[]> {
  return proyectosParaTarjeta(ctx, { pedidoId });
}
