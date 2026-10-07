"use server";

import { revalidatePath } from "next/cache";
import { contextoDeConsultas } from "@/lib/consultas/acceso";
import {
  importarConsultas,
  MENSAJES_IMPORTACION_CONSULTAS,
  previsualizarImportacionConsultas,
  type ResultadoAnalisisConsultas,
  type ResultadoImportacionConsultas,
} from "@/lib/consultas/importar";

// Archivo "use server": sólo exporta funciones async. Importar consultas pide "Gestionar" en
// Consultas (y el módulo encendido); el workspace sale siempre de la sesión.

/** Paso 1: vista previa con errores por fila. No carga consultas. */
export async function previsualizarImportacionConsultasAction(texto: string): Promise<ResultadoAnalisisConsultas> {
  const ctx = await contextoDeConsultas("operar");
  if (!ctx) return { ok: false, error: MENSAJES_IMPORTACION_CONSULTAS.sinPermiso };
  return previsualizarImportacionConsultas(ctx, texto);
}

/** Paso 2: vuelve a analizar el mismo texto y da de alta las filas válidas, sin avisos. */
export async function importarConsultasAction(texto: string): Promise<ResultadoImportacionConsultas> {
  const ctx = await contextoDeConsultas("operar");
  if (!ctx) return { ok: false, error: MENSAJES_IMPORTACION_CONSULTAS.sinPermiso };
  const r = await importarConsultas(ctx, texto);
  if (r.ok && r.creadas > 0) {
    revalidatePath("/consultas");
    revalidatePath("/consultas/lista");
  }
  return r;
}
