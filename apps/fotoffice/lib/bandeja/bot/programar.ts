import "server-only";
import { after } from "next/server";
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
