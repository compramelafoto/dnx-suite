"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_PROYECTO } from "@/lib/proyectos/acceso";
import { contextoDeProyectos } from "@/lib/proyectos/contexto";
import { reintentarEnvio } from "@/lib/impresiones/trabajo-servidor";

/** «Reintentar envío» de un pedido de impresión pagado que no salió al laboratorio (desde la ficha del trabajo). */
export async function reintentarEnvioAction(pedidoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  const r = await reintentarEnvio(ctx, pedidoId);
  if (r.ok) revalidatePath("/proyectos/[id]", "page");
  return r;
}
