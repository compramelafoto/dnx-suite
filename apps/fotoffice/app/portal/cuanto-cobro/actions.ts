"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { accesoCuantoCobroSocio, guardarPerfilSocio } from "@/lib/cuanto-cobro-socio/perfil";
import { RUTA_CUANTO_COBRO_SOCIO } from "@/lib/cuanto-cobro-socio/constants";
import type { ResultadoPerfilPrecios } from "@/app/workspace/configuracion/precios/actions";

/**
 * Guarda el perfil de ¿Cuánto Cobro? de quien está en sesión. El dueño del perfil sale de la
 * sesión, nunca de los datos recibidos; y sólo guarda quien hoy puede ver la sección (socio activo
 * de una institución que la encendió).
 *
 * `versionCargada`: la fecha (ISO) del perfil que mostró el formulario, o null si no había. Si
 * cambió desde entonces (otra pestaña), no se pisa.
 */
export async function guardarPerfilSocioAction(perfil: unknown, versionCargada?: string | null): Promise<ResultadoPerfilPrecios> {
  const user = await requireAuth();
  if (!(await accesoCuantoCobroSocio(user.id))) {
    return { ok: false, error: "¿Cuánto Cobro? no está disponible en tu portal." };
  }
  let esperado: Date | null | undefined;
  if (typeof versionCargada === "string") {
    esperado = new Date(versionCargada);
    if (Number.isNaN(esperado.getTime())) return { ok: false, error: "Los datos del perfil no son válidos." };
  } else if (versionCargada === null) {
    esperado = null;
  }
  const r = await guardarPerfilSocio(user.id, perfil, esperado === undefined ? {} : { esperado });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(RUTA_CUANTO_COBRO_SOCIO);
  return { ok: true, actualizado: r.actualizado.toISOString() };
}
