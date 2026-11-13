/** Mensajes al comprador de un carrito de evento, por código. Sin dependencias: lo usan las pruebas. */
export const MENSAJES_GRUPO: Record<string, string> = {
  YA_PAGADO: "Esta compra ya está pagada.",
  ORDEN_EN_CURSO:
    "Esta compra ya tiene un pago en curso. Esperá unos minutos y recargá la página: no pagues de nuevo.",
  PAGADOR_ES_RECEPTOR:
    "El correo de la compra es de alguien que cobra parte de esta venta. Usá otro correo.",
  DEMASIADOS_RECEPTORES:
    "Esta compra tiene demasiados fotógrafos para pagarla junta. Volvé al evento para pagar cada álbum por separado.",
  NO_DISPONIBLE:
    "El pago en un solo paso no está disponible para esta compra. Volvé al evento para pagar cada álbum por separado.",
  CONSENTIMIENTO_NO_ACTIVO:
    "Alguno de los fotógrafos no puede cobrar en un solo pago en este momento. Volvé al evento para pagar cada álbum por separado.",
  ERROR_PREPARACION: "No pudimos procesar el pago. No se te cobró nada; probá de nuevo en unos minutos.",
};

export function mensajeGrupo(codigo: string): string {
  return MENSAJES_GRUPO[codigo] ?? MENSAJES_GRUPO.NO_DISPONIBLE;
}
