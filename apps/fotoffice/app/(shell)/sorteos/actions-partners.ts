"use server";

import { requireRafflesAdmin } from "@/lib/raffles/access";
import { searchPartners } from "@/lib/raffles/repository";

/**
 * Buscador de aliados del formulario de premios.
 *
 * Vive aparte de `actions.ts` porque devuelve datos en vez de redirigir, y porque la
 * convención del proyecto es que un archivo `"use server"` exporte funciones de una sola
 * clase. Lleva su propio control de acceso: una acción de servidor es una ruta pública
 * aunque se la llame desde un componente.
 */
export async function buscarAliadosAction(texto: string) {
  await requireRafflesAdmin();
  return searchPartners(texto);
}
