/** Id de la orden a consultar si el aviso puede ser del piloto; null si no corresponde mirar. */
export function idOrdenDelAviso(params: {
  enabled: boolean;
  type: string | null;
  dataId: string | null;
}): string | null {
  if (!params.enabled || params.type?.toLowerCase() !== "order") return null;
  const id = params.dataId?.trim();
  return id ? id : null;
}
