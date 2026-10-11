/** Textos del historial de la galería (módulo PURO, sirve en pantallas de cliente y de servidor). */
export const ETIQUETA_EVENTO_GALERIA: Record<string, string> = {
  GALERIA_CREADA: "Galería creada",
  GALERIA_EDITADA: "Configuración cambiada",
  PUBLICADA: "Galería publicada",
  ARCHIVADA: "Galería archivada",
  REACTIVADA: "Galería reactivada",
  CLIENTE_AGREGADO: "Cliente agregado",
  ENLACE_REGENERADO: "Enlace nuevo generado (el anterior dejó de servir)",
  ENLACE_ANULADO: "Enlace anulado",
  ENLACE_COPIADO: "Enlace copiado",
  ENLACE_WHATSAPP: "Enlace preparado para WhatsApp",
  CORREO_PEDIDO: "Correo con el enlace pedido",
  CORREO_ENVIADO: "Correo con el enlace enviado",
  CORREO_NO_ENVIADO: "El correo con el enlace no salió",
  FOTO_BORRADA: "Foto borrada",
  PORTADA: "Portada cambiada",
  ORDEN: "Orden de las fotos cambiado",
  ENTRO: "El cliente entró a la galería",
  SELECCION_ENVIADA: "El cliente envió su selección",
  SELECCION_FINALIZADA: "Selección finalizada por el estudio",
  SELECCION_REACTIVADA: "Selección devuelta al cliente para que siga eligiendo",
  CONFIRMACION_ENVIADA: "Correo de confirmación enviado al cliente",
  CONFIRMACION_NO_ENVIADA: "El correo de confirmación al cliente no salió",
  AVISO_ESTUDIO_ENVIADO: "Aviso al estudio enviado",
  AVISO_ESTUDIO_NO_ENVIADO: "El aviso al estudio no salió",
};

/** Eventos que hace el propio cliente desde su enlace (sin usuario del estudio): en el historial el actor es el cliente. */
export const EVENTOS_DEL_CLIENTE: readonly string[] = ["ENTRO", "SELECCION_ENVIADA"];

export function etiquetaDeEvento(tipo: string): string {
  return ETIQUETA_EVENTO_GALERIA[tipo] ?? tipo;
}

/** Cómo explicar por qué no salió un correo (códigos de `enviarCorreoGaleria`). */
export const MOTIVO_CORREO: Record<string, string> = {
  APAGADA: "la plantilla automática está apagada",
  SIN_CORREO: "el cliente no tiene un correo válido",
  PLANTILLA_CON_ERRORES: "la plantilla tiene errores",
  TOPE: "se llegó al tope diario de correos automáticos",
  NO_ENVIADO: "el proveedor de correo lo rechazó",
  ERROR: "hubo un error inesperado",
};
