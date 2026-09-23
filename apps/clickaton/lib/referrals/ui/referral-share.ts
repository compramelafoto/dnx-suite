/**
 * El mensaje que se comparte habla del descuento del INVITADO, no del premio
 * de quien invita. Compartir el link tiene que sonar a regalo y no a pedido de
 * favor: es lo que hace que efectivamente se comparta.
 */

export function buildReferralShareMessage(input: { link: string }): string {
  return [
    "Te invito a la Clickatón: una maratón fotográfica de un día, con consignas, jurado y premios.",
    "Con este link entrás con 10% de descuento en tu inscripción.",
    "",
    // El enlace va último a propósito: WhatsApp previsualiza el último que encuentra.
    input.link,
  ].join("\n");
}

export function buildReferralWhatsappUrl(input: { link: string }): string {
  return `https://wa.me/?text=${encodeURIComponent(buildReferralShareMessage(input))}`;
}
