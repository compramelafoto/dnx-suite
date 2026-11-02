/** La marca de las plantillas de diploma (`TemplateV2Version.metaJson.templateKey`). */
export const DIPLOMA_TEMPLATE_KEY = "evento-diploma";

/** Dónde se abre el diseñador de diplomas (`/eventos/diplomas/<plantilla>/<versión>`). */
export const DIPLOMAS_EDITOR_BASE_PATH = "/eventos/diplomas";

/** La marca de las plantillas de la placa de bienvenida de un evento (cuadrada, con la foto). */
export const PLACA_EVENTO_TEMPLATE_KEY = "evento-bienvenida";

/** Las plantillas que abre el diseñador de Eventos: diplomas y placas de bienvenida. */
export function esPlantillaDeEvento(key: string | null | undefined): boolean {
  return key === DIPLOMA_TEMPLATE_KEY || key === PLACA_EVENTO_TEMPLATE_KEY;
}
