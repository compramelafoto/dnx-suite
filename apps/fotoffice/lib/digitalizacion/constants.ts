/** Las constantes del módulo de digitalización de VHS y DVD (spec 2026-10-20, parte 1). */

export const DIGITALIZACION_MODULE_KEY = "digitalizacion";

/** Cada cuánto `MediaRecorder` entrega un pedacito. */
export const SEGUNDOS_POR_PARTE = 10;
/** Tamaño de cada pedacito de un VOB. */
export const BYTES_PEDACITO_DVD = 16 * 1024 * 1024;
/** Ninguna parte puede pesar más (10 s a 6 Mbps son ~7,5 MB). */
export const MAX_BYTES_PARTE = 64 * 1024 * 1024;
/** Cintas LP/EP: hasta 8 h; tope de seguridad 8 h 30 min. */
export const TOPE_SEGUNDOS = 8 * 3600 + 30 * 60;
export const SEGUNDOS_LATIDO = 30;
export const SEGUNDOS_SIN_LATIDO = 180;
export const MINUTOS_SIN_SENAL_POR_DEFECTO = 5;
export const MINUTOS_SIN_SENAL_MIN = 1;
export const MINUTOS_SIN_SENAL_MAX = 30;

export const CALIDADES = { ALTA: 6_000_000, MEDIA: 4_000_000, BAJA: 2_500_000 } as const;
export type Calidad = keyof typeof CALIDADES;
export const BITS_AUDIO = 128_000;

export const TIPOS_GRABACION = ["VHS", "DVD"] as const;
export type TipoGrabacion = (typeof TIPOS_GRABACION)[number];

export const MOTIVOS_FIN_DE_LA_ESTACION = ["MANUAL", "SIN_SENAL", "TOPE", "DVD_COMPLETO"] as const;
export type MotivoFin = (typeof MOTIVOS_FIN_DE_LA_ESTACION)[number] | "TERMINADA_CON_LO_GRABADO";
