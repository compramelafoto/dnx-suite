/** Marca de las plantillas de fotolibro. Ver `lib/template-v2/keyed-template.ts`. */
export const FOTOLIBRO_TEMPLATE_KEY = "fotolibro";

/**
 * Dónde viven los fotolibros del estudio: en Ventas, al lado de Impresiones y Costos, porque
 * diseñarlos es trabajo de estudio. El Diseñador de Socios queda para el carnet y las piezas
 * de la institución.
 */
export const FOTOLIBROS_BASE_PATH = "/ventas/fotolibros";

/**
 * Fotolibros en el portal del socio.
 *
 * Módulo con interruptor propio, como ¿Cuánto Cobro?: cada institución decide si se lo ofrece a
 * sus socios. Lo que el socio diseña es suyo: la plantilla queda a su nombre y sin institución,
 * así que ni la comisión ni otro socio la ven.
 */
export const FOTOLIBROS_SOCIO_MODULE_KEY = "fotolibros-socios";

export const RUTA_FOTOLIBROS_SOCIO = "/portal/fotolibros";
