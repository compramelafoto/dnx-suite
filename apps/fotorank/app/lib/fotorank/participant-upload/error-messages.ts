import type { EntryErrorCode } from "../entries/errors";

const BY_CODE: Partial<Record<EntryErrorCode | string, string>> = {
  UPLOAD_WINDOW_CLOSED: "La carga todavía no está habilitada.",
  INVALID_FILE: "El archivo no es válido. Revisá formato, peso y dimensiones.",
  FORBIDDEN: "No tenés permiso para cargar en esta participación.",
  UNAUTHENTICATED: "La sesión venció. Volvé a iniciar sesión e intentá de nuevo.",
  REGISTRATION_NOT_CONFIRMED: "Tu inscripción debe estar confirmada para cargar.",
  REPLACE_NOT_ALLOWED: "En este momento no podés reemplazar la fotografía.",
  CONFIRM_BLOCKED: "Todavía no se puede confirmar el envío. Revisá los requisitos técnicos.",
  FROZEN: "La obra está congelada y no admite cambios.",
  DEVICE_NOT_ELIGIBLE: "El dispositivo declarado no es válido para esta categoría.",
  TERRITORY_REQUIRED: "Confirmá el territorio y la localidad de captura.",
  ARGRA_REQUIRED: "Falta la acreditación requerida para esta categoría.",
  INSTAGRAM_REQUIRED: "Indicá tu usuario de Instagram.",
  DECLARATIONS_REQUIRED: "Confirmá las declaraciones obligatorias antes de continuar.",
  PROCESSING_FAILED: "No se pudo procesar el archivo. Probá de nuevo con otro JPEG.",
  NOT_READY: "La fotografía todavía no está lista para confirmar.",
  ENTRY_NOT_FOUND: "No encontramos la obra. Recargá la página e intentá de nuevo.",
};

export function translateUploadError(
  code: string | null | undefined,
  fallbackMessage?: string | null,
): string {
  if (code && BY_CODE[code]) return BY_CODE[code]!;
  const msg = fallbackMessage?.trim();
  if (msg && !/^[A-Z_]+$/.test(msg) && !msg.includes("Error:")) return msg;
  return "No se pudo completar la operación. Revisá los datos e intentá de nuevo.";
}

export function clientValidationMessage(code: string): string {
  switch (code) {
    case "EMPTY":
      return "El archivo está vacío.";
    case "EXTENSION":
      return "Esta categoría admite solamente archivos JPEG.";
    case "MIME":
      return "Esta categoría admite solamente archivos JPEG.";
    case "TOO_LARGE":
      return "El archivo supera el peso permitido.";
    case "TOO_SMALL_DIM":
      return "La imagen no alcanza las dimensiones mínimas.";
    case "TOO_LARGE_DIM":
      return "La imagen supera las dimensiones máximas.";
    case "TOO_FEW_MP":
      return "La imagen no alcanza la resolución mínima (megapíxeles).";
    case "READ_FAILED":
      return "No se pudo leer la imagen. Probá con otro archivo JPEG.";
    default:
      return "El archivo no cumple los requisitos.";
  }
}
