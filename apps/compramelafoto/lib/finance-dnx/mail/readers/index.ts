import { readStripe } from "./stripe";
import type { MailInput, ReadResult } from "./types";
import { readAws, readCloudflare, readNeon } from "./vendors-readers";

export type { MailInput, MailKind, ParsedDoc, ReadResult } from "./types";

const CHATGPT_FALLO = /no pudimos procesar|error al procesar el pago|no se pudo realizar el pago|actualiza tu forma de pago|payment failed|update your payment/i;

/** Lee un mail de un proveedor. Un formato que no se reconoce devuelve null: no se inventa nada. */
export function readMail(vendorKey: string, mail: MailInput): ReadResult {
  const from = mail.fromAddress.toLowerCase();
  switch (vendorKey) {
    case "chatgpt":
      // OpenAI no manda recibo mensual: ChatGPT se carga como cobro fijo. Un cobro fallido sí se avisa.
      return {
        ignore: "ChatGPT no manda recibos: se carga como cobro fijo mensual.",
        alert: CHATGPT_FALLO.test(`${mail.subject} ${mail.bodyText}`) ? "ChatGPT no pudo cobrar la suscripción Plus." : undefined,
      };
    case "capcut":
      return { ignore: "Aviso de CapCut sin cobro (códigos, accesos, promociones)." };
    case "aws":
      return readAws(mail);
    case "neon":
      return readNeon(mail);
    case "cloudflare":
      return readCloudflare(mail);
    case "vercel":
      if (from.includes("notifications@vercel.com")) {
        return {
          ignore: "Aviso de Vercel sin importe (el recibo llega aparte a compramelafoto@).",
          alert: /payment failed/i.test(mail.subject) ? "Vercel no pudo cobrar la tarjeta y avisa corte del servicio." : undefined,
        };
      }
      break;
  }
  if (from.includes("invoice+statements")) return readStripe(vendorKey, mail);
  return null;
}
