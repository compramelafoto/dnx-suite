/**
 * Preview de credencial — no emite artefactos productivos.
 * Reutiliza @repo/media-composition; el diseño final debe aprobarse aparte.
 */
import {
  CLICKATON_CREDENTIAL_PREVIEW_V1,
  collectMissingVariables,
} from "@repo/media-composition";

export function getCredentialPreviewTemplate() {
  return CLICKATON_CREDENTIAL_PREVIEW_V1;
}

export function buildCredentialPreviewVariables(input: {
  participantName: string;
  participantNumber: string;
  city: string;
  editionName: string;
}) {
  const variables = {
    participantName: input.participantName,
    participantNumber: input.participantNumber,
    city: input.city,
    editionName: input.editionName,
    roleLabel: "PARTICIPANTE",
  };
  const missing = collectMissingVariables(
    CLICKATON_CREDENTIAL_PREVIEW_V1.variables,
    variables,
  );
  return { templateId: CLICKATON_CREDENTIAL_PREVIEW_V1.id, variables, missing };
}
