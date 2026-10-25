import "server-only";
import { leerTokenTelegram } from "@/lib/integrations/telegram/credentials";
import { contestarBoton, mandarMensaje, type DepsTelegramApi } from "@/lib/telegram/api";
import { vincularChat, type ConexionTelegram, type ResultadoVinculo } from "@/lib/telegram/conexion";
import { aprobacionDelBoton, type UpdateTelegram } from "@/lib/telegram/webhook";
import { aprobarYEnviar, type DepsFlujo } from "./flujo";

/**
 * Lo que hace el webhook de Telegram con cada aviso ya verificado (secreto correcto, conexión
 * encontrada):
 * - `/start <código>` en un chat privado → vincula ese chat (y le contesta);
 * - un botón "Aprobar y enviar" → sólo si viene del chat vinculado y la aprobación es del mismo
 *   workspace (`aprobarYEnviar` busca por id Y workspace) → aprueba. Telegram puede repetir el
 *   mismo aviso: aprobar es idempotente, el segundo toque contesta "ya se envió".
 * Nunca lanza.
 */

export const TEXTOS_VINCULO: Record<ResultadoVinculo, string> = {
  VINCULADO: "¡Listo! Este chat quedó vinculado a FOTOFFICE. Acá te van a llegar los presupuestos para aprobar.",
  YA_VINCULADO: "Este chat ya está vinculado. Acá te llegan los presupuestos para aprobar.",
  CODIGO_INVALIDO: "Ese enlace ya no sirve (vence a los 30 minutos o ya se usó). Pedí uno nuevo en FOTOFFICE → Configuración → Telegram.",
  NO_PRIVADO: "Para recibir los avisos, abrí el bot en un chat privado (no en un grupo).",
};

export type DepsWebhookTelegram = DepsTelegramApi & {
  ahora?: () => Date;
  leerToken?: (workspaceId: string) => Promise<string | null>;
  vincular?: typeof vincularChat;
  aprobar?: typeof aprobarYEnviar;
  flujo?: DepsFlujo;
};

export async function procesarUpdateTelegram(conexion: ConexionTelegram, update: UpdateTelegram, deps: DepsWebhookTelegram = {}): Promise<void> {
  try {
    if (update.tipo === "OTRO") return;
    const token = await (deps.leerToken ?? leerTokenTelegram)(conexion.workspaceId);
    if (!token) return;
    const ahora = (deps.ahora ?? (() => new Date()))();

    if (update.tipo === "START") {
      const r = await (deps.vincular ?? vincularChat)(conexion, update, ahora);
      await mandarMensaje(token, update.chatId, TEXTOS_VINCULO[r], null, deps);
      return;
    }

    // Botón: sólo desde el chat vinculado (en un chat privado el chat es la persona).
    if (!conexion.chatId || update.chatId !== conexion.chatId || update.deId !== conexion.chatId) {
      await contestarBoton(token, update.callbackId, "Este botón no es para este chat.", deps);
      return;
    }
    const aprobacionId = aprobacionDelBoton(update.data);
    if (!aprobacionId) {
      await contestarBoton(token, update.callbackId, "No entendí ese botón.", deps);
      return;
    }
    let contestado = false;
    const r = await (deps.aprobar ?? aprobarYEnviar)(conexion.workspaceId, aprobacionId, { tipo: "TELEGRAM" }, {
      ...deps.flujo,
      alReclamar: async () => {
        contestado = true;
        await contestarBoton(token, update.callbackId, "Enviando el presupuesto…", deps);
      },
    });
    if (!contestado) await contestarBoton(token, update.callbackId, r.texto, deps);
    else if (!r.ok) await mandarMensaje(token, conexion.chatId, r.texto, null, deps);
  } catch {
    console.error("[telegram] no se pudo procesar un aviso", { codigo: "INTERNO" });
  }
}
