"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_PROYECTO } from "@/lib/proyectos/acceso";
import { contextoDeProyectos } from "@/lib/proyectos/contexto";
import { crearProyectoManual, type ResultadoProyectoManual } from "@/lib/proyectos/crear";

// Archivo "use server": sólo exporta funciones async. Cada acción revisa la forma de lo que llega,
// arma el contexto (sesión + workspace de la sesión + módulo `projects` encendido + "Gestionar" en
// Proyectos) y recién ahí escribe. Cada id se valida contra el workspace en `lib/proyectos`.

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function esId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

/** "Agregar proyecto" desde la ficha del pedido: flujo a elección y nombre, sin ítem. */
export async function agregarProyectoAction(datos: {
  pedidoId: string;
  circuitId: string;
  nombre?: string | null;
  ownerUserId?: number | null;
}): Promise<ResultadoProyectoManual> {
  if (!esObjeto(datos) || !esId(datos.pedidoId) || !esId(datos.circuitId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  if (datos.nombre != null && typeof datos.nombre !== "string") return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  if (datos.ownerUserId != null && typeof datos.ownerUserId !== "number") return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  const r = await crearProyectoManual(ctx, {
    pedidoId: datos.pedidoId,
    circuitId: datos.circuitId,
    nombre: datos.nombre ?? undefined,
    ownerUserId: datos.ownerUserId ?? undefined,
  });
  if (r.ok) revalidatePath(`/pedidos/${datos.pedidoId}`);
  return r;
}
