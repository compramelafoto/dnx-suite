/**
 * Pedidos que el carrito de evento crea con la misma ruta de pedidos de álbum
 * (`POST /api/a/[id]/orders`). La marca vive en memoria sobre el objeto `Request` que arma el
 * carrito: nadie de afuera la puede poner (no es un encabezado ni un campo del cuerpo), así la
 * ruta de siempre no cambia para ningún comprador.
 */
export type OpcionesPedidoDeCarrito = {
  /** Precio base por foto con los packs del evento (ver `packs-evento.ts`). */
  basePorFoto?: ReadonlyMap<number, number>;
};

const pedidosDeCarrito = new WeakMap<Request, OpcionesPedidoDeCarrito>();

export function marcarPedidoDeCarrito<T extends Request>(req: T, opciones: OpcionesPedidoDeCarrito = {}): T {
  pedidosDeCarrito.set(req, opciones);
  return req;
}

export function esPedidoDeCarrito(req: Request): boolean {
  return pedidosDeCarrito.has(req);
}

export function opcionesPedidoDeCarrito(req: Request): OpcionesPedidoDeCarrito | null {
  return pedidosDeCarrito.get(req) ?? null;
}
