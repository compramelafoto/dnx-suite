import type { AssistantIntent } from "../models/assistant.js";

/** Respuestas stub por intención — sin precios ni IA. */
export const REPLY_TEXT_BY_INTENT: Record<AssistantIntent, string> = {
  GREETING:
    "¡Hola! Soy el asistente del estudio (modo simulación). Puedo ayudarte con consultas sobre servicios fotográficos o presupuestos.",
  GENERAL_SERVICE_INQUIRY:
    "Gracias por tu interés en nuestros servicios fotográficos. En esta etapa solo clasifico tu consulta; pronto podré darte más detalle.",
  QUOTE_REQUEST:
    "Entendí que pedís un presupuesto. Todavía no calculo precios ni armo cotizaciones; en etapas siguientes pediré los datos necesarios.",
  AFFIRMATIVE: "Perfecto, gracias por confirmar. Continuemos cuando estés listo/a.",
  NEGATIVE: "Entendido. Si más adelante querés retomar, escribime.",
  THANKS: "¡De nada! Cualquier otra consulta sobre fotografía del estudio, acá estoy.",
  HUMAN_HANDOFF_REQUEST:
    "Registré que preferís hablar con una persona. En esta etapa no derivo todavía; más adelante un humano tomará la conversación.",
  OUT_OF_SCOPE:
    "Esa consulta parece fuera del alcance del estudio fotográfico. Puedo ayudarte con servicios de fotografía y presupuestos del estudio.",
  UNKNOWN:
    "Recibí tu mensaje, pero todavía no identifiqué claramente la intención. ¿Buscás info de servicios, un presupuesto, o hablar con alguien del estudio?",
};
