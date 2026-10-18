"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_PROYECTO } from "@/lib/proyectos/acceso";
import { contextoDeProyectos } from "@/lib/proyectos/contexto";
import {
  enviarAlProveedor,
  guardarProveedorDelTrabajo,
  type CambiosProveedorTrabajo,
  type ResultadoEnvio,
} from "@/lib/proyectos/proveedor";

const SIN_PERMISO = { ok: false as const, error: MENSAJES_PROYECTO.sinPermiso };

function revalidar(proyectoId: string) {
  revalidatePath(`/proyectos/${proyectoId}`);
  revalidatePath("/proyectos");
}

export async function guardarProveedorDelTrabajoAction(
  proyectoId: string,
  cambios: CambiosProveedorTrabajo,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await guardarProveedorDelTrabajo(ctx, proyectoId, cambios);
  if (r.ok) revalidar(proyectoId);
  return r;
}

export async function enviarAlProveedorAction(proyectoId: string, proveedorId: string, notas: string): Promise<ResultadoEnvio> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await enviarAlProveedor(ctx, proyectoId, proveedorId, notas);
  if (r.ok) revalidar(proyectoId);
  return r;
}
