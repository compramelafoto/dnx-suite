/** Consultas de organizadores vía WhatsApp (soporte comercial). */
export const ORGANIZER_CONSULT_WHATSAPP_PHONE = "5493413748324";

export const ORGANIZER_CONSULT_WHATSAPP_MESSAGE =
  "Hola soy organizador y necesito informacion para publicar mi evento, convocar fotografos y monetizar las ventas de fotografias";

export const ORGANIZER_CONSULT_WHATSAPP_URL = `https://wa.me/${ORGANIZER_CONSULT_WHATSAPP_PHONE}?text=${encodeURIComponent(
  ORGANIZER_CONSULT_WHATSAPP_MESSAGE
)}`;
