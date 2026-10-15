/**
 * El contrato de persistencia del módulo, declarado aparte de Prisma para que
 * la lógica de guardado se pueda probar sin base de datos.
 */
import type {
  ClickatonTestimonialAuthorRole,
  ClickatonTestimonialStatus,
} from "./types";
import type { SurveyAspectField, WouldReturnValue } from "./survey-definition";

export type SurveyScores = Record<SurveyAspectField, number | null>;

export type SurveyResponseRecord = {
  id: string;
  editionId: string;
  userId: number;
  authorRole: ClickatonTestimonialAuthorRole;
  registrationId: string | null;
  venueId: string | null;
  npsScore: number;
  scores: SurveyScores;
  wouldReturn: WouldReturnValue | null;
  improvementNotes: string | null;
};

export type TestimonialRecord = {
  id: string;
  surveyResponseId: string;
  editionId: string;
  userId: number;
  authorRole: ClickatonTestimonialAuthorRole;
  quote: string;
  highlightedExcerpt: string | null;
  status: ClickatonTestimonialStatus;
  publicationConsent: boolean;
  authorName: string;
  authorPhotoAssetId: string | null;
  authorLinkUrl: string | null;
};

export type SaveResponseInput = Omit<SurveyResponseRecord, "id"> & {
  auditIp: string | null;
  auditUserAgent: string | null;
};

export type SaveTestimonialInput = Omit<TestimonialRecord, "id" | "status"> & {
  consentAcceptedAt: Date;
};

export type ExistingAnswer = {
  response: SurveyResponseRecord;
  testimonial: TestimonialRecord | null;
};

export interface TestimonialRepository {
  findAnswer(editionId: string, userId: number): Promise<ExistingAnswer | null>;
  saveResponse(input: SaveResponseInput): Promise<SurveyResponseRecord>;
  /** Crea o actualiza. Siempre deja el testimonio en PENDING. */
  saveTestimonial(input: SaveTestimonialInput): Promise<TestimonialRecord>;
  deleteTestimonialForResponse(surveyResponseId: string): Promise<void>;
  markInviteResponded(editionId: string, email: string): Promise<void>;
}
