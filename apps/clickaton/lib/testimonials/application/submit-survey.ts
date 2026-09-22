/**
 * Guardar una encuesta y, si corresponde, su testimonio.
 *
 * Dos reglas que no se negocian:
 * 1. `improvementNotes` se guarda en la respuesta y NUNCA se copia al
 *    testimonio, que es lo único que puede llegar al sitio público.
 * 2. El nombre, la foto y el rol salen de la elegibilidad ya resuelta contra
 *    la base, nunca de lo que venga en el formulario.
 */
import { normalizeAuthorLink } from "../domain/author-link.ts";
import { buildExcerpt } from "../domain/excerpt.ts";
import type { EligibleAuthor } from "../domain/eligibility.ts";
import type { SurveyScores, TestimonialRepository } from "../domain/repository.ts";
import {
  ASPECT_MAX,
  ASPECT_MIN,
  IMPROVEMENT_MAX_LENGTH,
  NPS_MAX,
  NPS_MIN,
  QUOTE_MAX_LENGTH,
  SURVEY_ASPECT_FIELDS,
  type WouldReturnValue,
} from "../domain/survey-definition.ts";

export type SubmitSurveyInput = {
  editionId: string;
  userId: number;
  email: string;
  eligibility: EligibleAuthor;
  npsScore: number;
  scores: SurveyScores;
  wouldReturn: WouldReturnValue | null;
  improvementNotes: string | null;
  publicQuote: string | null;
  authorLinkRaw: string | null;
  publicationConsent: boolean;
  audit: { ip: string | null; userAgent: string | null };
};

export type SubmitSurveyError =
  | "INVALID_NPS"
  | "INVALID_SCORE"
  | "QUOTE_TOO_LONG"
  | "NOTES_TOO_LONG"
  | "CONSENT_WITHOUT_QUOTE";

export type SubmitSurveyResult =
  | { ok: true; surveyResponseId: string; testimonialId: string | null }
  | { ok: false; error: SubmitSurveyError };

export const SUBMIT_SURVEY_ERROR_COPY: Record<SubmitSurveyError, string> = {
  INVALID_NPS: "Elegí un número del 0 al 10 para la recomendación.",
  INVALID_SCORE: "Las notas van de 1 a 5, o podés marcar «No aplica».",
  QUOTE_TOO_LONG: `Tu testimonio no puede pasar de ${QUOTE_MAX_LENGTH} caracteres.`,
  NOTES_TOO_LONG: `Lo que querés mejorar no puede pasar de ${IMPROVEMENT_MAX_LENGTH} caracteres.`,
  CONSENT_WITHOUT_QUOTE:
    "Autorizaste la publicación pero no escribiste tu testimonio. Escribilo o destildá la autorización.",
};

function emptyToNull(value: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function submitSurvey(
  repo: TestimonialRepository,
  input: SubmitSurveyInput,
): Promise<SubmitSurveyResult> {
  if (
    !Number.isInteger(input.npsScore) ||
    input.npsScore < NPS_MIN ||
    input.npsScore > NPS_MAX
  ) {
    return { ok: false, error: "INVALID_NPS" };
  }

  for (const field of SURVEY_ASPECT_FIELDS) {
    const value = input.scores[field];
    if (value === null || value === undefined) continue;
    if (!Number.isInteger(value) || value < ASPECT_MIN || value > ASPECT_MAX) {
      return { ok: false, error: "INVALID_SCORE" };
    }
  }

  const quote = emptyToNull(input.publicQuote);
  if (quote && quote.length > QUOTE_MAX_LENGTH) {
    return { ok: false, error: "QUOTE_TOO_LONG" };
  }

  const notes = emptyToNull(input.improvementNotes);
  if (notes && notes.length > IMPROVEMENT_MAX_LENGTH) {
    return { ok: false, error: "NOTES_TOO_LONG" };
  }

  if (input.publicationConsent && !quote) {
    return { ok: false, error: "CONSENT_WITHOUT_QUOTE" };
  }

  const response = await repo.saveResponse({
    editionId: input.editionId,
    userId: input.userId,
    authorRole: input.eligibility.role,
    registrationId: input.eligibility.registrationId,
    venueId: input.eligibility.venueId,
    npsScore: input.npsScore,
    scores: input.scores,
    wouldReturn: input.wouldReturn,
    improvementNotes: notes,
    auditIp: input.audit.ip,
    auditUserAgent: input.audit.userAgent,
  });

  let testimonialId: string | null = null;

  if (input.publicationConsent && quote) {
    const link =
      normalizeAuthorLink(input.authorLinkRaw) ??
      normalizeAuthorLink(input.eligibility.suggestedLinkUrl);

    const testimonial = await repo.saveTestimonial({
      surveyResponseId: response.id,
      editionId: input.editionId,
      userId: input.userId,
      authorRole: input.eligibility.role,
      quote,
      highlightedExcerpt: buildExcerpt(quote),
      publicationConsent: true,
      authorName: input.eligibility.authorName,
      authorPhotoAssetId: input.eligibility.authorPhotoAssetId,
      authorLinkUrl: link,
      consentAcceptedAt: new Date(),
    });
    testimonialId = testimonial.id;
  } else {
    // Retirar la autorización retira el testimonio, publicado o no.
    await repo.deleteTestimonialForResponse(response.id);
  }

  await repo.markInviteResponded(input.editionId, input.email);

  return { ok: true, surveyResponseId: response.id, testimonialId };
}
