export const CLASES = ["VENTA", "TRABAJO"] as const;
export type Clase = (typeof CLASES)[number];
export const SALIDAS: Record<Clase, { exito: string; fracaso: string }> = {
  VENTA: { exito: "GANADA", fracaso: "PERDIDA" },
  TRABAJO: { exito: "TERMINADO", fracaso: "CANCELADO" },
};
export const ETIQUETA_SALIDA: Record<string, string> = { GANADA: "Ganada", PERDIDA: "Perdida", TERMINADO: "Terminado", CANCELADO: "Cancelado" };
export const TIPOS_SUJETO = ["CAPTACION", "CONSULTA", "PROYECTO", "COBERTURA"] as const;
export type TipoSujeto = (typeof TIPOS_SUJETO)[number];
export const EVENTOS = ["CONSULTA_RECIBIDA", "PRESUPUESTO_ACEPTADO", "CONTRATO_FIRMADO", "SENA_COBRADA", "BACKUP_TERMINADO", "GALERIA_PUBLICADA"] as const;
export type Evento = (typeof EVENTOS)[number];
export const ETIQUETA_EVENTO: Record<Evento, string> = {
  CONSULTA_RECIBIDA: "Llegó una consulta nueva",
  PRESUPUESTO_ACEPTADO: "El cliente aceptó el presupuesto",
  CONTRATO_FIRMADO: "Se firmó el contrato",
  SENA_COBRADA: "Se cobró la seña",
  BACKUP_TERMINADO: "DNX FLUX terminó el backup",
  GALERIA_PUBLICADA: "Se publicó la galería",
};
export const EVENTOS_CONECTADOS: readonly Evento[] = ["CONSULTA_RECIBIDA"];
export const ESTADOS_CAPTACION = ["NEW", "CONTACTED", "QUOTED", "INTERESTED"] as const;
