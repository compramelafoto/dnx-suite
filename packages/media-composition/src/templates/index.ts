import { CLICKATON_WELCOME_STORY_V1 } from "./clickaton-welcome-story";
import { CLICKATON_CREDENTIAL_PREVIEW_V1 } from "./clickaton-credential-preview";
import {
  CLICKATON_RESULTS_FINALIST_DRAFT,
  CLICKATON_RESULTS_WINNER_DRAFT,
} from "./clickaton-results-draft";
import type { CompositionTemplate } from "../types";

const REGISTRY = new Map<string, CompositionTemplate>([
  [CLICKATON_WELCOME_STORY_V1.id, CLICKATON_WELCOME_STORY_V1],
  [CLICKATON_CREDENTIAL_PREVIEW_V1.id, CLICKATON_CREDENTIAL_PREVIEW_V1],
  [CLICKATON_RESULTS_WINNER_DRAFT.id, CLICKATON_RESULTS_WINNER_DRAFT],
  [CLICKATON_RESULTS_FINALIST_DRAFT.id, CLICKATON_RESULTS_FINALIST_DRAFT],
]);

export function getCompositionTemplate(id: string): CompositionTemplate | null {
  return REGISTRY.get(id) ?? null;
}

export function listCompositionTemplates(): CompositionTemplate[] {
  return [...REGISTRY.values()];
}

export {
  CLICKATON_WELCOME_STORY_V1,
  CLICKATON_CREDENTIAL_PREVIEW_V1,
  CLICKATON_RESULTS_WINNER_DRAFT,
  CLICKATON_RESULTS_FINALIST_DRAFT,
};
