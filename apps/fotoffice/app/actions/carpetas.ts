"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_PROYECTO } from "@/lib/proyectos/acceso";
import { contextoDeProyectos } from "@/lib/proyectos/contexto";
import { prisma } from "@repo/db";
import { moverAFase } from "@/lib/proyectos/avance";
import { avisarListoParaRetirar } from "@/lib/proyectos/aviso-listo-servidor";
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

/** Recorridos donde los archivos SON lo que se entrega (digitalizaciones, revelado de rollos). */
const ENTREGA_DIGITAL = /nube|youtube|subid[oa]/i;

export type ResultadoArchivosListos = { ok: true; etapa: string | null; correo: string | null; avisoError: string | null } | { ok: false; error: string };

/**
 * Después de subir archivos: si el recorrido del trabajo es de entrega digital (tiene una etapa
 * tipo "Subido a la nube"), el trabajo pasa solo a "Listo para retirar" y el cliente recibe el
 * aviso con el enlace para descargarlos. Si ya estaba listo (o el recorrido no es digital), no
 * hace nada: subir más archivos no le manda otro correo.
 */
export async function archivosSubidosAction(proyectoId: string): Promise<ResultadoArchivosListos> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  if (typeof proyectoId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(proyectoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const j = await prisma.fotofficeJourney.findFirst({
    where: { workspaceId: ctx.workspaceId, subjectType: "PROYECTO", subjectId: proyectoId, stageId: { not: null } },
    select: { circuitId: true },
  });
  if (!j) return { ok: true, etapa: null, correo: null, avisoError: null };
  const etapas = await prisma.fotofficeStage.findMany({ where: { circuitId: j.circuitId, archivedAt: null }, select: { name: true } });
  if (!etapas.some((e) => ENTREGA_DIGITAL.test(e.name))) return { ok: true, etapa: null, correo: null, avisoError: null };

  const avance = await moverAFase(ctx, proyectoId, "LISTO", "Archivos subidos a la carpeta.");
  if (!avance.ok) return avance;
  if (!avance.movido) return { ok: true, etapa: null, correo: null, avisoError: null };
  const aviso = await avisarListoParaRetirar(ctx.workspaceId, proyectoId, ctx.userId);
  revalidatePath(`/proyectos/${proyectoId}`);
  revalidatePath("/proyectos");
  return { ok: true, etapa: avance.etapa, correo: aviso.ok ? aviso.email : null, avisoError: aviso.ok ? null : aviso.error };
}
