"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cleanPlaceLabel, nearHref } from "@repo/muestras";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { normalizarBusqueda, ubicarConCache, type PuntoBuscado } from "./geocodificar";

export type EstadoBusquedaCerca = { error: string | null };

/**
 * "Buscá muestras cerca tuyo", de la portada. Pública: no pide sesión, así que se frena por IP
 * (`LIMITES_PUBLICOS`) y sólo devuelve un lugar (el primero habitable, en Argentina) como
 * coordenadas. No es un proxy de Nominatim: no devuelve la lista ni los datos de la dirección.
 * Las búsquedas se guardan un día (`ubicarConCache`) y el pedido tiene tiempo máximo.
 *
 * Si encuentra el lugar, redirige a la portada ordenada por cercanía; si no, devuelve el error
 * para mostrarlo debajo del campo. Anda también sin JavaScript (es la acción del formulario).
 */
export async function buscarCerca(_previo: EstadoBusquedaCerca, fd: FormData): Promise<EstadoBusquedaCerca> {
  const texto = cleanPlaceLabel(fd.get("q"));
  if (!texto || texto.length < 3) return { error: "Escribí una ciudad o una dirección." };

  const freno = frenarPorIp("buscarCerca", ipDeLaPeticion(await headers()));
  if (!freno.allowed) return { error: "Demasiadas búsquedas seguidas. Probá en un minuto." };

  let punto: PuntoBuscado | null;
  try {
    ({ punto } = await ubicarConCache(normalizarBusqueda(texto)));
  } catch (err) {
    console.error("buscarCerca:", err instanceof Error ? err.message : String(err));
    return { error: "No pudimos buscar ese lugar. Probá de nuevo en un rato." };
  }
  if (!punto) return { error: "No encontramos ese lugar en Argentina. Probá con el nombre de la ciudad." };

  // Lo que escribió la persona es lo que reconoce; la ciudad sólo si escribió una dirección larga.
  const lugar = texto.length > 30 && punto.city ? punto.city : texto;
  redirect(nearHref(punto, lugar));
}
