import type { AssistantIntent } from "../../models/assistant.js";

export type ScenarioFieldExpectation =
  | "SERVICE_TYPE"
  | "EVENT_DATE"
  | "CITY"
  | "DURATION_HOURS";

export type ConversationScenarioExpectations = {
  expectedIntent?: AssistantIntent;
  expectedKnownFields?: ScenarioFieldExpectation[];
  forbiddenQuestionsAbout?: ScenarioFieldExpectation[];
  maximumAssistantQuestionsPerTurn?: number;
  shouldReachReadyForCalculation?: boolean;
  /** Si true, exige pricing runtime READY (requiere config sintética). */
  expectPricingReady?: boolean;
  /** Intents permitidos cuando no se exige uno exacto. */
  allowedIntents?: AssistantIntent[];
  /** No debe pedirse cotización / no READY. */
  shouldNotReachReady?: boolean;
  /** Score mínimo dani-style-v1 (evaluación offline). */
  minimumDaniStyleScore?: number;
  /** Escenario crítico: no puede empeorar severamente vs legacy. */
  criticalStyleScenario?: boolean;
  /** Debe detectar intención visual (sin mostrar fotos). */
  expectVisualReference?: boolean;
  /** Prohibir lenguaje de formulario / técnico en respuestas. */
  forbidFormAndTechnicalLanguage?: boolean;
};

export type ConversationScenario = {
  id: string;
  description: string;
  messages: string[];
  expectations?: ConversationScenarioExpectations;
};
