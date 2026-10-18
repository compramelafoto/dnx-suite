"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_PROYECTO } from "@/lib/proyectos/acceso";
import { contextoDeProyectos } from "@/lib/proyectos/contexto";
import {
  borrarArchivo,
  confirmarSubida,
  enlaceDeCarpeta,
  pedirSubida,
  type ResultadoEnlace,
  type ResultadoSubida,
} from "@/lib/carpetas/carpeta";

const SIN_PERMISO = { ok: false as const, error: MENSAJES_PROYECTO.sinPermiso };

export async function pedirSubidaAction(proyectoId: string, nombre: string, tipo: string, bytes: number): Promise<ResultadoSubida> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  return pedirSubida(ctx, proyectoId, nombre, tipo, bytes);
}

export async function confirmarSubidaAction(proyectoId: string, archivoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await confirmarSubida(ctx, archivoId);
  if (r.ok) revalidatePath(`/proyectos/${proyectoId}`);
  return r;
}

export async function borrarArchivoAction(proyectoId: string, archivoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await borrarArchivo(ctx, archivoId);
  if (r.ok) revalidatePath(`/proyectos/${proyectoId}`);
  return r;
}

export async function enlaceDeCarpetaAction(proyectoId: string, audiencia: "CLIENTE" | "LABORATORIO"): Promise<ResultadoEnlace> {
  if (audiencia !== "CLIENTE" && audiencia !== "LABORATORIO") return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await enlaceDeCarpeta(ctx, proyectoId, audiencia);
  if (r.ok) revalidatePath(`/proyectos/${proyectoId}`);
  return r;
}
