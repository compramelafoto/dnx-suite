"use server";

import { refresh, revalidatePath } from "next/cache";
import { after } from "next/server";
import { generarResumen } from "@/lib/bandeja/resumen";
import { avisarDerivacion } from "@/lib/bandeja/telegram";
import { MENSAJES_BANDEJA } from "@/lib/bandeja/acceso";
import {
  agregarNota,
  crearContactoDesdeChat,
  derivar,
  devolverAlBot,
  excluirDelBot,
  marcarLeido,
  resolver,
  responder,
  tomar,
  vincularCliente,
  type Resultado,
} from "@/lib/bandeja/acciones";
import { contextoDeBandeja } from "@/lib/bandeja/contexto";
import { buscarClientes, type ClienteBuscado } from "@/lib/bandeja/lecturas";
import { enviarPlantillaDesdePanel } from "@/lib/bandeja/plantillas";

// Archivo "use server": sólo exporta funciones async. Cada acción arma primero el contexto desde la
// sesión (usuario + workspace activo + módulo encendido + nivel) y recién ahí actúa. El workspace y
// el usuario NUNCA se reciben por argumento; el `chatId` se valida contra el workspace de la sesión.

const SIN_ACCESO = { ok: false as const, error: MENSAJES_BANDEJA.sinPermiso };

function revalidarChat(chatId: string): void {
  // `refresh()` le dice al navegador que vuelva a pedir la pantalla actual al terminar la acción.
  refresh();
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

/** Manda una plantilla aprobada de Meta (la única forma de escribir pasadas las 24 h). */
export async function enviarPlantillaAction(
  chatId: string,
  plantilla: { nombre: string; idioma: string; valores: string[]; boton?: string },
  clientToken: string,
) {
  const p = typeof plantilla === "object" && plantilla !== null ? plantilla : { nombre: "", idioma: "", valores: [] };
  return conOperar(chatId, (ctx, id) => enviarPlantillaDesdePanel(ctx, id, { nombre: p.nombre, idioma: p.idioma, valores: p.valores, boton: p.boton }, clientToken));
}

export async function tomarAction(chatId: string) {
  return conOperar(chatId, (ctx, id) => tomar(ctx, id));
}

export async function devolverAlBotAction(chatId: string) {
  return conOperar(chatId, (ctx, id) => devolverAlBot(ctx, id));
}

export async function excluirDelBotAction(chatId: string, excluir: boolean) {
  return conOperar(chatId, (ctx, id) => excluirDelBot(ctx, id, excluir === true));
}

/** Nota interna: sólo la ve el equipo (no sale al cliente ni la lee el bot). */
export async function agregarNotaAction(chatId: string, texto: string) {
  return conOperar(chatId, (ctx, id) => agregarNota(ctx, id, texto));
}

/** Deriva el chat a una persona del equipo (su id) o al bot (`"bot"`). El servidor valida el destino. */
export async function derivarAction(chatId: string, destino: number | "bot") {
  return conOperar(chatId, async (ctx, id) => {
    const r = await derivar(ctx, id, destino);
    // A una persona: el resumen se arma en segundo plano (no frena la pantalla).
    // Si se lo derivó a quien usa Telegram, le llega la tarjeta con ese resumen (§7.2.1).
    if (r.ok && r.cambio && destino !== "bot") {
      after(async () => {
        const resumen = await generarResumen(ctx.workspaceId, id);
        await avisarDerivacion(ctx.workspaceId, id, { userId: ctx.userId, nombre: ctx.userLabel }, { resumir: async () => resumen });
      });
    }
    return r;
  });
}

/** Vuelve a armar el resumen de la charla (cuenta en el tope de gasto del bot). */
export async function actualizarResumenAction(chatId: string) {
  return conOperar(chatId, async (ctx, id) => {
    const resumen = await generarResumen(ctx.workspaceId, id);
    return resumen ? { ok: true as const } : { ok: false as const, error: "No se pudo armar el resumen ahora. Probá más tarde." };
  });
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
  if (r.ok) {
    refresh();
    revalidatePath("/bandeja");
  }
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

/** "Verificar comprobante": lee la imagen y busca el pago en el Mercado Pago del estudio. */
export async function verificarComprobanteAction(chatId: string, mensajeId: string) {
  return conOperar(chatId, async (ctx, id) => {
    if (typeof mensajeId !== "string" || !mensajeId) return { ok: false as const, error: MENSAJES_BANDEJA.noExiste };
    const { verificarComprobante } = await import("@/lib/bandeja/comprobante/verificar-servidor");
    return verificarComprobante(ctx, id, mensajeId);
  });
}
