import { isFotofficeHost } from "@/lib/website/domain/routing";
import { STORE_PUBLIC_SEGMENT } from "./constants";

/**
 * Cómo se llega a la página de un pedido sin cuenta. Módulo PURO.
 *
 * El acceso es un token (ver `access-token.ts`) que viaja de dos formas: en la dirección
 * (`?t=`, la vuelta de Mercado Pago y los correos) y en una cookie de este navegador. Cuando
 * llega por la dirección se guarda en la cookie y se saca de la dirección, para que no quede en
 * el historial ni se comparta al copiar el enlace.
 */

export function storeOrderCookieName(publicId: string): string {
  return `fo_ped_${publicId}`;
}

/**
 * La parte de la dirección que VE el navegador hasta la tienda. En el dominio de FOTOFFICE es
 * `/w/<slug>/tienda`; en el dominio propio de la institución (`sfpr.com.ar/tienda/...`, que el
 * `proxy.ts` reescribe por dentro) es `/tienda`. La cookie se ata a esta ruta: con la otra, el
 * navegador no la mandaría nunca.
 */
export function storeVisibleBase(input: { slug: string; host: string; fotofficeOrigin: string }): string {
  return isFotofficeHost(input.host, input.fotofficeOrigin)
    ? `/w/${input.slug}/${STORE_PUBLIC_SEGMENT}`
    : `/${STORE_PUBLIC_SEGMENT}`;
}

/** Los parámetros de la vuelta de Mercado Pago que la página usa; el resto (y el token) se descarta. */
export function keptReturnParams(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const nombre of ["pago", "payment_id"]) {
    const valor = params.get(nombre);
    if (valor) out.set(nombre, valor);
  }
  return out;
}

/** Un `publicId` con la forma de `newPublicId` (`ped_` + base32 en minúscula). Lo demás ni se busca. */
export function isWellFormedPublicId(raw: string): boolean {
  return /^ped_[a-z2-7]{8,40}$/.test(raw);
}
