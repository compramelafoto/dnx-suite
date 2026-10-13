// Regla: src/ui/** importa SOLO de archivos locales aptos para el navegador (../sse); NUNCA de ../index ni @repo/dnx-bot (arrastran el SDK de Anthropic y node:crypto).
export { DnxBotBubble, type DnxBotBubbleProps } from "./DnxBotBubble";
export type { Audiencia as DnxBotAudiencia } from "./comprador";
export { abrirDnxBot, EVENTO_ABRIR, type PedidoAbrir } from "./abrir";
