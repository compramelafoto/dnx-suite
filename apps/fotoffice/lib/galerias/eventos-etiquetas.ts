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
  DESCARGA: "El cliente descargó una foto en alta",
  VENTA_CONFIGURADA: "Venta de fotos extra configurada",
  COMPRA_PAGADA: "Compra de fotos extra pagada",
  COMPRA_SIN_CAJA: "Compra pagada sin registrar en Caja",
  COMPRA_CANCELADA: "Compra de fotos extra cancelada",
  COMPRA_CANCELADA_PAGADA: "Una compra cancelada igual se pagó: se acreditó",
  PAGO_DUPLICADO: "Llegó un pago por fotos que ya estaban pagas",
  PAGO_NO_ACREDITADO: "Llegó un pago que no se pudo acreditar",
  DESCARGA_PEDIDA: "Se pidió la descarga completa",
  DESCARGA_LISTA: "La descarga completa quedó lista",
  DESCARGA_ERROR: "No se pudo armar la descarga completa",
  DESCARGA_CORREO_ENVIADO: "Correo de descarga lista enviado",
  DESCARGA_CORREO_NO_ENVIADO: "El correo de descarga lista no salió",
  RONDA_ABIERTA: "Ronda nueva del álbum abierta",
  ALBUM_APROBADO: "El cliente aprobó el álbum",
  ALBUM_CAMBIOS_PEDIDOS: "El cliente pidió cambios en el álbum",
  ALBUM_FINALIZADO: "Prueba de álbum finalizada por el estudio",
  ALBUM_REACTIVADO: "Prueba de álbum devuelta al cliente para que decida de nuevo",
  ARCHIVOS_PEDIDOS_DISPOSITIVO: "DNX FLUX empezó a subir archivos",
};

/** Eventos que hace el propio cliente desde su enlace (sin usuario del estudio): en el historial el actor es el cliente. */
export const EVENTOS_DEL_CLIENTE: readonly string[] = ["ENTRO", "SELECCION_ENVIADA", "DESCARGA", "ALBUM_APROBADO", "ALBUM_CAMBIOS_PEDIDOS"];

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
