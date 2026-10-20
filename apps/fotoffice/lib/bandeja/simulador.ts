import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";
import { TEXTO_MAXIMO } from "./constantes";
import { guardarConexion, leerConexion } from "./conexion";
import { aplicarEventos } from "./registro";
import { waIdDe } from "./telefono";
import type { EventoEntrante } from "./webhook";

/**
 * Simulador de mensajes entrantes (Configuración → WhatsApp). Arma el mismo evento ENTRANTE que el
 * parser del webhook y lo pasa por `aplicarEventos`: no hay otro camino de registro. Sólo en modo
 * SIMULADO y con `configurar`. Nunca loguea el texto ni el teléfono.
 */

export const MENSAJES_SIMULADOR = {
  sinPermiso: "Sólo un administrador puede simular mensajes.",
  soloSimulado: "El simulador sólo funciona en modo de prueba.",
  telefono: "El número de teléfono no es válido. Escribilo con código de área, por ejemplo 341 555-1234.",
  texto: "Escribí el mensaje.",
  textoLargo: `El mensaje no puede pasar de ${TEXTO_MAXIMO} caracteres.`,
  nombre: "El nombre es demasiado largo.",
  fallo: "No se pudo registrar el mensaje simulado.",
} as const;

export type DatosSimulador = { telefono?: unknown; nombre?: unknown; texto?: unknown };
export type ResultadoSimulador = { ok: true; chatId: string } | { ok: false; error: string };

export async function simularEntrante(ctx: CtxConsultas, datos: DatosSimulador, ahora: Date = new Date()): Promise<ResultadoSimulador> {
  if (ctx.userId === null || !puedeEnContexto(ctx, "configurar")) return { ok: false, error: MENSAJES_SIMULADOR.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_SIMULADOR.fallo };

  const conexion = await leerConexion(ctx.workspaceId);
  if (conexion.modo !== "SIMULADO") return { ok: false, error: MENSAJES_SIMULADOR.soloSimulado };

  const waId = typeof datos.telefono === "string" ? waIdDe(datos.telefono) : null;
  if (!waId) return { ok: false, error: MENSAJES_SIMULADOR.telefono };
  const texto = typeof datos.texto === "string" ? datos.texto.trim() : "";
  if (!texto) return { ok: false, error: MENSAJES_SIMULADOR.texto };
  if (texto.length > TEXTO_MAXIMO) return { ok: false, error: MENSAJES_SIMULADOR.textoLargo };
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
  if (nombre.length > 120) return { ok: false, error: MENSAJES_SIMULADOR.nombre };

  // Sin fila de conexión no hay a qué atar el chat: se crea la simulada por omisión.
  const hayFila = await prisma.fotofficeWaConexion.findUnique({ where: { workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!hayFila) {
    const g = await guardarConexion(ctx, {});
    if (!g.ok) return { ok: false, error: g.error };
  }

  const evento: EventoEntrante = {
    tipo: "ENTRANTE",
    phoneNumberId: conexion.phoneNumberId ?? "simulado",
    waMessageId: `sim-${randomUUID()}`,
    waId,
    en: ahora,
    nombre: nombre || null,
    mensajeTipo: "TEXTO",
    texto,
    media: null,
  };
  const r = await aplicarEventos([evento], ahora, { workspaceId: ctx.workspaceId });
  if (r.aplicados !== 1) return { ok: false, error: MENSAJES_SIMULADOR.fallo };
  const chat = await prisma.fotofficeWaChat.findUnique({ where: { workspaceId_waId: { workspaceId: ctx.workspaceId, waId } }, select: { id: true } });
  if (!chat) return { ok: false, error: MENSAJES_SIMULADOR.fallo };
  return { ok: true, chatId: chat.id };
}
