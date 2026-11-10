/** Id de la orden a consultar si el aviso puede ser del piloto; null si no corresponde mirar. */
export function idOrdenDelAviso(params: {
  enabled: boolean;
  type: string | null;
  dataId: string | null;
}): string | null {
  // `order` (tarjeta) y `orders_v2` (Checkout Pro sobre Orders, según su documentación).
  const tipo = params.type?.toLowerCase();
  if (!params.enabled || (tipo !== "order" && tipo !== "orders_v2")) return null;
  const id = params.dataId?.trim();
  return id ? id : null;
}
