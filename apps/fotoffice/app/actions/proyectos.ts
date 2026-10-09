"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_PROYECTO } from "@/lib/proyectos/acceso";
import { contextoDeProyectos } from "@/lib/proyectos/contexto";
import { crearProyectoManual, type ResultadoProyectoManual } from "@/lib/proyectos/crear";
import { editarDatos, reanudar, reasignarTareas, suspender, type DatosEdicion, type ResultadoReasignacion } from "@/lib/proyectos/proyectos";
import {
  agregarParticipante, crearRol, editarParticipante, quitarParticipante,
  type DatosParticipante, type ResultadoParticipante, type ResultadoSimple,
} from "@/lib/proyectos/participantes";
import { agregarNota, borrarNota, editarNota, type ResultadoNota } from "@/lib/proyectos/notas";
import { borrarAdjunto, confirmarSubida, enlaceDeDescarga, pedirSubida, restaurarAdjunto, type ResultadoAdjunto } from "@/lib/proyectos/adjuntos";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { buscarContactos, type ContactoEncontrado } from "@/lib/consultas/ficha";

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

// --- Datos, suspensión y tareas -------------------------------------------------------------------

const DATOS_INVALIDOS = { ok: false, error: MENSAJES_PROYECTO.datosInvalidos } as const;
const SIN_PERMISO = { ok: false, error: MENSAJES_PROYECTO.sinPermiso } as const;
const ADJUNTOS_APAGADOS = { ok: false, error: "Los adjuntos todavía no están habilitados." } as const;

function revalidarProyecto(proyectoId: string): void {
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${proyectoId}`);
}

export async function editarProyectoAction(proyectoId: string, datos: DatosEdicion): Promise<ResultadoSimple> {
  if (!esId(proyectoId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await editarDatos(ctx, proyectoId, {
    name: datos.name,
    ownerUserId: datos.ownerUserId,
    delegateUserId: datos.delegateUserId,
    finalDueDate: datos.finalDueDate,
    description: datos.description,
  });
  if (r.ok) revalidarProyecto(proyectoId);
  return r;
}

export async function suspenderProyectoAction(proyectoId: string, motivo: string): Promise<ResultadoSimple> {
  if (!esId(proyectoId) || typeof motivo !== "string") return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await suspender(ctx, proyectoId, motivo);
  if (r.ok) {
    revalidarProyecto(proyectoId);
    revalidatePath("/dashboard");
  }
  return r;
}

export async function reanudarProyectoAction(proyectoId: string): Promise<ResultadoSimple> {
  if (!esId(proyectoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await reanudar(ctx, proyectoId);
  if (r.ok) {
    revalidarProyecto(proyectoId);
    revalidatePath("/dashboard");
  }
  return r;
}

export async function reasignarTareasAction(
  proyectoId: string,
  datos: { haciaUserId: number | null; taskIds?: string[]; desdeUserId?: number | null },
): Promise<ResultadoReasignacion> {
  if (!esId(proyectoId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await reasignarTareas(ctx, proyectoId, { haciaUserId: datos.haciaUserId, taskIds: datos.taskIds, desdeUserId: datos.desdeUserId });
  if (r.ok) {
    revalidarProyecto(proyectoId);
    revalidatePath("/dashboard");
  }
  return r;
}

/**
 * Buscador de contactos del equipo del proyecto: "Gestionar" en Proyectos y, además, "Ver" en
 * Clientes (regla R10: es el padrón de clientes).
 */
export async function buscarContactosProyectoAction(
  texto: string,
): Promise<{ ok: true; contactos: ContactoEncontrado[] } | { ok: false; error: string }> {
  if (typeof texto !== "string" || texto.length > 200) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  if (!puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)) return { ok: false, error: "Para buscar contactos necesitás permiso para ver Clientes." };
  return { ok: true, contactos: await buscarContactos(ctx.workspaceId, texto) };
}

// --- Equipo ---------------------------------------------------------------------------------------

export async function agregarParticipanteAction(proyectoId: string, datos: DatosParticipante): Promise<ResultadoParticipante> {
  if (!esId(proyectoId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await agregarParticipante(ctx, proyectoId, { userId: datos.userId, clientId: datos.clientId, roleId: datos.roleId, note: datos.note });
  if (r.ok) revalidarProyecto(proyectoId);
  return r;
}

export async function editarParticipanteAction(proyectoId: string, participanteId: string, datos: { roleId?: string | null; note?: string | null }): Promise<ResultadoSimple> {
  if (!esId(proyectoId) || !esId(participanteId) || !esObjeto(datos)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await editarParticipante(ctx, participanteId, { roleId: datos.roleId, note: datos.note });
  if (r.ok) revalidarProyecto(proyectoId);
  return r;
}

export async function quitarParticipanteAction(proyectoId: string, participanteId: string): Promise<ResultadoSimple> {
  if (!esId(proyectoId) || !esId(participanteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await quitarParticipante(ctx, participanteId);
  if (r.ok) revalidarProyecto(proyectoId);
  return r;
}

/** Alta de un rol de participante (quien configura el workspace). */
export async function crearRolAction(nombre: string): Promise<ResultadoParticipante> {
  if (typeof nombre !== "string" || nombre.length > 200) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  return crearRol(ctx, nombre);
}

// --- Notas ----------------------------------------------------------------------------------------

export async function agregarNotaAction(proyectoId: string, texto: string): Promise<ResultadoNota> {
  if (!esId(proyectoId) || typeof texto !== "string" || texto.length > 20_000) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await agregarNota(ctx, proyectoId, texto);
  if (r.ok) revalidarProyecto(proyectoId);
  return r;
}

export async function editarNotaAction(proyectoId: string, notaId: string, texto: string): Promise<ResultadoSimple> {
  if (!esId(proyectoId) || !esId(notaId) || typeof texto !== "string" || texto.length > 20_000) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await editarNota(ctx, notaId, texto);
  if (r.ok) revalidarProyecto(proyectoId);
  return r;
}

export async function borrarNotaAction(proyectoId: string, notaId: string): Promise<ResultadoSimple> {
  if (!esId(proyectoId) || !esId(notaId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  const r = await borrarNota(ctx, notaId);
  if (r.ok) revalidarProyecto(proyectoId);
  return r;
}

// --- Adjuntos -------------------------------------------------------------------------------------

export async function pedirSubidaAdjuntoAction(
  proyectoId: string,
  archivo: { nombre: string; tipo: string; tamano: number },
): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  if (!esId(proyectoId) || !esObjeto(archivo)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  if (!adjuntosR2Configurado()) return ADJUNTOS_APAGADOS;
  return pedirSubida(ctx, proyectoId, { nombre: archivo.nombre, tipo: archivo.tipo, tamano: archivo.tamano });
}

export async function confirmarSubidaAdjuntoAction(proyectoId: string, adjuntoId: string): Promise<ResultadoAdjunto> {
  if (!esId(proyectoId) || !esId(adjuntoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  if (!adjuntosR2Configurado()) return ADJUNTOS_APAGADOS;
  const r = await confirmarSubida(ctx, proyectoId, adjuntoId);
  if (r.ok) revalidarProyecto(proyectoId);
  return r;
}

export async function enlaceDeDescargaAdjuntoAction(proyectoId: string, adjuntoId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!esId(proyectoId) || !esId(adjuntoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("ver");
  if (!ctx) return SIN_PERMISO;
  if (!adjuntosR2Configurado()) return ADJUNTOS_APAGADOS;
  return enlaceDeDescarga(ctx, proyectoId, adjuntoId);
}

export async function borrarAdjuntoAction(proyectoId: string, adjuntoId: string): Promise<ResultadoAdjunto> {
  if (!esId(proyectoId) || !esId(adjuntoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  if (!adjuntosR2Configurado()) return ADJUNTOS_APAGADOS;
  const r = await borrarAdjunto(ctx, proyectoId, adjuntoId);
  if (r.ok) revalidarProyecto(proyectoId);
  return r;
}

export async function restaurarAdjuntoAction(proyectoId: string, adjuntoId: string): Promise<ResultadoAdjunto> {
  if (!esId(proyectoId) || !esId(adjuntoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeProyectos("operar");
  if (!ctx) return SIN_PERMISO;
  if (!adjuntosR2Configurado()) return ADJUNTOS_APAGADOS;
  const r = await restaurarAdjunto(ctx, proyectoId, adjuntoId);
  if (r.ok) revalidarProyecto(proyectoId);
  return r;
}
