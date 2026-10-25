/**
 * Contratos (etapa 5). Módulo PURO: valores guardados, etiquetas y límites.
 *
 * Los valores van en mayúsculas, como en los CHECK del SQL
 * (`20261027120000_fotoffice_etapa_5_contratos`).
 */

// --- Estados del contrato ---------------------------------------------------------------------

export const ESTADOS_CONTRATO = ["BORRADOR", "ENVIADO", "FIRMADO_PARCIAL", "FIRMADO", "RECHAZADO", "ANULADO"] as const;
export type EstadoContrato = (typeof ESTADOS_CONTRATO)[number];

export const ETIQUETA_ESTADO_CONTRATO: Record<EstadoContrato, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  FIRMADO_PARCIAL: "Firmado por una parte",
  FIRMADO: "Firmado",
  RECHAZADO: "Rechazado",
  ANULADO: "Anulado",
};

export function esEstadoContrato(v: unknown): v is EstadoContrato {
  return typeof v === "string" && (ESTADOS_CONTRATO as readonly string[]).includes(v);
}

/** Estados en los que el contrato ya no cambia por sí solo. */
export const ESTADOS_FINALES: readonly EstadoContrato[] = ["FIRMADO", "RECHAZADO", "ANULADO"];

// --- Bitácora ---------------------------------------------------------------------------------

export const TIPOS_EVENTO = [
  "CREADO", "EDITADO", "ENVIADO", "REENVIADO", "VISTO", "CODIGO_ENVIADO", "CODIGO_VERIFICADO", "CODIGO_FALLIDO",
  "FIRMADO", "RECHAZADO", "RECORDATORIO", "PDF_GENERADO", "PDF_ENVIADO", "VERSION_REVOCADA", "ANULADO", "FIRMADO_EN_PAPEL",
] as const;
export type TipoEventoContrato = (typeof TIPOS_EVENTO)[number];

export const ETIQUETA_EVENTO: Record<TipoEventoContrato, string> = {
  CREADO: "Contrato creado",
  EDITADO: "Contrato editado",
  ENVIADO: "Enviado a firmar",
  REENVIADO: "Enlace reenviado",
  VISTO: "Abierto por el firmante",
  CODIGO_ENVIADO: "Código de verificación enviado",
  CODIGO_VERIFICADO: "Código verificado",
  CODIGO_FALLIDO: "Código incorrecto",
  FIRMADO: "Firmado",
  RECHAZADO: "Rechazado",
  RECORDATORIO: "Recordatorio enviado",
  PDF_GENERADO: "PDF generado",
  PDF_ENVIADO: "PDF enviado a los firmantes",
  VERSION_REVOCADA: "Versión reemplazada",
  ANULADO: "Contrato anulado",
  FIRMADO_EN_PAPEL: "Marcado como firmado en papel",
};

// --- Plantillas automáticas de correo ---------------------------------------------------------

export const CLAVES_AUTOMATICO_CONTRATO = ["CONTRATO_ENVIO", "CONTRATO_CODIGO", "CONTRATO_RECORDATORIO", "CONTRATO_FIRMADO"] as const;
export type ClaveAutomaticoContrato = (typeof CLAVES_AUTOMATICO_CONTRATO)[number];

// --- Límites ----------------------------------------------------------------------------------

export const MAX_NOMBRE_CONTRATO = 120;
export const MAX_CUERPO_CONTRATO = 100_000;
export const MAX_PLANTILLAS_CONTRATO = 50;
export const MAX_MOTIVO = 500;
export const MAX_FIRMANTES = 2;

/** Firma dibujada: PNG de hasta 200 KB. */
export const FIRMA_MAX_BYTES = 200 * 1024;
/** Días que sirve el enlace de un firmante desde que se envía. */
export const DIAS_VALIDEZ_ENLACE = 30;
/** Recordatorio: días entre 1 y 30 (CHECK del SQL); por omisión 3. */
export const MIN_DIAS_RECORDATORIO = 1;
export const MAX_DIAS_RECORDATORIO = 30;
export const DIAS_RECORDATORIO_INICIAL = 3;

/** Leyenda legal que va junto a cada firma y en el PDF. Nunca se habla de "firma digital" con certificado. */
export const LEYENDA_FIRMA =
  "Firma electrónica conforme a la Ley 25.506. Este documento no tiene firma digital con certificado.";

/** Clave en R2 privado de la firma dibujada de un firmante. */
export function claveFirma(workspaceId: string, contratoId: string, firmanteId: string): string {
  return `contratos/${workspaceId}/${contratoId}/${firmanteId}.png`;
}

/** Orden de los contratantes de un pedido (el 1 es obligatorio, el 2 opcional). */
export const ORDENES_CONTRATANTE = [1, 2] as const;
