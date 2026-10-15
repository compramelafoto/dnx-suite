/**
 * Por qué una fotografía quedó esperando una decisión humana.
 *
 * El código de motivo solo (`EXIF_INCONSISTENT`) no alcanza para decidir: en
 * la 1ª edición las 43 que esperaban decían "datos de captura inconsistentes"
 * cuando lo que pasaba era lo contrario — el archivo no traía ningún dato de
 * captura. Acá se traduce el motivo a lo que de verdad ocurrió y a qué mirar
 * para resolverlo.
 */

export type MotivoDeEspera = {
  titulo: string;
  quePaso: string;
  comoDecidir: string;
};

export type SenalDeDecision = "ADMITIDA" | "RECHAZADA" | "ESPERA" | "FUERA_DE_JUEGO";

export function porQueEspera(input: {
  codigos: string[];
  razonDeCaptura: string | null;
  horaDeCaptura?: string | null;
}): MotivoDeEspera {
  const codigos = new Set(input.codigos);

  if (codigos.has("DUPLICATE_REVIEW")) {
    return {
      titulo: "Puede estar duplicada",
      quePaso:
        "Otra entrega tiene un archivo idéntico o casi idéntico. Puede ser la misma persona que la mandó dos veces o dos personas con la misma foto.",
      comoDecidir:
        "Compará las dos fotos y las dos entregas. Si es la misma obra repetida, dejá una sola.",
    };
  }

  if (codigos.has("ACCREDITATION_MISSING") || codigos.has("ACCREDITATION_EXCEPTION")) {
    return {
      titulo: "No figura acreditada",
      quePaso:
        "La persona no quedó registrada en la acreditación del día, o se le aplicó una excepción.",
      comoDecidir:
        "Fijate en la lista de acreditación y en lo que hayan informado ese día. Si estuvo, admitila.",
    };
  }

  if (codigos.has("EXIF_INCONSISTENT")) {
    if (input.razonDeCaptura === "EXIF_CAPTURE_DATE_ABSENT") {
      return {
        titulo: "Llegó sin fecha de captura",
        quePaso:
          "El archivo no trae metadatos de captura. Es lo que pasa al exportar desde un programa de edición sin incluirlos, al editar la foto en el celular o al pasarla por mensajería. No indica por sí solo que la foto esté mal.",
        comoDecidir:
          "Mirá la fotografía y la hora en que entró. Si la escena responde a la consigna y la carga fue dentro del horario, admitila.",
      };
    }
    const hora = input.horaDeCaptura ? ` La cámara marcó ${input.horaDeCaptura}.` : "";
    return {
      titulo: "La cámara marca una hora fuera del horario de la maratón",
      quePaso: `La fecha de captura del archivo cae afuera de la ventana.${hora} Lo más común es el reloj de la cámara mal puesto o en otra zona horaria.`,
      comoDecidir:
        "Compará con las otras fotos de la misma persona: si todas están corridas lo mismo, es el reloj y no la foto.",
    };
  }

  if (codigos.has("ADMIN_EXCEPTION")) {
    return {
      titulo: "Tiene una excepción de la organización",
      quePaso: "Alguien de la organización habilitó esta entrega por fuera de la regla general.",
      comoDecidir: "Confirmá que la excepción corresponde y dejala admitida.",
    };
  }

  const codigo = input.codigos[0];
  return {
    titulo: "Espera una decisión de la organización",
    quePaso: codigo
      ? `El control automático la marcó con el motivo ${codigo} y no la resuelve solo.`
      : "El control automático la dejó esperando sin registrar un motivo.",
    comoDecidir: "Mirá la fotografía y la información técnica de la fila antes de decidir.",
  };
}

export function senalDeDecision(status: string): SenalDeDecision {
  if (status === "ADMITTED" || status === "FROZEN_FOR_JURY" || status === "ELIGIBLE") {
    return "ADMITIDA";
  }
  if (status === "REJECTED" || status === "EXCLUDED") return "RECHAZADA";
  if (status === "PENDING_MANUAL_REVIEW") return "ESPERA";
  return "FUERA_DE_JUEGO";
}
