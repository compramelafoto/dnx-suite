"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_PROYECTO } from "@/lib/proyectos/acceso";
import { contextoDeProyectos } from "@/lib/proyectos/contexto";
import { leerImportacion } from "@/lib/proyectos/importar-trabajos";
import { importarTrabajos, type ResultadoFila } from "@/lib/proyectos/importar-trabajos-servidor";

/** "Importar trabajos": el texto se vuelve a leer en el servidor (no se confía en la vista previa). */
export async function importarTrabajosAction(texto: string): Promise<{ ok: true; resultados: ResultadoFila[] } | { ok: false; error: string }> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (typeof texto !== "string" || texto.length > 100_000) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const { filas } = leerImportacion(texto, hoy);
  const r = await importarTrabajos(ctx, filas);
  if (r.ok) {
    revalidatePath("/proyectos/en-curso");
    revalidatePath("/pedidos");
  }
  return r;
}
