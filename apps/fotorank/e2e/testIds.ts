/**
 * data-testid alineados con la UI de Fotorank (solo atributos en componentes).
 */
/** Tarjeta de concurso en `/concursos` (`ContestCard`, slug estable del seed). */
export function contestCardTestId(slug: string): string {
  return `fotorank-contest-card-${slug}`;
}

export const TT = {
  /** Tabla de ranking en `/dashboard/concursos/[id]/resultados`. */
  resultsTable: "fotorank-results-table",

  judgeAdminForm: "judge-admin-form",
  judgeAdminSubmit: "judge-admin-submit",

  judgeAvatarTabUrl: "judge-avatar-tab-url",
  judgeAvatarTabFile: "judge-avatar-tab-file",

  judgeAvatarPreview: "judge-avatar-preview",
  judgeAvatarPreviewImg: "judge-avatar-preview-img",

  judgeBioEditor: "judge-bio-editor",
  judgeBioAddParagraph: "judge-bio-add-paragraph",
  judgeBioParagraph: "judge-bio-paragraph",
  judgeBioRichJson: "judge-bio-rich-json",
  judgeBioPreview: "judge-bio-preview",

  evaluationForm: "evaluation-form",
  evaluationCriteria: "evaluation-criteria",
  evaluationCriteriaHint: "evaluation-criteria-hint",
  evaluationSubmit: "evaluation-submit",
  voteSavedMessage: "vote-saved-message",
  evaluationError: "evaluation-error",

  judgeRegisterForm: "judge-register-form",
  judgeRegisterSubmit: "judge-register-submit",
  judgeRegisterError: "judge-register-error",
} as const;

export function criterionInputTestId(key: string): string {
  return `criterion-input-${key}`;
}
