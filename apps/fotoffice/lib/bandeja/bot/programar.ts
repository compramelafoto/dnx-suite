import "server-only";
import { after } from "next/server";
import { descargarMedios } from "../medios";
import { responderConBot } from "./responder";

/**
 * Programa la respuesta del bot para después de contestar la petición (webhook de Meta o
 * simulador): Meta exige respuesta rápida y el turno del bot tarda segundos. `responderConBot`
 * nunca lanza. Fuera de una petición (no debería pasar) corre suelto.
 */
export function programarBot(chatIds: readonly string[]): void {
  if (chatIds.length === 0) return;
  const correr = () => Promise.all(chatIds.map((id) => responderConBot(id))).then(() => undefined);
  try {
    after(correr);
  } catch {
    void correr();
  }
}

/**
 * Después de registrar un aviso de Meta: primero baja los archivos que mandó el cliente (la URL de
 * Meta vence en minutos y el bot tiene que ver la resolución) y recién después contesta el bot.
 */
export function programarTrasRegistro(r: { medios: readonly string[]; paraElBot: readonly string[] }): void {
  if (r.medios.length === 0 && r.paraElBot.length === 0) return;
  const correr = async () => {
    await descargarMedios(r.medios);
    await Promise.all(r.paraElBot.map((id) => responderConBot(id)));
  };
  try {
    after(correr);
  } catch {
    void correr();
  }
}
