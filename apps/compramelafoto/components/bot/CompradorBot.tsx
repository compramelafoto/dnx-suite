import { readBuyerBotConfig } from "@/lib/bot/comprador/config";
import { CompradorBotBubble } from "./CompradorBotBubble";

/** Con los interruptores apagados no se monta nada: ni una llamada a /estado por visita. */
export function CompradorBot() {
  return readBuyerBotConfig().enabled ? <CompradorBotBubble /> : null;
}
