/**
 * Acciones del DNX Bot que el diagnóstico puede proponer y el admin aplicar desde la ficha.
 * Nada que mueva dinero. Todo envío va al mail del pedido.
 */
export const ACCIONES_PERMITIDAS = [
  "reenviar_descarga",
  "reenviar_link_pack",
  "reenviar_link_de_descarga",
  "extender_vencimiento",
  "cambiar_venta_de_foto",
  "editar_pack",
] as const;

export type AccionPermitida = (typeof ACCIONES_PERMITIDAS)[number];

/** Cambian datos del álbum o de los packs: el diagnóstico nunca las deja tildadas, las elige el admin. */
export const ACCIONES_QUE_MODIFICAN: readonly AccionPermitida[] = ["extender_vencimiento", "cambiar_venta_de_foto", "editar_pack"];
