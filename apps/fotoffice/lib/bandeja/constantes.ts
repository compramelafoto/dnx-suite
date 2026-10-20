/**
 * Vocabulario de la Bandeja de WhatsApp. En la base son texto (el esquema lo comparten cinco
 * aplicaciones); acá se los tipa como uniones. Módulo PURO.
 */

export const BANDEJA_MODULE_KEY = "whatsapp-inbox";

export const ESTADOS_CHAT = ["BOT", "HUMANO", "RESUELTO"] as const;
export type EstadoDelChat = (typeof ESTADOS_CHAT)[number];

export const MODOS_CONEXION = ["SIMULADO", "REAL"] as const;
export type ModoConexion = (typeof MODOS_CONEXION)[number];

export const DIRECCIONES = ["ENTRANTE", "SALIENTE", "SISTEMA"] as const;
export type Direccion = (typeof DIRECCIONES)[number];

export const AUTORES = ["CLIENTE", "BOT", "USUARIO", "CELULAR", "SISTEMA"] as const;
export type Autor = (typeof AUTORES)[number];

export const TIPOS_MENSAJE = ["TEXTO", "IMAGEN", "AUDIO", "DOCUMENTO", "VIDEO", "UBICACION", "PLANTILLA", "OTRO"] as const;
export type TipoMensaje = (typeof TIPOS_MENSAJE)[number];

export const ESTADOS_ENVIO = ["RECIBIDO", "SIMULADO", "PENDIENTE", "ENVIADO", "ENTREGADO", "LEIDO", "FALLO"] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

/** Largo máximo del texto de un mensaje de WhatsApp. */
export const TEXTO_MAXIMO = 4096;

/** Horas de pausa del bot por omisión (coincide con el default de la columna). */
export const PAUSA_BOT_HORAS_POR_DEFECTO = 4;
