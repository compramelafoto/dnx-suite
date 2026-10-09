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
import { contextoDeBandeja } from "@/lib/bandeja/contexto";
import { buscarClientes, type ClienteBuscado } from "@/lib/bandeja/lecturas";

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

/** `clientToken`: lo genera el formulario una vez por envío (evita el doble envío en reintentos). */
export async function responderAction(chatId: string, texto: string, clientToken: string) {
  return conOperar(chatId, (ctx, id) => responder(ctx, id, texto, clientToken));
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

export async function vincularClienteAction(chatId: string, clientId: string, reemplazar = false) {
  return conOperar(chatId, (ctx, id) => vincularCliente(ctx, id, clientId, { reemplazar: reemplazar === true }));
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

/** Búsqueda de clientes para vincular un chat: pide "Gestionar" en la Bandeja y "Ver" en Clientes. */
export async function buscarClientesAction(q: string): Promise<{ ok: true; clientes: ClienteBuscado[] } | { ok: false; error: string }> {
  const ctx = await contextoDeBandeja("operar");
  if (!ctx) return SIN_ACCESO;
  const clientes = await buscarClientes(ctx, q);
  if (!clientes) return { ok: false, error: MENSAJES_BANDEJA.sinPermisoClientes };
  return { ok: true, clientes };
}
