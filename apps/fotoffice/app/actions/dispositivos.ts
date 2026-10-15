"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_GALERIA } from "@/lib/galerias/acceso";
import { contextoDeGalerias } from "@/lib/galerias/contexto";
import { anularDispositivo, crearDispositivo } from "@/lib/galerias/dispositivos";

// Conectar y anular dispositivos de DNX FLUX: sólo dueño o administrador ("configurar").

export async function crearDispositivoAction(nombre: unknown): Promise<{ ok: true; clave: string } | { ok: false; error: string }> {
  const ctx = await contextoDeGalerias("configurar");
  if (!ctx) return { ok: false, error: MENSAJES_GALERIA.sinPermiso };
  const r = await crearDispositivo(ctx, nombre);
  if (!r.ok) return r;
  revalidatePath("/workspace/configuracion/galeria");
  return { ok: true, clave: r.clave };
}

export async function anularDispositivoAction(id: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await contextoDeGalerias("configurar");
  if (!ctx) return { ok: false, error: MENSAJES_GALERIA.sinPermiso };
  const r = await anularDispositivo(ctx, id);
  if (r.ok) revalidatePath("/workspace/configuracion/galeria");
  return r;
}
