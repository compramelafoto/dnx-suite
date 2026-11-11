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
import { avisarListoParaRetirar, type ResultadoAviso } from "@/lib/proyectos/aviso-listo-servidor";
import { moverAFase } from "@/lib/proyectos/avance";

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

/** Reenviar por correo el aviso de "Listo para retirar" (el WhatsApp ya salió al pasar a Listo). */
export async function avisarListoAction(proyectoId: string): Promise<ResultadoAviso> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  if (typeof proyectoId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(proyectoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const r = await avisarListoParaRetirar(ctx.workspaceId, proyectoId, ctx.userId, { soloCorreo: true });
  if (r.ok) revalidar(proyectoId);
  return r;
}

export type ResultadoLlego = { ok: true; etapa: string | null; avisado: string | null; avisoError: string | null } | { ok: false; error: string };

/**
 * Llegó del laboratorio: el trabajo pasa directo a "Listo para retirar" (salteando las etapas del
 * medio) y se le avisa al cliente por correo y por WhatsApp si los tiene.
 */
export async function llegoDelProveedorAction(proyectoId: string): Promise<ResultadoLlego> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  if (typeof proyectoId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(proyectoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const r = await moverAFase(ctx, proyectoId, "LISTO", "Llegó del laboratorio.");
  if (!r.ok) return r;
  revalidar(proyectoId);
  if (!r.movido) return { ok: true, etapa: r.etapa, avisado: null, avisoError: null };
  const aviso = await avisarListoParaRetirar(ctx.workspaceId, proyectoId, ctx.userId);
  return { ok: true, etapa: r.etapa, avisado: aviso.ok ? aviso.resumen : null, avisoError: aviso.ok ? null : aviso.error };
}

/**
 * «Ya las imprimí» (Ventas → Impresiones): las instantáneas de un pedido online quedaron impresas. El
 * trabajo pasa a «Listo para retirar» y el cliente recibe el aviso por correo y WhatsApp.
 */
export async function instantaneasImpresasAction(proyectoId: string): Promise<ResultadoLlego> {
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  if (typeof proyectoId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(proyectoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const r = await moverAFase(ctx, proyectoId, "LISTO", "Instantáneas impresas en el estudio.");
  if (!r.ok) return r;
  revalidar(proyectoId);
  revalidatePath("/ventas/impresiones");
  if (!r.movido) return { ok: true, etapa: r.etapa, avisado: null, avisoError: null };
  const aviso = await avisarListoParaRetirar(ctx.workspaceId, proyectoId, ctx.userId);
  return { ok: true, etapa: r.etapa, avisado: aviso.ok ? aviso.resumen : null, avisoError: aviso.ok ? null : aviso.error };
}
