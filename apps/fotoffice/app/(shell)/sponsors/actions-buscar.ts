"use server";

import { requireSponsorsManager } from "@/lib/sponsors/access";
import { searchCatalog } from "@/lib/sponsors/repository";

/**
 * Buscador de la base común de sponsors. Vive aparte de `actions.ts` porque devuelve datos en
 * vez de redirigir. Lleva su propio control de acceso: una acción de servidor es una ruta
 * pública aunque se la llame desde un componente.
 */
export async function buscarEnCatalogoAction(texto: string) {
  const { workspace } = await requireSponsorsManager();
  return (await searchCatalog(workspace.id, texto)).map(({ id, name, logoSrc, linked }) => ({
    id,
    name,
    logoSrc,
    linked,
  }));
}
