/** Canales por los que sale un mensaje. */
export const CANALES = ["EMAIL", "WHATSAPP"] as const;
export type Canal = (typeof CANALES)[number];

/** Tipo de ficha de una plantilla. GENERAL sirve en cualquier ficha y sólo usa variables comunes. */
export const TIPOS_PLANTILLA = ["GENERAL", "CLIENTE", "SOCIO", "CONSULTA"] as const;
export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number];

/** Estado de un mensaje en el registro (`FotofficeMessage.status`). */
export const ESTADOS_MENSAJE = ["SENT", "FAILED", "OPENED_WHATSAPP"] as const;
export type EstadoMensaje = (typeof ESTADOS_MENSAJE)[number];

/** Claves de las plantillas automáticas (`FotofficeMessageTemplate.systemKey`). */
export const CLAVES_AUTOMATICO = ["CONSULTA_AUTORESPUESTA"] as const;
export type ClaveAutomatico = (typeof CLAVES_AUTOMATICO)[number];

export const ETIQUETA_CANAL: Record<Canal, string> = { EMAIL: "Correo", WHATSAPP: "WhatsApp" };
export const ETIQUETA_TIPO_PLANTILLA: Record<TipoPlantilla, string> = {
  GENERAL: "General",
  CLIENTE: "Cliente",
  SOCIO: "Socio",
  CONSULTA: "Consulta",
};
export const ETIQUETA_ESTADO_MENSAJE: Record<EstadoMensaje, string> = {
  SENT: "Enviado",
  FAILED: "Falló",
  OPENED_WHATSAPP: "Abierto en WhatsApp",
};

export const MIN_NOMBRE_PLANTILLA = 1;
export const MAX_NOMBRE_PLANTILLA = 80;
export const MAX_ASUNTO = 200;
export const MAX_CUERPO: Record<Canal, number> = { EMAIL: 10_000, WHATSAPP: 4_000 };
/** Plantillas activas (no archivadas) por canal y organización. */
export const MAX_PLANTILLAS_ACTIVAS_POR_CANAL = 100;
/** Correos por día (de Buenos Aires) y organización, contando los automáticos. */
export const TOPE_CORREOS_DIA = 200;

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

/** Clave de la variable de firma. */
export const CLAVE_FIRMA = "firma";
/**
 * Lo que deja `completar` donde iba `[firma]`. Lo reemplaza el render (HTML o texto) sin escaparlo.
 * Usa un carácter de uso privado (U+E000) que `completar` borra de todo lo demás, así nadie lo falsifica.
 */
export const CARACTER_MARCADOR = "";
export const MARCADOR_FIRMA = `${CARACTER_MARCADOR}firma${CARACTER_MARCADOR}`;
