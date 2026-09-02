/**
 * Qué hacer cuando el escaneo salió bien pero no se puede acreditar.
 *
 * El escáner escondía el botón sin decir por qué: el operador veía los datos del
 * participante y quedaba sin saber cuál era el paso siguiente. Esto convierte el
 * motivo técnico en una instrucción concreta.
 */

export type BloqueoAcreditacion = {
  reason: string | null | undefined;
  window?: {
    opensAt?: string | null;
    closesAt?: string | null;
    timezone?: string | null;
    accreditationEnabled?: boolean;
  } | null;
};

function hora(iso: string | null | undefined, timezone: string | null | undefined): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone ?? undefined,
    }).format(fecha);
  } catch {
    return new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    }).format(fecha);
  }
}

export function describirBloqueoDeAcreditacion(input: BloqueoAcreditacion): string {
  const tz = input.window?.timezone ?? null;
  const abre = hora(input.window?.opensAt, tz);
  const cierra = hora(input.window?.closesAt, tz);

  switch (input.reason) {
    case "WINDOW_CLOSED": {
      if (abre && cierra) {
        return `La acreditación está habilitada de ${abre} a ${cierra}. Fuera de ese horario el sistema no permite confirmar. Si necesitás acreditar igual, cambiá el horario en el cronograma de la edición.`;
      }
      if (abre) {
        return `La acreditación abre ${abre}. Hasta entonces no se puede confirmar.`;
      }
      return "La edición no tiene cargado el horario de acreditación en su cronograma, así que el sistema no sabe si puede acreditar. Cargá los eventos de apertura y cierre de acreditación en el cronograma de la edición.";
    }
    case "ACCREDITATION_DISABLED":
      return "El módulo de acreditación está apagado para esta edición. Se activa en la configuración de acreditación de la edición.";
    case "PAYMENT_PENDING":
      return "El pago todavía no figura acreditado. Verificá el cobro antes de dejar entrar, o registrá una excepción si la organización lo autoriza.";
    case "NOT_CONFIRMED":
      return "La inscripción no está confirmada. Revisala en el panel de inscripciones antes de acreditar.";
    case "CREDENTIAL_MISSING":
      return "Esta inscripción no tiene credencial activa. Regenerá el QR desde el panel de inscripciones.";
    case "REGISTRATION_INACTIVE":
      return "La inscripción fue cancelada o reembolsada. No corresponde acreditar.";
    case "DISQUALIFIED":
      return "El participante está descalificado. No corresponde acreditar.";
    default:
      return "No se puede confirmar la acreditación con el estado actual de esta inscripción. Revisala en el panel de inscripciones.";
  }
}
