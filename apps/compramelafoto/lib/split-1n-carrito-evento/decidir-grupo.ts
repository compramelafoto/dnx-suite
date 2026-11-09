export type DecisionGrupo = {
  accion: "referencia_distinta" | "no_acreditada" | "confirmar";
  /** Pedidos que faltan pasar a pagados. */
  aConfirmar: number[];
  /** Pedidos ya pagados: sólo se les re-aseguran las comisiones (idempotente). */
  yaPagados: number[];
};

/**
 * Con qué se confirma un carrito de evento: la orden leída por GET en Mercado Pago, nunca lo
 * que diga el navegador. Confirmación por grupo, efectos por pedido: cada pedido pendiente se
 * confirma por su cuenta, así un pedido que falló lo completa el próximo aviso o visita.
 */
export function decidirFinalizacionGrupo(params: {
  grupoId: string;
  refGrupoId: string | null;
  mpStatus: string | null | undefined;
  mpStatusDetail: string | null | undefined;
  pedidos: Array<{ id: number; status: string }>;
}): DecisionGrupo {
  const vacio = { aConfirmar: [], yaPagados: [] };
  if (params.refGrupoId !== params.grupoId) return { accion: "referencia_distinta", ...vacio };
  const acreditada =
    params.mpStatus?.toLowerCase() === "processed" && params.mpStatusDetail?.toLowerCase() === "accredited";
  if (!acreditada) return { accion: "no_acreditada", ...vacio };
  return {
    accion: "confirmar",
    aConfirmar: params.pedidos.filter((p) => p.status === "PENDING" || p.status === "FAILED").map((p) => p.id),
    yaPagados: params.pedidos.filter((p) => p.status === "PAID").map((p) => p.id),
  };
}
