/** Motivos por los que un diploma no se puede emitir. Se muestran en el panel. */
export type DiplomaErrorCode =
  | "DIPLOMA_TEMPLATE_MISSING"
  | "DIPLOMA_TEMPLATE_INVALID"
  | "DIPLOMA_TEMPLATE_UNAVAILABLE"
  | "DIPLOMA_NOT_ACCREDITED"
  | "DIPLOMA_PHOTO_REQUIRED"
  | "DIPLOMA_PHOTO_UNREADABLE"
  | "DIPLOMA_REGISTRATION_NOT_FOUND"
  | "DIPLOMA_FORBIDDEN"
  | "DIPLOMA_ISSUE_FAILED";

export const DIPLOMA_ERROR_MESSAGES: Record<DiplomaErrorCode, string> = {
  DIPLOMA_TEMPLATE_MISSING:
    "Esta edición todavía no tiene plantilla de diploma. Asignala en Placas.",
  DIPLOMA_TEMPLATE_INVALID:
    "La plantilla del diploma tiene bloques o datos que el motor no sabe dibujar.",
  DIPLOMA_TEMPLATE_UNAVAILABLE:
    "La plantilla del diploma dejó de estar disponible durante la generación.",
  DIPLOMA_NOT_ACCREDITED:
    "Este participante no tiene acreditación vigente en la edición.",
  DIPLOMA_PHOTO_REQUIRED:
    "La plantilla usa la foto del participante y esta inscripción no tiene foto.",
  DIPLOMA_PHOTO_UNREADABLE:
    "No pudimos leer la foto del participante. Probá de nuevo en un rato.",
  DIPLOMA_REGISTRATION_NOT_FOUND:
    "No encontramos esa inscripción. Revisá el enlace o volvé a intentar desde el panel.",
  DIPLOMA_FORBIDDEN: "No tenés permiso para emitir este diploma.",
  DIPLOMA_ISSUE_FAILED:
    "Algo falló al generar el diploma. Probá de nuevo; si sigue pasando, avisá al equipo técnico.",
};

export type DiplomaCandidate = {
  registrationId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  visibleCode: string | null;
  email: string;
  accreditedAt: Date;
};
