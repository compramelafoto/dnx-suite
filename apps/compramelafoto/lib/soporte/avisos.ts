import { sendTelegramMessage } from "@repo/dnx-bot";
import { readBotConfig } from "@/lib/bot/config";

/** Aviso de soporte por el Telegram del DNX Bot. Nunca lanza: un aviso caído no frena el reclamo. */
export async function avisarSoporte(texto: string): Promise<void> {
  try {
    await sendTelegramMessage(readBotConfig().telegram, texto);
  } catch (err) {
    console.error("[soporte] aviso de Telegram falló:", err);
  }
}
