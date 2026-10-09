"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_BANDEJA } from "@/lib/bandeja/acceso";
import {
  crearContactoDesdeChat,
  devolverAlBot,
  marcarLeido,
  resolver,
  responder,
  tomar,
  vincularCliente,
  type Resultado,
} from "@/lib/bandeja/acciones";
import { guardarConexion, MENSAJES_CONEXION, type DatosConexion, type ResultadoConexion } from "@/lib/bandeja/conexion";
import { contextoDeBandeja } from "@/lib/bandeja/contexto";

// Archivo "use server": sólo exporta funciones async. Cada acción arma primero el contexto desde la
// sesión (usuario + workspace activo + módulo encendido + nivel) y recién ahí actúa. El workspace y
// el usuario NUNCA se reciben por argumento; el `chatId` se valida contra el workspace de la sesión.

const SIN_ACCESO = { ok: false as const, error: MENSAJES_BANDEJA.sinPermiso };

function revalidarChat(chatId: string): void {
  revalidatePath("/bandeja");
  revalidatePath(`/bandeja/${chatId}`);
}

async function conOperar<T extends object>(
  chatId: unknown,
  accion: (ctx: NonNullable<Awaited<ReturnType<typeof contextoDeBandeja>>>, chatId: string) => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  const ctx = await contextoDeBandeja("operar");
  if (!ctx) return SIN_ACCESO;
  if (typeof chatId !== "string" || !chatId) return { ok: false, error: MENSAJES_BANDEJA.noExiste };
  const r = await accion(ctx, chatId);
  if (r.ok) revalidarChat(chatId);
  return r;
}

export async function responderAction(chatId: string, texto: string) {
  return conOperar(chatId, (ctx, id) => responder(ctx, id, texto));
}

export async function tomarAction(chatId: string) {
  return conOperar(chatId, (ctx, id) => tomar(ctx, id));
}

export async function devolverAlBotAction(chatId: string) {
  return conOperar(chatId, (ctx, id) => devolverAlBot(ctx, id));
}

export async function resolverAction(chatId: string) {
  return conOperar(chatId, (ctx, id) => resolver(ctx, id));
}

export async function vincularClienteAction(chatId: string, clientId: string) {
  return conOperar(chatId, (ctx, id) => vincularCliente(ctx, id, clientId));
}

export async function crearContactoDesdeChatAction(chatId: string, nombre?: string) {
  return conOperar(chatId, (ctx, id) => crearContactoDesdeChat(ctx, id, nombre));
}

/** Basta con "Ver": marcar como leído no cambia quién atiende el chat. */
export async function marcarLeidoAction(chatId: string): Promise<Resultado> {
  const ctx = await contextoDeBandeja("ver");
  if (!ctx) return SIN_ACCESO;
  if (typeof chatId !== "string" || !chatId) return { ok: false, error: MENSAJES_BANDEJA.noExiste };
  const r = await marcarLeido(ctx, chatId);
  if (r.ok) revalidatePath("/bandeja");
  return r;
}

/** Configuración → WhatsApp: sólo dueño y administradores. */
export async function guardarConexionAction(datos: DatosConexion): Promise<ResultadoConexion> {
  const ctx = await contextoDeBandeja("configurar");
  if (!ctx) return { ok: false, error: MENSAJES_CONEXION.sinPermiso };
  const r = await guardarConexion(ctx, datos);
  if (r.ok) revalidatePath("/bandeja");
  return r;
}
