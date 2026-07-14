/**
 * Ventanas temporales públicas de la edición.
 * Complementa `startAt`/`endAt` y el cronograma de ítems.
 */

export type PublicScheduleWindowKind =
  | "registration"
  | "check_in"
  | "start"
  | "challenges"
  | "capture"
  | "upload"
  | "judging"
  | "results"
  | "other";

export type PublicScheduleWindow = {
  id: string;
  marathonId: string;
  kind: PublicScheduleWindowKind;
  label: string;
  opensAt: string;
  closesAt?: string;
  visible: boolean;
  description?: string;
};
