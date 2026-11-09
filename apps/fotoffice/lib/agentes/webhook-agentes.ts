import "server-only";
import type { UpdateTelegram } from "@/lib/telegram/webhook";
import { cambiarBotones, contestarBoton, mandarMensaje, tokenAgentes, vincularChatAgentes, type DepsCanal } from "./canal";
import { esDelChatVinculado, type CanalAgentes } from "./canal-reglas";
import { corregirPropuesta, correrPeriodista, descartarPropuesta, publicarPropuesta, type DepsPeriodista } from "./periodista/flujo";
import { escaparHtml, leerBoton } from "./periodista/mensaje";
import { leerBotonVendedor } from "./vendedor/botones";
import { corregirVendedor, esMensajeDelVendedor, procesarBotonVendedor, type DepsModelos } from "./vendedor/modelos";

/**
 * Lo que hace el webhook del canal de agentes con cada aviso ya verificado:
 * - `/start <código>` → vincula el chat (sólo con el código vigente);
 * - un botón de una propuesta del Periodista (`pe:` Publicar / Otra noticia / Descartar) o del
 *   Vendedor (`ve:` Aprobar / Descartar un modelo, Enviar / Lo contesto yo una respuesta);
 * - un texto que responde a un mensaje → corrección del Vendedor si el mensaje es suyo (un modelo
 *   propuesto o una respuesta que espera a Daniel) y, si no, del Periodista.
 * Sólo se obedece al chat vinculado; a cualquier otro, silencio. Nunca lanza.
 */

export type DepsWebhookAgentes = DepsCanal & {
  periodista?: DepsPeriodista;
  correr?: typeof correrPeriodista;
  publicar?: typeof publicarPropuesta;
  descartar?: typeof descartarPropuesta;
  corregir?: typeof corregirPropuesta;
  vincular?: typeof vincularChatAgentes;
  vendedor?: {
    boton?: typeof procesarBotonVendedor;
    corregir?: typeof corregirVendedor;
    esDelVendedor?: typeof esMensajeDelVendedor;
    modelos?: DepsModelos;
  };
};

/** Si no se puede saber (p. ej. falta la tabla del Vendedor), la respuesta sigue yendo al Periodista. */
async function esDelVendedor(messageId: string, deps: DepsWebhookAgentes): Promise<boolean> {
  try {
    return await (deps.vendedor?.esDelVendedor ?? esMensajeDelVendedor)(messageId);
  } catch {
    return false;
  }
}

export async function procesarUpdateAgentes(canal: CanalAgentes, update: UpdateTelegram, deps: DepsWebhookAgentes = {}): Promise<void> {
  try {
    if (update.tipo === "OTRO") return;
    const token = deps.token === undefined ? tokenAgentes() : deps.token;
    if (!token) return;

    if (update.tipo === "START") {
      await (deps.vincular ?? vincularChatAgentes)(canal, update, token, deps);
      return;
    }

    if (update.tipo === "RESPUESTA") {
      if (!esDelChatVinculado(canal, update.chatId, update.deId)) return;
      if (await esDelVendedor(update.respondeA, deps)) {
        await (deps.vendedor?.corregir ?? corregirVendedor)(update.respondeA, update.texto, deps.vendedor?.modelos);
        return;
      }
      await (deps.corregir ?? corregirPropuesta)(update.respondeA, update.texto, deps.periodista);
      return;
    }

    if (!esDelChatVinculado(canal, update.chatId, update.deId) || !canal.chatId) return;
    const chatId = canal.chatId;
    const sacarBotones = () => (update.messageId ? cambiarBotones(token, chatId, update.messageId, null, deps) : Promise.resolve(null));

    // Vendedor: «Corregir» sólo explica cómo se corrige (respondiendo al mensaje); el resto, a su flujo.
    const botonVendedor = leerBotonVendedor(update.data);
    if (botonVendedor) {
      if (botonVendedor.accion === "CORREGIR") {
        await contestarBoton(token, update.callbackId, "Respondé a este mensaje con lo que querés cambiar.", deps);
        return;
      }
      const r = await (deps.vendedor?.boton ?? procesarBotonVendedor)(botonVendedor, deps.vendedor?.modelos);
      await contestarBoton(token, update.callbackId, r.texto, deps);
      if (r.ok) {
        await sacarBotones();
        await mandarMensaje(token, chatId, escaparHtml(r.texto), null, deps);
      }
      return;
    }

    const boton = leerBoton(update.data);
    if (!boton) {
      await contestarBoton(token, update.callbackId, "No entendí ese botón.", deps);
      return;
    }

    if (boton.accion === "PUBLICAR" || boton.accion === "DESCARTAR") {
      const r = await (boton.accion === "PUBLICAR" ? (deps.publicar ?? publicarPropuesta) : (deps.descartar ?? descartarPropuesta))(boton.propuestaId);
      await contestarBoton(token, update.callbackId, r.texto, deps);
      if (r.ok) {
        await sacarBotones();
        await mandarMensaje(token, chatId, escaparHtml(r.texto), null, deps);
      }
      return;
    }

    // Otra noticia: descarta esta (como "otra", para aprender) y corre de nuevo. La corrida nueva
    // excluye su fuente y, con énfasis, su tema (es un descarte de hoy).
    const d = await (deps.descartar ?? descartarPropuesta)(boton.propuestaId, { otra: true });
    if (!d.ok) {
      await contestarBoton(token, update.callbackId, d.texto, deps);
      return;
    }
    await contestarBoton(token, update.callbackId, "Buscando otra noticia…", deps);
    await sacarBotones();
    await mandarMensaje(token, chatId, "🔁 Descarté esa. Buscando otra noticia (tarda un par de minutos)…", null, deps);
    const r = await (deps.correr ?? correrPeriodista)({ motivo: "OTRA", forzar: true }, deps.periodista);
    // Si falló, `correrPeriodista` ya avisó; los demás casos (tope, ocupado) se cuentan acá.
    if (r.estado !== "CREADA" && r.estado !== "FALLO") await mandarMensaje(token, chatId, escaparHtml(r.mensaje), null, deps);
  } catch {
    console.error("[agentes] no se pudo procesar un aviso de Telegram", { codigo: "INTERNO" });
  }
}
