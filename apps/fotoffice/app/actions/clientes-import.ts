"use server";

import { revalidatePath } from "next/cache";
import { contextoDeContactos } from "@/lib/contactos/acceso";
import {
  importarClientes,
  MENSAJES_IMPORTACION,
  previsualizarImportacionClientes,
  type ResultadoAnalisis,
  type ResultadoImportacion,
} from "@/lib/clients/importar";

// Archivo "use server": sólo exporta funciones async. Importar clientes pide "Gestionar" en
// Clientes; el workspace sale siempre de la sesión.

/** Paso 1: vista previa con errores por fila. No escribe nada. */
export async function previsualizarImportacionClientesAction(texto: string): Promise<ResultadoAnalisis> {
  const ctx = await contextoDeContactos("operar");
  if (!ctx) return { ok: false, error: MENSAJES_IMPORTACION.sinPermiso };
  return previsualizarImportacionClientes(ctx, texto);
}

/** Paso 2: vuelve a analizar el mismo texto y crea las filas válidas con su perfil. */
export async function importarClientesAction(texto: string): Promise<ResultadoImportacion> {
  const ctx = await contextoDeContactos("operar");
  if (!ctx) return { ok: false, error: MENSAJES_IMPORTACION.sinPermiso };
  const r = await importarClientes(ctx, texto);
  if (r.ok && r.creados > 0) revalidatePath("/clientes");
  return r;
}
