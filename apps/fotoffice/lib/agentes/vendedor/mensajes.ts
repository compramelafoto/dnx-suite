import { escaparHtml } from "../periodista/mensaje";

/**
 * Mensajes del Vendedor a Daniel por Telegram (HTML de Telegram). Módulo puro.
 */

/** Aviso de que el Vendedor se pausó solo: por la salud de la dirección o por el tope de Claude. */
export function mensajePausa(motivo: "SALUD" | "TOPE", detalle: string): string {
  const d = escaparHtml(detalle);
  if (motivo === "SALUD") {
    return [
      "⏸️ Pausé el Vendedor: la dirección de envío está en riesgo.",
      d,
      "Revisá los rebotes y las quejas antes de reanudarlo desde el panel.",
    ].join("\n\n");
  }
  return [
    "⏸️ Pausé el Vendedor: llegó al tope de gasto de Claude del mes.",
    d,
    "Vuelve a andar el mes que viene, o antes si subís el tope desde el panel.",
  ].join("\n\n");
}

/** Telegram corta en 4096 caracteres: cada texto largo del mensaje se acota antes de escaparlo. */
const MAX_TEXTO_TELEGRAM = 1200;

function acotar(texto: string, max = MAX_TEXTO_TELEGRAM): string {
  const t = texto.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Aviso del primer «interesado» o «capacitación» de un hilo. */
export function mensajeInteresado(d: {
  nombre: string;
  grupo: string;
  ciudad: string | null;
  resumen: string;
  registrado: boolean;
  capacitacion: boolean;
}): string {
  const quien = d.ciudad ? `${d.nombre} (${d.ciudad})` : d.nombre;
  return [
    `🙋 Interesado: <b>${escaparHtml(quien)}</b>`,
    `Grupo: ${escaparHtml(d.grupo)}`,
    `Qué preguntó: ${escaparHtml(acotar(d.resumen))}`,
    d.registrado ? "✅ Ya se registró en CompraMeLaFoto." : "Todavía no se registró en CompraMeLaFoto.",
    d.capacitacion ? "🎓 Quiere capacitarse." : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/** Una respuesta que espera a Daniel: lo que escribió el contacto y, si hay, la propuesta. */
export function mensajeEsperaDaniel(d: { nombre: string; grupo: string; entrante: string; propuesta: string | null; motivo: string }): string {
  return [
    `✋ Te toca a vos: <b>${escaparHtml(d.nombre)}</b> (${escaparHtml(d.grupo)})`,
    `Por qué: ${escaparHtml(d.motivo)}`,
    `Escribió:\n<blockquote>${escaparHtml(acotar(d.entrante))}</blockquote>`,
    d.propuesta === null
      ? "No tengo una respuesta propuesta."
      : `Te propongo contestar:\n<blockquote>${escaparHtml(acotar(d.propuesta))}</blockquote>`,
  ].join("\n\n");
}

/** Un correo que no empareja con ningún hilo. */
export function mensajeSinEmparejar(d: { de: string; asunto: string; reenviado: boolean; motivo?: string }): string {
  return [
    "📬 Llegó un correo que no es respuesta a ningún hilo del Vendedor.",
    `De: ${escaparHtml(d.de)}\nAsunto: ${escaparHtml(acotar(d.asunto, 300))}`,
    d.reenviado
      ? "Te lo reenvié a dnxfotografia@gmail.com."
      : `No lo reenvié a Gmail: ${escaparHtml(d.motivo ?? "viene de tu propia casilla o de @compramelafoto.com")}.`,
  ].join("\n\n");
}
