/**
 * Etiquetas y tipos de los firmantes de la ficha del contrato. Módulo PURO (sin base): lo usan la lectura
 * del servidor y los componentes del navegador.
 */

export type EstadoFirmante = "PENDIENTE" | "VISTO" | "VERIFICADO" | "FIRMADO" | "RECHAZADO";

export const ETIQUETA_ESTADO_FIRMANTE: Record<EstadoFirmante, string> = {
  PENDIENTE: "Pendiente",
  VISTO: "Lo abrió",
  VERIFICADO: "Verificó su identidad",
  FIRMADO: "Firmó",
  RECHAZADO: "Rechazó",
};

/** Puro: en qué paso de la firma está un firmante. */
export function estadoDeFirmante(f: { viewedAt: Date | null; verifiedAt: Date | null; signedAt: Date | null; rejectedAt: Date | null }): EstadoFirmante {
  if (f.signedAt) return "FIRMADO";
  if (f.rejectedAt) return "RECHAZADO";
  if (f.verifiedAt) return "VERIFICADO";
  if (f.viewedAt) return "VISTO";
  return "PENDIENTE";
}

export type FirmanteFicha = {
  id: string;
  orden: number;
  nombre: string;
  email: string;
  documento: string | null;
  estado: EstadoFirmante;
  motivoRechazo: string | null;
  firmadoEn: string | null;
  rechazadoEn: string | null;
  vistoEn: string | null;
  /** El enlace venció y todavía no firmó ni rechazó. */
  vencido: boolean;
  /** Se le puede copiar o reenviar el enlace. */
  puedeEnlace: boolean;
};
