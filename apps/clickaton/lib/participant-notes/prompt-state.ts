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

/**
 * El estado que vale para el contador y el resumen de "Terminar".
 *
 * La pantalla se arma con la foto que trajo el servidor al abrirla. Quien sube
 * sus consignas de corrido entrega muchas fotos sin recargar nunca, y esas
 * entregas no están en esa foto: si no se las tiene en cuenta, el resumen del
 * último paso muestra "Sin entregar" lo que la persona acaba de entregar.
 *
 * Lo recién entregado manda, hasta que el servidor conteste con datos nuevos.
 */
export function estadoVigenteDeConsigna(input: {
  promptId: string | null;
  estadoDelServidor?: string | null;
  entregadasAhora: Record<string, string>;
}): string | null | undefined {
  const reciente = input.promptId ? input.entregadasAhora[input.promptId] : undefined;
  return reciente ?? input.estadoDelServidor;
}
