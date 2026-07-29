import { RegistrationError } from "./errors";

export type ContestWindowSource = {
  status: string;
  registrationEnabled: boolean;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  startAt: Date | null;
  submissionDeadline: Date | null;
  registrationCapacity: number | null;
};

/**
 * Valida que el concurso acepte nuevas inscripciones en `now`.
 * Usa registrationOpensAt/ClosesAt con fallback a startAt/submissionDeadline (alineado a Public API).
 */
export function assertRegistrationWindowOpen(
  contest: ContestWindowSource,
  confirmedCount: number,
  now = new Date(),
): void {
  if (contest.status === "CLOSED" || contest.status === "ARCHIVED") {
    throw new RegistrationError("CONTEST_NOT_OPEN", "El concurso está cerrado.", 403);
  }
  if (contest.status === "DRAFT" || contest.status === "SETUP_IN_PROGRESS" || contest.status === "READY_TO_PUBLISH") {
    throw new RegistrationError("CONTEST_NOT_OPEN", "El concurso aún no está publicado.", 403);
  }
  if (!contest.registrationEnabled) {
    throw new RegistrationError("REGISTRATION_DISABLED", "Las inscripciones no están habilitadas.", 403);
  }

  const opensAt = contest.registrationOpensAt ?? contest.startAt;
  const closesAt = contest.registrationClosesAt ?? contest.submissionDeadline;

  if (opensAt && opensAt.getTime() > now.getTime()) {
    throw new RegistrationError("REGISTRATION_WINDOW_NOT_OPEN", "La inscripción aún no está abierta.", 403);
  }
  if (closesAt && closesAt.getTime() < now.getTime()) {
    throw new RegistrationError("REGISTRATION_WINDOW_CLOSED", "La inscripción ya cerró.", 403);
  }

  if (
    contest.registrationCapacity != null &&
    contest.registrationCapacity > 0 &&
    confirmedCount >= contest.registrationCapacity
  ) {
    throw new RegistrationError("CAPACITY_FULL", "No quedan cupos disponibles.", 409);
  }
}
