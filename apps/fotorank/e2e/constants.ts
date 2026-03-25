/**
 * Debe coincidir con `packages/db/prisma/seed.ts` (invitación, concurso E2E, entrada «Foto E2E», voto resultados).
 */
export const E2E_INVITE_PLAIN_TOKEN =
  "e2e0123456789abcdef0123456789abcdef0123456789ab";

export const E2E_ADMIN_EMAIL = "admin@fotorank.local";
/** Debe coincidir con el seed (`AdminSeed!e2e`). */
export const E2E_ADMIN_PASSWORD = "AdminSeed!e2e";
export const E2E_DEMO_JUDGE_EMAIL = "jury.demo@fotorank.local";
export const E2E_DEMO_JUDGE_PASSWORD = "JudgeDemo!e2e";
export const E2E_INVITE_JUDGE_EMAIL = "jury.invite@fotorank.local";
/** Contraseña sembrada; el formulario de registro no la renueva si la cuenta ya existe. */
export const E2E_INVITE_JUDGE_PASSWORD = "InviteSeed!e2e";
/** Categoría sembrada para invitación / jurado panel-bloqueado (nombre en UI del panel). */
export const E2E_INVITE_CATEGORY_LABEL = "Categoría invitación";

/**
 * Jurado con asignación fija `INVITATION_SENT` (misma categoría que la invitación token, no General);
 * no se usa en el E2E de aceptar invitación. Ver `packages/db/prisma/seed.ts`.
 */
export const E2E_PANEL_BLOCKED_JUDGE_EMAIL = "jury.panel-bloqueado@fotorank.local";
export const E2E_PANEL_BLOCKED_JUDGE_PASSWORD = "PanelBloq!e2e";

/** Token inexistente en BD para assertar «Invitación inválida» en registro. */
export const E2E_INVALID_INVITE_TOKEN = "e2e-token-invalido-que-no-existe-en-bd-xxxxxxxx";
export const E2E_CONTEST_SLUG = "e2e-demo-contest";
/** Nombre de la org del concurso E2E (`seed.ts`); usado si hay selector multi-org en /jurados. */
export const E2E_FOTORANK_ORG_NAME = "E2E Fotorank Org";
export const E2E_PUBLIC_JUDGE_SLUG = "jurado-demo-e2e";

/** Concurso Fotorank sembrado (`seed.ts`) para jurados / resultados E2E. */
export const E2E_FOTORANK_CONTEST_TITLE = "Concurso E2E Jurados";
/** Entrada en categoría General del concurso E2E. */
export const E2E_FOTORANK_ENTRY_TITLE = "Foto E2E";
/**
 * Texto en columna «Valor agregado» con un voto CRITERIA_BASED y criterios 4,5,3,4
 * (misma muestra que `E2E_CRITERIA_BASED_SAMPLE` → media 4).
 */
export const E2E_FOTORANK_RESULTS_AGGREGATE_DISPLAY = "4.00";

/**
 * Criterios y escala del método CRITERIA_BASED en el seed (`E2E_CRITERIA_METHOD_CONFIG` en `packages/db/prisma/seed.ts`).
 * En E2E se localizan con `data-testid="criterion-input-<key>"` (name sigue siendo `criterion_<key>` para el submit).
 */
export const E2E_CRITERIA_BASED_KEYS = ["technique", "creativity", "composition", "impact"] as const;

export type E2ECriteriaBasedKey = (typeof E2E_CRITERIA_BASED_KEYS)[number];

/** Puntajes válidos para E2E: escala 1–5, paso 1 (todos los valores ∈ [1,5] ∩ paso). */
export const E2E_CRITERIA_BASED_SAMPLE: Record<E2ECriteriaBasedKey, number> = {
  technique: 4,
  creativity: 5,
  composition: 3,
  impact: 4,
};

/** Segundo envío E2E (misma escala válida) para comprobar actualización de voto. */
export const E2E_CRITERIA_BASED_SAMPLE_ALT: Record<E2ECriteriaBasedKey, number> = {
  technique: 5,
  creativity: 4,
  composition: 4,
  impact: 5,
};

/** IDs fijos sembrados en `packages/db/prisma/seed.ts` para URLs de evaluación E2E. */
export const E2E_ASSIGNMENT_WINDOW_CLOSED_ID = "e2e_assign_window_closed";
export const E2E_ASSIGNMENT_DRAFT_CONTEST_ID = "e2e_assign_draft_contest";

export const E2E_WINDOW_CLOSED_JUDGE_EMAIL = "jury.window-closed@fotorank.local";
export const E2E_WINDOW_CLOSED_JUDGE_PASSWORD = "WindowClosed!e2e";

export const E2E_DRAFT_EVAL_JUDGE_EMAIL = "jury.draft-eval@fotorank.local";
export const E2E_DRAFT_EVAL_JUDGE_PASSWORD = "DraftEval!e2e";
