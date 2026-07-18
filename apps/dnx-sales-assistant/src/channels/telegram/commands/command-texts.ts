export const CMD_INICIO = `/inicio`;

export function textInicio(): string {
  return [
    "Hola, Dani. Soy tu asistente de DNX para ayudarte a ordenar y calcular trabajos fotográficos.",
    "",
    "Contame qué trabajo necesitás cotizar.",
  ].join("\n");
}

export function textAyuda(): string {
  return [
    "Comandos disponibles:",
    "/inicio — presentación",
    "/nueva — nueva cotización",
    "/estado — datos y estado del cálculo",
    "/presupuesto — mínimo y recomendado",
    "/explicacion — por qué salió ese número",
    "/supuestos — supuestos relevantes",
    "/cancelar — cancelar el flujo activo",
    "/privacidad — qué se guarda localmente",
    "",
    "También podés escribirme en lenguaje natural, como siempre.",
  ].join("\n");
}

export function textPrivacidad(): string {
  return [
    "Privacidad (este equipo)",
    "",
    "Guardo localmente, en archivos ignorados por Git:",
    "• conversación activa (para retomar al reiniciar)",
    "• IDs de mensajes ya procesados (evitar duplicados)",
    "• revisiones de presupuesto que marques",
    "",
    "No guardo el token del bot ni tu perfil económico completo.",
    "Los precios solo se muestran a vos en este chat privado.",
  ].join("\n");
}

export function textNuevaConfirm(): string {
  return "Hay una cotización en curso. ¿Querés empezar de cero? Respondé «sí» para confirmar o seguí con los datos actuales.";
}

export function textNuevaStarted(): string {
  return "Listo, arrancamos de cero. Contame qué trabajo necesitás cotizar.";
}

export function textCancelado(): string {
  return "Cancelé el flujo activo. Cuando quieras, pedime una nueva cotización o usá /nueva.";
}

export function textSafeError(): string {
  return "No pude procesar ese mensaje. Probá nuevamente en unos segundos.";
}
