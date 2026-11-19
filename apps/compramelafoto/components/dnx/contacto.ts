/**
 * El WhatsApp de DNX Estudio para las landings de XV y Bodas.
 *
 * Todas las consultas tienen que entrar por el número del estudio (341 341-9869): ahí contesta el
 * bot y ahí las ve el equipo en la Bandeja de FOTOFFICE. Antes los botones iban al celular personal
 * de Daniel y las entrevistas a Google Calendar, y esas consultas quedaban fuera del circuito.
 *
 * `wa.me` abre la app en el celular y WhatsApp Web en la computadora (`web.whatsapp.com` obligaba a
 * la versión web también en el celular).
 */
export const DNX_WHATSAPP_NUMERO = "5493413419869";

export function whatsappDnx(texto: string): string {
  return `https://wa.me/${DNX_WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
}
