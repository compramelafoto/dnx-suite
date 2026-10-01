import { buildOpaqueExternalReference } from "@repo/payments";
import { SUBILAFOTO_PRODUCT_KEY } from "./constantes";

/**
 * La referencia con la que Mercado Pago devuelve el pago.
 *
 * Lleva prefijo de producto porque es la convención que Mercado Pago validó para toda la
 * suite: `<producto>-<entidad>-<idOpaco>`. Sin el prefijo, un aviso de pago no se puede
 * atribuir a SubiLaFoto.
 *
 * El constructor del paquete rechaza referencias con datos personales, pero **sus guardas
 * pierden fuerza una vez puesto el prefijo**: "Ana Gonzalez" deja de parecer un nombre
 * cuando la cadena es `subilafoto-orden-Ana Gonzalez`, porque tiene guiones. Del segmento
 * del id sólo revisa que no tenga arroba.
 *
 * Por eso acá se exige que el id sea **opaco de verdad** antes de armar nada. Es barato y
 * cierra el hueco: la referencia viaja a un tercero y queda en sus reportes.
 */
const ID_OPACO = /^[A-Za-z0-9_-]{6,64}$/;

export function referenciaDeOrden(ordenId: string): string {
  const id = ordenId.trim();
  if (!ID_OPACO.test(id)) {
    throw new Error(
      "El identificador de la orden tiene que ser opaco: letras, números, guiones y nada más.",
    );
  }
  return buildOpaqueExternalReference(SUBILAFOTO_PRODUCT_KEY, "orden", id);
}

/** Devuelve el id de la orden si la referencia es de SubiLaFoto, o `null`. */
export function ordenDesdeReferencia(referencia: string | null | undefined): string | null {
  if (!referencia) return null;
  const prefijo = `${SUBILAFOTO_PRODUCT_KEY}-orden-`;
  if (!referencia.startsWith(prefijo)) return null;
  const id = referencia.slice(prefijo.length).trim();
  return id || null;
}
