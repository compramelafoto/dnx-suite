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
};

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
