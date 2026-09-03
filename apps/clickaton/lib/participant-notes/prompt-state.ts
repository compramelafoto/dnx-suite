/**
 * Estado de una consigna para el participante: la mezcla de lo que anotó, lo
 * que marcó y lo que entregó. Puro, para poder probarlo con datos armados.
 */

export type EstadoConsigna =
  | "PENDIENTE"
  | "YA_LA_TENGO"
  | "SIN_CONFIRMAR"
  | "ENVIADA"
  | "RECHAZADA";

export function resolverEstadoConsigna(input: {
  submissionStatus?: string | null;
  solved?: boolean;
}): EstadoConsigna {
  const s = input.submissionStatus;
  if (s === "CONFIRMED") return "ENVIADA";
  if (s === "REJECTED") return "RECHAZADA";
  // Subida pero sin que se guardara la entrega: no compite.
  if (s === "PENDING_CONFIRMATION" || s === "UPLOAD_PENDING" || s === "PROCESSING") {
    return "SIN_CONFIRMAR";
  }
  if (input.solved) return "YA_LA_TENGO";
  return "PENDIENTE";
}

/** Una foto subida cuya entrega no llegó a guardarse: todavía no compite. */
export function estaSinConfirmar(estado: EstadoConsigna): boolean {
  return estado === "SIN_CONFIRMAR";
}

/** Cuenta para el progreso "resueltas": la tiene en cámara o ya la entregó. */
export function estaResuelta(estado: EstadoConsigna): boolean {
  return estado !== "PENDIENTE" && estado !== "RECHAZADA";
}

export function estaEnviada(estado: EstadoConsigna): boolean {
  return estado === "ENVIADA";
}
