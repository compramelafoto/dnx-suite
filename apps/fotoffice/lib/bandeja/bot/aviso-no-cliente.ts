import { escaparHtml } from "@/lib/presupuesto-automatico/resumen";

/**
 * PURO. El aviso por Telegram al dueño cuando escribe alguien que no es cliente (publicidad,
 * proveedores, spam): quién, por qué el bot lo descartó y el mensaje, recortado.
 */

export type NoCliente = { nombre: string | null; waId: string; motivo: string; texto: string };

const MAX_TEXTO = 800;

export function textoAvisoNoCliente(p: NoCliente): string {
  const texto = p.texto.length > MAX_TEXTO ? `${p.texto.slice(0, MAX_TEXTO)}…` : p.texto;
  const quien = p.nombre ? `${escaparHtml(p.nombre)} (+${escaparHtml(p.waId)})` : `+${escaparHtml(p.waId)}`;
  return [
    "📣 <b>Mensaje que no es de un cliente</b> en el WhatsApp del estudio",
    `De: ${quien}`,
    `Motivo: ${escaparHtml(p.motivo)}`,
    "",
    escaparHtml(texto),
    "",
    "Le contestamos que se lo pasamos al encargado. El chat quedó en la Bandeja para una persona.",
  ].join("\n");
}
