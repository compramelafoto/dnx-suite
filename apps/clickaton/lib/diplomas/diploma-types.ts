/** Motivos por los que un diploma no se puede emitir. Se muestran en el panel. */
export type DiplomaErrorCode =
  | "DIPLOMA_TEMPLATE_MISSING"
  | "DIPLOMA_TEMPLATE_INVALID"
  | "DIPLOMA_TEMPLATE_UNAVAILABLE"
  | "DIPLOMA_NOT_ACCREDITED"
  | "DIPLOMA_PHOTO_REQUIRED";

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
