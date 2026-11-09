import { leerMarcaGrupo } from "./marca";

/** Clave del comprobante único de un carrito de evento en la cola de correos. */
export function claveComprobanteGrupo(grupoId: string): string {
  return `order_confirmed_event_cart_${grupoId}`;
}

/**
 * Separa los pedidos pagados en sueltos (llevan su comprobante de siempre) y grupos de carrito
 * de evento (llevan un solo comprobante por grupo). Para la red de seguridad de comprobantes.
 */
export function separarPedidosDeGrupo(pedidos: Array<{ id: number; pricingSnapshot: unknown }>): {
  sueltos: number[];
  grupos: string[];
} {
  const sueltos: number[] = [];
  const grupos = new Set<string>();
  for (const p of pedidos) {
    const marca = leerMarcaGrupo(p.pricingSnapshot);
    if (marca) grupos.add(marca.grupoId);
    else sueltos.push(p.id);
  }
  return { sueltos, grupos: [...grupos] };
}
