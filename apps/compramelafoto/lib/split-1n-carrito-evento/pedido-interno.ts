/**
 * Pedidos que el carrito de evento crea con la misma ruta de pedidos de álbum
 * (`POST /api/a/[id]/orders`). La marca vive en memoria sobre el objeto `Request` que arma el
 * carrito: nadie de afuera la puede poner (no es un encabezado ni un campo del cuerpo), así la
 * ruta de siempre no cambia para ningún comprador.
 */
const pedidosDeCarrito = new WeakSet<Request>();

export function marcarPedidoDeCarrito<T extends Request>(req: T): T {
  pedidosDeCarrito.add(req);
  return req;
}

export function esPedidoDeCarrito(req: Request): boolean {
  return pedidosDeCarrito.has(req);
}
