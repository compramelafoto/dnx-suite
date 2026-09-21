/**
 * Los estados de jurado, en palabras que una persona entiende.
 *
 * Reutiliza `StatusTone` y `PresentedStatus` de `public-ux/participant-status`,
 * que ya existían para el participante. El criterio de aquel archivo —"nunca
 * exponer enums crudos ni jerga de almacenamiento"— es el mismo de acá.
 *
 * Única fuente: ninguna pantalla imprime un enum. Si falta un texto, se agrega
 * acá, no en la pantalla.
 */
import type { PresentedStatus, StatusTone } from "../../public-ux/participant-status";

export type { PresentedStatus, StatusTone };

const DESCONOCIDO: PresentedStatus = {
  label: "Sin definir",
  description: "No pudimos interpretar este dato. Avisá a soporte si lo seguís viendo.",
  tone: "neutral",
  nextAction: null,
};

function buscar(tabla: Record<string, PresentedStatus>, valor: string): PresentedStatus {
  return tabla[valor] ?? DESCONOCIDO;
}

const CUENTA: Record<string, PresentedStatus> = {
  INVITED: {
    label: "Invitado",
    description: "Recibió la invitación y todavía no entró.",
    tone: "warning",
    nextAction: "Reenviar la invitación",
  },
  PENDING_REGISTRATION: {
    label: "Falta que se registre",
    description: "Abrió la invitación pero no terminó de crear su cuenta.",
    tone: "warning",
    nextAction: "Reenviar la invitación",
  },
  ACTIVE: {
    label: "Activo",
    description: "Puede entrar y trabajar en sus concursos.",
    tone: "success",
    nextAction: null,
  },
  SUSPENDED: {
    label: "Suspendido",
    description: "No puede entrar hasta que se lo reactive.",
    tone: "danger",
    nextAction: "Reactivar la cuenta",
  },
  DISABLED: {
    label: "Dado de baja",
    description: "La cuenta quedó cerrada.",
    tone: "neutral",
    nextAction: null,
  },
};

const INVITACION: Record<string, PresentedStatus> = {
  DRAFT: {
    label: "Sin enviar",
    description: "La invitación está preparada pero todavía no salió.",
    tone: "neutral",
    nextAction: "Enviarla",
  },
  SENT: {
    label: "Enviada",
    description: "Le llegó el correo y esperamos que la abra.",
    tone: "primary",
    nextAction: null,
  },
  OPENED: {
    label: "Abierta",
    description: "Abrió el enlace y todavía no la completó.",
    tone: "primary",
    nextAction: null,
  },
  ACCEPTED: {
    label: "Aceptada",
    description: "Creó su cuenta y ya puede evaluar.",
    tone: "success",
    nextAction: null,
  },
  REJECTED: {
    label: "Rechazada",
    description: "Dijo que no participa.",
    tone: "danger",
    nextAction: null,
  },
  EXPIRED: {
    label: "Vencida",
    description: "Pasó el plazo del enlace y ya no sirve.",
    tone: "warning",
    nextAction: "Generar un enlace nuevo",
  },
  REVOKED: {
    label: "Anulada",
    description: "Se dio de baja antes de que la usaran.",
    tone: "neutral",
    nextAction: null,
  },
};

const ASIGNACION: Record<string, PresentedStatus> = {
  ASSIGNED: {
    label: "Asignado",
    description: "Le tocó esta categoría y todavía no le avisamos.",
    tone: "neutral",
    nextAction: "Avisarle",
  },
  INVITATION_SENT: {
    label: "Invitación enviada",
    description: "Le avisamos y esperamos que confirme.",
    tone: "primary",
    nextAction: null,
  },
  ACCEPTED: {
    label: "Confirmado",
    description: "Aceptó evaluar esta categoría.",
    tone: "success",
    nextAction: null,
  },
  REJECTED: {
    label: "No aceptó",
    description: "Dijo que no puede evaluar esta categoría.",
    tone: "danger",
    nextAction: "Buscar un reemplazo",
  },
  IN_PROGRESS: {
    label: "Evaluando",
    description: "Ya empezó a puntuar las obras.",
    tone: "primary",
    nextAction: null,
  },
  COMPLETED: {
    label: "Terminó de evaluar",
    description: "Cerró su evaluación de esta categoría.",
    tone: "success",
    nextAction: null,
  },
  EXTENDED: {
    label: "Con prórroga",
    description: "Se le dio más tiempo para terminar.",
    tone: "warning",
    nextAction: null,
  },
  REPLACED_BY_BACKUP: {
    label: "Reemplazado por el suplente",
    description: "Otra persona quedó a cargo de esta categoría.",
    tone: "neutral",
    nextAction: null,
  },
};

const PROPUESTA: Record<string, PresentedStatus> = {
  PENDING: {
    label: "Esperando respuesta",
    description: "Le propusimos el concurso y todavía no contestó.",
    tone: "primary",
    nextAction: null,
  },
  ACCEPTED: {
    label: "Aceptada",
    description: "Aceptó la propuesta.",
    tone: "success",
    nextAction: null,
  },
  REJECTED: {
    label: "Rechazada",
    description: "No aceptó la propuesta.",
    tone: "danger",
    nextAction: null,
  },
  CANCELLED: {
    label: "Cancelada",
    description: "La dimos de baja antes de que contestara.",
    tone: "neutral",
    nextAction: null,
  },
  EXPIRED: {
    label: "Vencida",
    description: "Pasó el plazo sin respuesta.",
    tone: "warning",
    nextAction: "Volver a proponer",
  },
  ARCHIVED: {
    label: "Archivada",
    description: "Se guardó como antecedente.",
    tone: "neutral",
    nextAction: null,
  },
};

const MEMBRESIA: Record<string, PresentedStatus> = {
  ACTIVE: {
    label: "En la organización",
    description: "Forma parte del plantel de jurados.",
    tone: "success",
    nextAction: null,
  },
  INVITED: {
    label: "Invitado",
    description: "Lo invitamos a sumarse y todavía no entró.",
    tone: "warning",
    nextAction: null,
  },
  DISABLED: {
    label: "Fuera de la organización",
    description: "Ya no forma parte del plantel.",
    tone: "neutral",
    nextAction: null,
  },
};

const TIPO: Record<string, PresentedStatus> = {
  PRIMARY: {
    label: "Titular",
    description: "Es quien evalúa esta categoría.",
    tone: "neutral",
    nextAction: null,
  },
  BACKUP: {
    label: "Suplente",
    description: "Evalúa sólo si el titular no puede.",
    tone: "neutral",
    nextAction: null,
  },
};

const REVISION: Record<string, PresentedStatus> = {
  PENDING: {
    label: "En revisión",
    description: "Todavía no miramos la ficha. Hasta entonces no se publica.",
    tone: "primary",
    nextAction: "Revisarla",
  },
  APPROVED: {
    label: "Aprobado",
    description: "La ficha está publicada y aparece en el directorio.",
    tone: "success",
    nextAction: null,
  },
  REJECTED: {
    label: "Rechazado",
    description: "La ficha no quedó aprobada. Puede corregirla y volver a pedirlo.",
    tone: "danger",
    nextAction: null,
  },
};

const METODO: Record<string, PresentedStatus> = {
  SCORE_1_5: {
    label: "Puntaje del 1 al 5",
    description: "Cada obra recibe una nota entre 1 y 5.",
    tone: "neutral",
    nextAction: null,
  },
  SCORE_1_10: {
    label: "Puntaje del 1 al 10",
    description: "Cada obra recibe una nota entre 1 y 10.",
    tone: "neutral",
    nextAction: null,
  },
  SCORE_0_100: {
    label: "Puntaje del 0 al 100",
    description: "Cada obra recibe una nota entre 0 y 100.",
    tone: "neutral",
    nextAction: null,
  },
  YES_NO: {
    label: "Pasa o no pasa",
    description: "De cada obra sólo se decide si sigue adelante.",
    tone: "neutral",
    nextAction: null,
  },
  FAVORITES_SELECTION: {
    label: "Elegir favoritas",
    description: "Se marcan las obras preferidas, sin ponerles nota.",
    tone: "neutral",
    nextAction: null,
  },
  SELECTION_WITH_QUOTA: {
    label: "Elegir con cupo",
    description: "Se eligen las obras preferidas, hasta una cantidad fijada.",
    tone: "neutral",
    nextAction: null,
  },
  CRITERIA_BASED: {
    label: "Por criterios",
    description: "Cada obra se puntúa criterio por criterio, según la rúbrica.",
    tone: "neutral",
    nextAction: null,
  },
};

export function presentJudgeMethodType(v: string): PresentedStatus {
  return buscar(METODO, v);
}

export function presentJudgeAccountStatus(v: string): PresentedStatus {
  return buscar(CUENTA, v);
}
export function presentJudgeInvitationStatus(v: string): PresentedStatus {
  return buscar(INVITACION, v);
}
export function presentJudgeAssignmentStatus(v: string): PresentedStatus {
  return buscar(ASIGNACION, v);
}
export function presentJudgeDirectoryInviteStatus(v: string): PresentedStatus {
  return buscar(PROPUESTA, v);
}
export function presentJudgeMembershipStatus(v: string): PresentedStatus {
  return buscar(MEMBRESIA, v);
}
export function presentJudgeAssignmentType(v: string): PresentedStatus {
  return buscar(TIPO, v);
}
export function presentJudgeReviewStatus(v: string): PresentedStatus {
  return buscar(REVISION, v);
}
