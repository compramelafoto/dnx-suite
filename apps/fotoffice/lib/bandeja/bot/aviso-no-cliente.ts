import { escaparHtml } from "@/lib/presupuesto-automatico/resumen";

/**
 * PURO. El aviso por Telegram al dueño cuando escribe alguien que no es cliente (publicidad,
 * proveedores, spam): quién, por qué el bot lo descartó y el mensaje, recortado.
 */

export type NoCliente = {
  nombre: string | null;
  waId: string;
  motivo: string;
  texto: string;
  /** Sólo en Instagram: ahí `waId` es el IGSID, que no es un teléfono y no se muestra. */
  canal?: "INSTAGRAM";
  usuarioInstagram?: string | null;
};

const MAX_TEXTO = 800;

export function textoAvisoNoCliente(p: NoCliente): string {
  const texto = p.texto.length > MAX_TEXTO ? `${p.texto.slice(0, MAX_TEXTO)}…` : p.texto;
  const instagram = p.canal === "INSTAGRAM";
  const contacto = instagram ? (p.usuarioInstagram ? `Instagram @${escaparHtml(p.usuarioInstagram)}` : "Instagram") : `+${escaparHtml(p.waId)}`;
  const quien = p.nombre ? `${escaparHtml(p.nombre)} (${contacto})` : contacto;
  return [
    `📣 <b>Mensaje que no es de un cliente</b> en el ${instagram ? "Instagram" : "WhatsApp"} del estudio`,
    `De: ${quien}`,
    `Motivo: ${escaparHtml(p.motivo)}`,
    "",
    escaparHtml(texto),
    "",
    "Le contestamos que se lo pasamos al encargado. El chat quedó en la Bandeja para una persona.",
  ].join("\n");
}
