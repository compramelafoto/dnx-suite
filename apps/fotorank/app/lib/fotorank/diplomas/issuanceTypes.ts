/** Alineado con enum Prisma `FotorankDiplomaRecipientType`. */
export type FotorankDiplomaRecipientType = "PARTICIPANT" | "ENTRY" | "JUDGE" | "COLLABORATOR";

export type DiplomaIssuanceMode =
  | "ALL_PARTICIPANTS"
  | "ALL_ENTRIES"
  | "FINALISTS"
  | "WINNERS"
  | "BY_CATEGORY_ENTRIES"
  | "BY_CATEGORY_PARTICIPANTS"
  | "MANUAL_ENTRY_IDS"
  | "ALL_JUDGES"
  | "COLLABORATOR_NAMES"
  | "SINGLE_ENTRY"
  | "SINGLE_JUDGE"
  | "SINGLE_PARTICIPANT"
  | "SINGLE_COLLABORATOR";

export type PlanRow = {
  /** Dedup estable en el plan */
  key: string;
  recipientType: FotorankDiplomaRecipientType;
  recipientName: string;
  recipientUserId: number | null;
  entryId: string | null;
  judgeAccountId: string | null;
  contestCategoryId: string | null;
  prizeLabel: string | null;
  /** Título de obra para merge {{entryTitle}}; null si no aplica */
  entryTitle: string | null;
  errors: string[];
  warnings: string[];
};

export type DiplomaPlanResult = {
  rows: PlanRow[];
  /** Filas con al menos un error (no deben emitirse) */
  errorRowCount: number;
  /** Filas con warning pero emitibles */
  warningRowCount: number;
  okRowCount: number;
  globalWarnings: string[];
};
