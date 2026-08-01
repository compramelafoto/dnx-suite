/**
 * Presentación de jurado, evaluación y resultados (Etapa 02 Imp. 06).
 *
 * Clickatón no hospeda el panel de evaluación: eso vive en FotoRank.
 * Esta capa traduce estados reales (públicos CK + enums FR conocidos) para
 * hand-off admin, resultados públicos y documentación. No altera lógica.
 */
import type { PublicStatusTone } from "@/lib/public-ux/status-presentation";
import type { ResultsStatus, GalleryStatus } from "@/types/marathon";

export type JuryAttention = "ok" | "watch" | "action" | "blocked";

export type JuryStatusPresentation = {
  key: string;
  label: string;
  description: string;
  tone: PublicStatusTone;
  attention: JuryAttention;
  nextAction?: string;
  editable: boolean;
  complete: boolean;
  publiclyVisible: boolean;
  needsAttention: boolean;
};

export function juryToneToBadgeVariant(
  tone: PublicStatusTone,
): "success" | "warning" | "danger" | "neutral" | "brand" | "accent" {
  if (tone === "info") return "accent";
  return tone;
}

/** Separación validación técnica vs evaluación artística. */
export const TECHNICAL_VS_JURY_ADMIN =
  "La admisión técnica verifica requisitos de archivo y participación. El jurado evalúa la obra según los criterios definidos para el concurso.";

export const TECHNICAL_VS_JURY_JUROR =
  "Las fotografías que aparecen en la evaluación ya pasaron la validación técnica. La tarea del jurado es evaluarlas según los criterios artísticos y conceptuales de la categoría.";

export const JURY_ANONYMITY_NOTICE =
  "Durante la evaluación, no mostramos la identidad del fotógrafo para mantener una revisión imparcial.";

export const JURY_HANDOFF_NOTICE =
  "La evaluación del jurado, los puntajes, el ranking y la publicación de resultados se gestionan en FotoRank. En Clickatón preparás la admisión técnica y el congelamiento para el jurado.";

export const CONFLICT_OF_INTEREST_COPY = {
  title: "Conflicto de interés",
  description:
    "Indicá esta situación si conocés al autor, participaste en la realización de la obra o existe algún vínculo que pueda afectar tu imparcialidad.",
  action: "Informar conflicto de interés",
  /** LEGAL_REVIEW: consecuencia exacta depende de FotoRank. */
  confirmationHint:
    "Esta obra puede quedar fuera de tu evaluación y la organización podrá reasignarla, según las reglas del concurso.",
  legalReview: true as const,
};

/** Resultados públicos Clickatón (ResultsStatus). */
export function presentPublicResultsStatus(
  status: ResultsStatus | string | null | undefined,
): JuryStatusPresentation {
  switch (status) {
    case "not_available":
      return {
        key: "results_na",
        label: "Resultados no disponibles",
        description:
          "Todavía no hay resultados para mostrar. Se mostrarán cuando la organización complete el proceso.",
        tone: "neutral",
        attention: "watch",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "pending":
      return {
        key: "results_pending",
        label: "Resultados en preparación",
        description:
          "El proceso de evaluación está en curso. Todavía no hay un ranking público.",
        tone: "warning",
        attention: "watch",
        nextAction: "Esperá la publicación oficial.",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "partial":
      return {
        key: "results_partial",
        label: "Resultados parciales",
        description:
          "Hay información parcial. No debe leerse como resultado definitivo ni como ganadores oficiales.",
        tone: "warning",
        attention: "action",
        nextAction: "No publiques ni comuniques ganadores hasta la confirmación oficial.",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "published":
      return {
        key: "results_published",
        label: "Resultados publicados",
        description:
          "Los participantes y el público ya pueden consultar el resultado oficial de la edición.",
        tone: "success",
        attention: "ok",
        editable: false,
        complete: true,
        publiclyVisible: true,
        needsAttention: false,
      };
    case "archived":
      return {
        key: "results_archived",
        label: "Resultados archivados",
        description: "Los resultados quedaron archivados para consulta histórica.",
        tone: "neutral",
        attention: "ok",
        editable: false,
        complete: true,
        publiclyVisible: true,
        needsAttention: false,
      };
    default:
      return {
        key: "results_unknown",
        label: "Estado de resultados a revisar",
        description: "Hay un estado de resultados que necesita revisión de soporte.",
        tone: "warning",
        attention: "action",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
  }
}

export function presentGalleryStatus(
  status: GalleryStatus | string | null | undefined,
): JuryStatusPresentation {
  switch (status) {
    case "not_available":
      return {
        key: "gallery_na",
        label: "Galería no disponible",
        description: "Todavía no hay galería pública para esta edición.",
        tone: "neutral",
        attention: "watch",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "coming_soon":
      return {
        key: "gallery_soon",
        label: "Galería próximamente",
        description: "La galería se publicará cuando haya fotografías autorizadas.",
        tone: "info",
        attention: "watch",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "published":
      return {
        key: "gallery_published",
        label: "Galería publicada",
        description: "Hay una selección visual autorizada disponible al público.",
        tone: "success",
        attention: "ok",
        editable: false,
        complete: true,
        publiclyVisible: true,
        needsAttention: false,
      };
    case "archived":
      return {
        key: "gallery_archived",
        label: "Galería archivada",
        description: "La galería quedó archivada.",
        tone: "neutral",
        attention: "ok",
        editable: false,
        complete: true,
        publiclyVisible: true,
        needsAttention: false,
      };
    default:
      return {
        key: "gallery_unknown",
        label: "Estado de galería a revisar",
        description: "Hay un estado de galería que necesita revisión.",
        tone: "warning",
        attention: "action",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
  }
}

/** Invitaciones de jurado (FotorankJudgeInvitationStatus). */
export function presentJuryInvitationStatus(
  status: string | null | undefined,
): JuryStatusPresentation {
  switch (status) {
    case "DRAFT":
      return {
        key: "inv_draft",
        label: "Invitación en borrador",
        description: "La invitación todavía no se envió.",
        tone: "neutral",
        attention: "action",
        nextAction: "Completá y enviá la invitación.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "SENT":
      return {
        key: "inv_sent",
        label: "Invitación enviada",
        description: "El jurado todavía no confirmó su participación.",
        tone: "warning",
        attention: "watch",
        nextAction: "Esperá la respuesta o reenviá si hace falta.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "OPENED":
      return {
        key: "inv_opened",
        label: "Invitación abierta",
        description: "El jurado abrió la invitación, pero todavía no confirmó.",
        tone: "info",
        attention: "watch",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "ACCEPTED":
      return {
        key: "inv_accepted",
        label: "Invitación aceptada",
        description: "El jurado aceptó la invitación.",
        tone: "success",
        attention: "ok",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "REJECTED":
      return {
        key: "inv_rejected",
        label: "Invitación rechazada",
        description: "El jurado declinó participar.",
        tone: "danger",
        attention: "action",
        nextAction: "Invitá a otra persona o revisá la asignación.",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "EXPIRED":
      return {
        key: "inv_expired",
        label: "Invitación vencida",
        description: "La invitación expiró sin confirmación.",
        tone: "warning",
        attention: "action",
        nextAction: "Reenviá la invitación si corresponde.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "REVOKED":
      return {
        key: "inv_revoked",
        label: "Acceso revocado",
        description: "La organización revocó el acceso de esta invitación.",
        tone: "danger",
        attention: "blocked",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    default:
      return {
        key: "inv_unknown",
        label: status ? "Estado de invitación a revisar" : "Sin invitación",
        description: "No hay un estado de invitación claro.",
        tone: "neutral",
        attention: "watch",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: Boolean(status),
      };
  }
}

/** Asignaciones (FotorankJudgeAssignmentStatus). */
export function presentJuryAssignmentStatus(
  status: string | null | undefined,
): JuryStatusPresentation {
  switch (status) {
    case "ASSIGNED":
      return {
        key: "asg_assigned",
        label: "Asignación creada",
        description: "El jurado tiene una asignación, pendiente de invitación o aceptación.",
        tone: "info",
        attention: "watch",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "INVITATION_SENT":
      return {
        key: "asg_invited",
        label: "Invitación pendiente",
        description: "Se envió la invitación ligada a esta asignación.",
        tone: "warning",
        attention: "watch",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "ACCEPTED":
      return {
        key: "asg_accepted",
        label: "Participación confirmada",
        description: "El jurado aceptó y puede comenzar a evaluar cuando corresponda.",
        tone: "success",
        attention: "ok",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "REJECTED":
      return {
        key: "asg_rejected",
        label: "Asignación rechazada",
        description: "El jurado no aceptó esta asignación.",
        tone: "danger",
        attention: "action",
        editable: true,
        complete: true,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "IN_PROGRESS":
      return {
        key: "asg_progress",
        label: "Evaluación en curso",
        description: "El jurado comenzó a puntuar las obras asignadas.",
        tone: "brand",
        attention: "watch",
        nextAction: "Seguí el progreso hasta completar todas las obras.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "COMPLETED":
      return {
        key: "asg_done",
        label: "Evaluación completada",
        description: "El jurado completó las evaluaciones de esta asignación.",
        tone: "success",
        attention: "ok",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "EXTENDED":
      return {
        key: "asg_extended",
        label: "Plazo extendido",
        description: "Se amplió el tiempo para completar la evaluación.",
        tone: "warning",
        attention: "watch",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "REPLACED_BY_BACKUP":
      return {
        key: "asg_replaced",
        label: "Reemplazada por suplente",
        description: "Esta asignación fue cubierta por un jurado suplente.",
        tone: "neutral",
        attention: "ok",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    default:
      return {
        key: "asg_unknown",
        label: "Estado de asignación a revisar",
        description: "Hay un estado de asignación que necesita revisión.",
        tone: "warning",
        attention: "action",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
  }
}

/** Evaluación por obra (FotorankJudgeEntryEvalStatus / JuryEvaluationStatus). */
export function presentJuryEvaluationStatus(
  status: string | null | undefined,
): JuryStatusPresentation {
  switch (status) {
    case "NOT_STARTED":
      return {
        key: "eval_pending",
        label: "Evaluación pendiente",
        description: "La fotografía todavía no tiene una evaluación completa.",
        tone: "warning",
        attention: "action",
        nextAction: "Abrí la obra y asigná los puntajes de cada criterio.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "IN_PROGRESS":
      return {
        key: "eval_progress",
        label: "Evaluación en curso",
        description: "El jurado comenzó a puntuar esta obra.",
        tone: "info",
        attention: "watch",
        nextAction: "Completá los criterios obligatorios y guardá.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "COMPLETED":
    case "SUBMITTED":
      return {
        key: "eval_done",
        label: "Evaluación completada",
        description: "Todos los criterios requeridos fueron evaluados.",
        tone: "success",
        attention: "ok",
        editable: status === "SUBMITTED" ? false : true,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "LOCKED":
      return {
        key: "eval_locked",
        label: "Evaluación cerrada",
        description:
          "El puntaje ya no puede modificarse desde la interfaz habitual.",
        tone: "neutral",
        attention: "blocked",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "CONFLICT_DECLARED":
      return {
        key: "eval_conflict",
        label: "Conflicto de interés informado",
        description:
          "El jurado indicó un conflicto. La organización puede reasignar la obra.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá el caso en el panel de organización.",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "VOIDED":
      return {
        key: "eval_void",
        label: "Evaluación anulada",
        description: "Esta evaluación quedó sin efecto.",
        tone: "danger",
        attention: "blocked",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: true,
      };
    default:
      return {
        key: "eval_unknown",
        label: "Estado de evaluación a revisar",
        description: "Hay un estado de evaluación que necesita revisión.",
        tone: "warning",
        attention: "action",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
  }
}

/** Sesión de puntuación (FotorankJuryScoringSessionStatus). */
export function presentScoringSessionStatus(
  status: string | null | undefined,
): JuryStatusPresentation {
  switch (status) {
    case "DRAFT":
      return {
        key: "score_draft",
        label: "Sesión en preparación",
        description: "La sesión de evaluación todavía no está abierta para los jurados.",
        tone: "warning",
        attention: "action",
        nextAction: "Completá la configuración antes de abrirla.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "READY":
      return {
        key: "score_ready",
        label: "Lista para abrir",
        description: "La sesión está lista; todavía no acepta evaluaciones.",
        tone: "info",
        attention: "action",
        nextAction: "Abrí la sesión cuando corresponda.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "OPEN":
      return {
        key: "score_open",
        label: "Evaluación abierta",
        description: "Los jurados pueden puntuar las obras asignadas.",
        tone: "success",
        attention: "ok",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "PAUSED":
      return {
        key: "score_paused",
        label: "Evaluación en pausa",
        description: "Las evaluaciones están temporalmente detenidas.",
        tone: "warning",
        attention: "action",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "REVIEW_REQUIRED":
      return {
        key: "score_review",
        label: "Requiere revisión",
        description: "Hay condiciones que la organización debe revisar antes de continuar.",
        tone: "warning",
        attention: "action",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "CLOSED":
      return {
        key: "score_closed",
        label: "Evaluaciones cerradas",
        description:
          "Los jurados ya no pueden modificar puntajes desde la interfaz habitual. Esto no publica resultados.",
        tone: "neutral",
        attention: "watch",
        nextAction: "Revisá el ranking antes de confirmar o publicar.",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "LOCKED":
      return {
        key: "score_locked",
        label: "Sesión bloqueada",
        description: "Los cambios de evaluación quedaron bloqueados.",
        tone: "neutral",
        attention: "blocked",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "CANCELLED":
      return {
        key: "score_cancelled",
        label: "Sesión cancelada",
        description: "Esta sesión de evaluación no continúa.",
        tone: "danger",
        attention: "blocked",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    default:
      return {
        key: "score_unknown",
        label: "Estado de sesión a revisar",
        description: "Hay un estado de sesión que necesita revisión.",
        tone: "warning",
        attention: "action",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
  }
}

/** Lote de resultados (FotorankResultBatchStatus). */
export function presentResultBatchStatus(
  status: string | null | undefined,
): JuryStatusPresentation {
  switch (status) {
    case "DRAFT":
      return {
        key: "rb_draft",
        label: "Resultados en borrador",
        description: "Todavía no hay un cálculo revisable de resultados.",
        tone: "neutral",
        attention: "action",
        nextAction: "Generá o actualizá los resultados preliminares.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "GENERATED":
      return {
        key: "rb_generated",
        label: "Resultados preliminares",
        description:
          "Se calculan con las evaluaciones registradas hasta el momento y todavía pueden cambiar.",
        tone: "warning",
        attention: "watch",
        nextAction: "Revisá el ranking antes de confirmar.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "REVIEW_REQUIRED":
      return {
        key: "rb_review",
        label: "Resultados con revisión pendiente",
        description: "Hay empates, conflictos u observaciones que deben resolverse.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá desempates y bloqueos.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "READY_TO_FINALIZE":
      return {
        key: "rb_ready",
        label: "Listos para confirmar",
        description: "Los resultados pueden confirmarse. Todavía no son públicos.",
        tone: "brand",
        attention: "action",
        nextAction: "Confirmá los resultados cuando la organización esté de acuerdo.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "FINALIZED":
      return {
        key: "rb_final",
        label: "Resultados confirmados",
        description:
          "Estos resultados fueron cerrados por la organización. Todavía pueden no estar publicados.",
        tone: "success",
        attention: "watch",
        nextAction: "Publicá cuando corresponda comunicar a participantes.",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "PUBLISHED":
      return {
        key: "rb_published",
        label: "Resultados publicados",
        description: "Los participantes ya pueden consultar el resultado.",
        tone: "success",
        attention: "ok",
        editable: false,
        complete: true,
        publiclyVisible: true,
        needsAttention: false,
      };
    case "CANCELLED":
      return {
        key: "rb_cancelled",
        label: "Resultados cancelados",
        description: "Este lote de resultados no continúa.",
        tone: "danger",
        attention: "blocked",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    default:
      return {
        key: "rb_unknown",
        label: "Estado de resultados a revisar",
        description: "Hay un estado de lote de resultados que necesita revisión.",
        tone: "warning",
        attention: "action",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
  }
}

/** Entrada de ranking (FotorankResultEntryStatus). */
export function presentResultEntryStatus(
  status: string | null | undefined,
  opts?: { preliminary?: boolean },
): JuryStatusPresentation {
  const preliminary = opts?.preliminary ?? false;
  switch (status) {
    case "RANKED":
      return {
        key: "re_ranked",
        label: preliminary ? "Posición provisoria" : "Posición confirmada",
        description: preliminary
          ? "Todavía puede cambiar antes de la publicación oficial."
          : "Posición según el ranking cerrado por la organización.",
        tone: preliminary ? "warning" : "success",
        attention: preliminary ? "watch" : "ok",
        editable: false,
        complete: !preliminary,
        publiclyVisible: !preliminary,
        needsAttention: preliminary,
      };
    case "TIED":
      return {
        key: "re_tied",
        label: "Empate a revisar",
        description:
          "Dos o más obras tienen el mismo resultado según las reglas actuales.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá el desempate según las reglas del concurso.",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "REVIEW_REQUIRED":
      return {
        key: "re_review",
        label: "Requiere revisión",
        description: "Esta posición necesita una revisión de la organización.",
        tone: "warning",
        attention: "action",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "DISQUALIFIED":
      return {
        key: "re_dq",
        label: "No clasificada",
        description: "La obra no participa del ranking en este resultado.",
        tone: "danger",
        attention: "blocked",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "WINNER":
      return {
        key: "re_winner",
        label: preliminary ? "Primera posición provisoria" : "Ganadora",
        description: preliminary
          ? "Posición provisoria. No comunicar como ganadora oficial."
          : "Obra reconocida como ganadora según el resultado cerrado.",
        tone: preliminary ? "warning" : "brand",
        attention: preliminary ? "watch" : "ok",
        editable: false,
        complete: !preliminary,
        publiclyVisible: !preliminary,
        needsAttention: preliminary,
      };
    case "FINALIST":
      return {
        key: "re_finalist",
        label: preliminary ? "Finalista provisional" : "Finalista",
        description: preliminary
          ? "Selección provisoria. Todavía puede cambiar."
          : "Obra seleccionada como finalista.",
        tone: preliminary ? "warning" : "success",
        attention: preliminary ? "watch" : "ok",
        editable: false,
        complete: !preliminary,
        publiclyVisible: !preliminary,
        needsAttention: preliminary,
      };
    case "MENTION":
      return {
        key: "re_mention",
        label: preliminary ? "Mención provisoria" : "Mención",
        description: "Reconocimiento especial según el resultado.",
        tone: "brand",
        attention: "ok",
        editable: false,
        complete: !preliminary,
        publiclyVisible: !preliminary,
        needsAttention: preliminary,
      };
    case "NOT_SELECTED":
      return {
        key: "re_out",
        label: "Sin selección",
        description: "La obra no figura entre las seleccionadas de este resultado.",
        tone: "neutral",
        attention: "ok",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    default:
      return {
        key: "re_unknown",
        label: "Estado de ranking a revisar",
        description: "Hay un estado de posición que necesita revisión.",
        tone: "warning",
        attention: "action",
        editable: false,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
  }
}

/** Hand-off Clickatón: lote de admisión → jurado. */
export function presentJuryHandoffFromBatch(
  batchStatus: string | null | undefined,
): JuryStatusPresentation {
  switch (batchStatus) {
    case "FROZEN":
      return {
        key: "handoff_frozen",
        label: "Lista para el jurado",
        description:
          "El lote técnico quedó congelado. Las obras admitidas pueden continuar a la evaluación artística en FotoRank. Congelar no publica resultados.",
        tone: "success",
        attention: "ok",
        nextAction: "Continuá la evaluación y los resultados en FotoRank.",
        editable: false,
        complete: true,
        publiclyVisible: false,
        needsAttention: false,
      };
    case "CLOSED":
      return {
        key: "handoff_closed",
        label: "Lote cerrado · pendiente de congelar",
        description:
          "El lote técnico está cerrado. Todavía falta congelarlo para el jurado si corresponde.",
        tone: "warning",
        attention: "action",
        nextAction: "Congelá para el jurado cuando esté listo.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    case "DRAFT":
    case "PROCESSING":
    case "REVIEW_REQUIRED":
    case "READY_TO_CLOSE":
      return {
        key: "handoff_prep",
        label: "Preparación técnica en curso",
        description:
          "Todavía se está definiendo qué obras continúan. La evaluación artística no debe tratarse como abierta en Clickatón.",
        tone: "warning",
        attention: "action",
        nextAction: "Completá la admisión técnica antes del jurado.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
    default:
      return {
        key: "handoff_none",
        label: "Sin lote listo para el jurado",
        description:
          "Creá y gestioná el lote de admisión técnica. La evaluación del jurado ocurre en FotoRank.",
        tone: "neutral",
        attention: "action",
        nextAction: "Abrí Admisión técnica de la edición.",
        editable: true,
        complete: false,
        publiclyVisible: false,
        needsAttention: true,
      };
  }
}

export type JuryActionKind =
  | "save_evaluation"
  | "complete_evaluation"
  | "close_evaluations"
  | "reopen_evaluations"
  | "freeze_for_jury"
  | "update_preliminary"
  | "confirm_results"
  | "publish_results"
  | "review_tie"
  | "report_conflict"
  | "invite_juror"
  | "resend_invitation"
  | "revoke_access";

export function presentJuryActionLabel(kind: JuryActionKind): string {
  switch (kind) {
    case "save_evaluation":
      return "Guardar evaluación";
    case "complete_evaluation":
      return "Completar evaluación";
    case "close_evaluations":
      return "Cerrar evaluaciones";
    case "reopen_evaluations":
      return "Reabrir evaluaciones";
    case "freeze_for_jury":
      return "Congelar para el jurado";
    case "update_preliminary":
      return "Actualizar resultados preliminares";
    case "confirm_results":
      return "Confirmar resultados";
    case "publish_results":
      return "Publicar resultados";
    case "review_tie":
      return "Revisar desempate";
    case "report_conflict":
      return "Informar conflicto de interés";
    case "invite_juror":
      return "Invitar jurado";
    case "resend_invitation":
      return "Reenviar invitación";
    case "revoke_access":
      return "Revocar acceso";
  }
}

export function presentScoreScaleHelp(scaleMin: number, scaleMax: number): string {
  if (scaleMin === 1 && scaleMax === 10) {
    return "Seleccioná un valor de 1 a 10 dentro de la escala definida para este criterio.";
  }
  return "Seleccioná un valor dentro de la escala definida para este criterio.";
}

export function formatJuryProgress(evaluated: number, total: number): {
  summary: string;
  pendingLabel: string;
  complete: boolean;
} {
  const safeTotal = Math.max(0, total);
  const safeDone = Math.min(Math.max(0, evaluated), safeTotal);
  const pending = Math.max(0, safeTotal - safeDone);
  return {
    summary:
      safeTotal === 0
        ? "No hay fotografías asignadas"
        : `${safeDone} de ${safeTotal} fotografías evaluadas`,
    pendingLabel:
      pending === 0 ? "Evaluación completada" : `${pending} pendiente${pending === 1 ? "" : "s"}`,
    complete: safeTotal > 0 && pending === 0,
  };
}

export function anonymousWorkLabel(code: string | null | undefined, fallbackIndex?: number): string {
  if (code && code.trim()) return `Obra ${code.trim()}`;
  if (fallbackIndex != null) {
    return `Obra ${String(fallbackIndex).padStart(3, "0")}`;
  }
  return "Obra anónima";
}

export function anonymousWorkAltText(code: string | null | undefined): string {
  return `Fotografía de evaluación ${code?.trim() || "anónima"}. Identidad del autor oculta.`;
}

/** Detecta jerga operativa prohibida en copy visible. */
export function containsForbiddenJuryOpsJargon(text: string): boolean {
  return /\b(ballot|score panel|jury assignment|tie-break hash|freeze batch|lock scores|shortlist|raw aggregate|COI flag)\b/i.test(
    text,
  );
}

/** Campos que no deben mostrarse al jurado (espejo de anonymity.ts). */
export const JURY_UI_FORBIDDEN_IDENTITY_HINTS = [
  "firstName",
  "lastName",
  "email",
  "instagram",
  "documentNumber",
  "originalFileName",
  "gpsLatitude",
  "gpsLongitude",
  "authorUserId",
] as const;
