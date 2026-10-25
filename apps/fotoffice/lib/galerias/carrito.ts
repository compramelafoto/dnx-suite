import "server-only";
import type { Prisma } from "@repo/db";
import { calcularCarrito, type Carrito, type ConfigVenta } from "./precios";

/**
 * El carrito de un cliente (etapa 7, Entrega A2): lo que tiene elegido hoy y lo que ya pagó. Lo comparten el
 * estudio ("Marcar pagada a mano") y el cliente (abrir el pago y enviar la selección). El servidor es el único
 * que calcula el precio.
 */
type Tx = Prisma.TransactionClient;

export type ClienteCarrito = Pick<Tx, "fotofficeGaleriaSeleccion" | "fotofficeGaleriaCompra" | "fotofficeGaleriaCompraFoto">;

/** Fotos ya pagadas por el cliente (compras PAGADAS). */
export async function fotosPagadasDeCliente(c: ClienteCarrito, workspaceId: string, galeriaClienteId: string): Promise<Set<string>> {
  const compras = await c.fotofficeGaleriaCompra.findMany({ where: { workspaceId, galeriaClienteId, status: "PAGADA" }, select: { id: true } });
  if (compras.length === 0) return new Set();
  const fotos = await c.fotofficeGaleriaCompraFoto.findMany({ where: { compraId: { in: compras.map((x) => x.id) } }, select: { fotoId: true } });
  return new Set(fotos.map((f) => f.fotoId));
}

/** El carrito de un cliente con lo que tiene elegido hoy y lo que ya pagó (el servidor es el único que calcula el precio). */
export async function carritoDeCliente(c: ClienteCarrito, workspaceId: string, galeriaClienteId: string, config: ConfigVenta): Promise<Carrito> {
  const [selecciones, pagadas] = await Promise.all([
    c.fotofficeGaleriaSeleccion.findMany({ where: { workspaceId, galeriaClienteId }, select: { id: true, fotoId: true, createdAt: true } }),
    fotosPagadasDeCliente(c, workspaceId, galeriaClienteId),
  ]);
  return calcularCarrito({ config, seleccion: selecciones.map((s) => ({ id: s.id, fotoId: s.fotoId, seleccionadaEn: s.createdAt })), pagadas });
}

