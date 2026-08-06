/**
 * Evaluación de ventana de carga (misma lógica canónica que entry-service).
 * Solo lectura para UI — no abre ni cierra ventanas.
 */

import { isPublicUploadOpenFlag } from "../entries/upload-policy";

export type UploadWindowInput = {
  submissionOpensAt: Date | null;
  submissionDeadline: Date | null;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  startAt: Date | null;
  status: string;
  uploadPolicyJson?: unknown;
};

export type UploadWindowPhase = "not_yet_open" | "open" | "closed" | "contest_closed";

export type UploadWindowView = {
  isOpen: boolean;
  phase: UploadWindowPhase;
  opensAt: Date | null;
  closesAt: Date | null;
};

export function resolveUploadWindow(contest: UploadWindowInput, now = new Date()): UploadWindowView {
  const opensAt = contest.submissionOpensAt ?? contest.registrationOpensAt ?? contest.startAt;
  const closesAt = contest.submissionDeadline ?? contest.registrationClosesAt;

  if (contest.status === "CLOSED" || contest.status === "ARCHIVED") {
    return { isOpen: false, phase: "contest_closed", opensAt, closesAt };
  }
  const flag = isPublicUploadOpenFlag(contest.uploadPolicyJson);
  if (flag === false) {
    return { isOpen: false, phase: "closed", opensAt, closesAt };
  }
  if (opensAt && opensAt.getTime() > now.getTime()) {
    return { isOpen: false, phase: "not_yet_open", opensAt, closesAt };
  }
  if (closesAt && closesAt.getTime() < now.getTime()) {
    return { isOpen: false, phase: "closed", opensAt, closesAt };
  }
  return { isOpen: true, phase: "open", opensAt, closesAt };
}
