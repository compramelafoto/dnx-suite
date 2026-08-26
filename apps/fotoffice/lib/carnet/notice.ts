import type { FulfillmentState } from "./fulfillment";
import { stateLabel } from "./fulfillment";

/**
 * El aviso que recibe el socio cuando su carnet avanza.
 *
 * Función pura: arma el texto, no lo manda. Así se puede probar que cada estado dice algo
 * cierto y accionable, sin tocar el proveedor de correo.
 */

export type CardNotice = { subject: string; html: string; text: string };

export function buildCardNotice(input: {
  firstName: string;
  institutionName: string;
  cardNumber: string;
  state: FulfillmentState;
  note?: string | null;
}): CardNotice | null {
  const cuerpo = mensajePara(input);
  if (!cuerpo) return null;

  const subject = `Tu carnet de socio: ${stateLabel(input.state).toLowerCase()}`;
  const text = `Hola ${input.firstName},\n\n${cuerpo}\n\nCarnet N° ${input.cardNumber}\n${input.institutionName}`;
  const html = `<p>Hola ${escapar(input.firstName)},</p><p>${escapar(cuerpo)}</p><p style="color:#666;font-size:13px">Carnet N° ${escapar(input.cardNumber)}<br>${escapar(input.institutionName)}</p>`;
  return { subject, html, text };
}

function mensajePara(input: {
  institutionName: string;
  state: FulfillmentState;
  note?: string | null;
}): string | null {
  const detalle = input.note?.trim() ? ` ${input.note.trim()}` : "";
  switch (input.state) {
    case "LISTO_PARA_RETIRAR":
      return `Tu carnet de socio ya está impreso y podés pasar a retirarlo por ${input.institutionName}.${detalle}`;
    case "ENVIADO":
      // El detalle acá importa: es el número de seguimiento o quién lo llevó.
      return `Tu carnet de socio salió por correo.${detalle}`;
    case "ENTREGADO":
      return `Registramos la entrega de tu carnet de socio. Si no lo recibiste, avisanos.${detalle}`;
    default:
      // Los pasos internos no se avisan: que entre en la cola de impresión no le cambia nada
      // al socio, y un aviso que no aporta enseña a ignorar los que sí.
      return null;
  }
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
