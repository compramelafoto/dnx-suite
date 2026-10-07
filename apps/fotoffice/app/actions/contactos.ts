"use server";

import { revalidatePath } from "next/cache";
import { contextoDeContactos } from "@/lib/contactos/acceso";
import { guardarPerfil, MENSAJES_PERFIL, type DatosPerfil, type ResultadoPerfil } from "@/lib/contactos/perfil";

// Archivo "use server": sólo exporta funciones async. El contexto (sesión + workspace de la
// sesión + módulo encendido + "Gestionar" en Clientes) se arma antes de leer o escribir;
// `guardarPerfil` vuelve a verificar el permiso y que el cliente sea del workspace.

/** Guarda los datos ampliados del contacto (ficha del cliente). */
export async function guardarPerfilContactoAction(input: { clientId: string; datos: DatosPerfil }): Promise<ResultadoPerfil> {
  const ctx = await contextoDeContactos("operar");
  if (!ctx) return { ok: false, error: MENSAJES_PERFIL.sinPermiso };
  if (!input || typeof input !== "object" || !input.datos || typeof input.datos !== "object") {
    return { ok: false, error: MENSAJES_PERFIL.revisar };
  }
  const r = await guardarPerfil(ctx, input.clientId, input.datos);
  if (r.ok && typeof input.clientId === "string") {
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${input.clientId}`);
  }
  return r;
}
