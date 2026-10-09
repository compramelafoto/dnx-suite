"use server";

import { revalidatePath } from "next/cache";
import { contextoDeInformes, MENSAJES_INFORMES } from "@/lib/informes/acceso";
import { guardarAjustesInformes, type ResultadoAjustesInformes } from "@/lib/informes/ajustes";

// Archivo "use server": sólo exporta funciones async. La acción arma el contexto (sesión + workspace
// de la sesión + módulo `reports` encendido + `verDinero` + `configurar`) y recién ahí escribe.

/** Informes → Ajustes: saldo mínimo, categoría, tope y aviso del monotributo. */
export async function guardarAjustesInformesAction(datos: unknown): Promise<ResultadoAjustesInformes> {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return { ok: false, error: MENSAJES_INFORMES.datosInvalidos };
  const ctx = await contextoDeInformes("configurar");
  if (!ctx) return { ok: false, error: MENSAJES_INFORMES.sinPermiso };
  const r = await guardarAjustesInformes(ctx, datos);
  if (r.ok) {
    for (const ruta of ["/informes", "/informes/flujo", "/informes/monotributo", "/informes/ajustes"]) revalidatePath(ruta);
  }
  return r;
}
