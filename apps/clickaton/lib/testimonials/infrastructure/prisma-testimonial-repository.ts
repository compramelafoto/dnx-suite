import "server-only";

import { prisma } from "@repo/db";
import type {
  ExistingAnswer,
  SaveResponseInput,
  SaveTestimonialInput,
  SurveyResponseRecord,
  SurveyScores,
  TestimonialRecord,
  TestimonialRepository,
} from "../domain/repository";
import type { WouldReturnValue } from "../domain/survey-definition";

type ResponseRow = {
  id: string;
  editionId: string;
  userId: number;
  authorRole: SurveyResponseRecord["authorRole"];
  registrationId: string | null;
  venueId: string | null;
  npsScore: number;
  scoreOrganization: number | null;
  scorePrompts: number | null;
  scoreVenue: number | null;
  scoreKit: number | null;
  scoreAccreditation: number | null;
  scoreCommunication: number | null;
  scoreValueForMoney: number | null;
  wouldReturn: WouldReturnValue | null;
  improvementNotes: string | null;
};

function toScores(row: ResponseRow): SurveyScores {
  return {
    scoreOrganization: row.scoreOrganization,
    scorePrompts: row.scorePrompts,
    scoreVenue: row.scoreVenue,
    scoreKit: row.scoreKit,
    scoreAccreditation: row.scoreAccreditation,
    scoreCommunication: row.scoreCommunication,
    scoreValueForMoney: row.scoreValueForMoney,
  };
}

function toResponseRecord(row: ResponseRow): SurveyResponseRecord {
  return {
    id: row.id,
    editionId: row.editionId,
    userId: row.userId,
    authorRole: row.authorRole,
    registrationId: row.registrationId,
    venueId: row.venueId,
    npsScore: row.npsScore,
    scores: toScores(row),
    wouldReturn: row.wouldReturn,
    improvementNotes: row.improvementNotes,
  };
}

export class PrismaTestimonialRepository implements TestimonialRepository {
  async findAnswer(editionId: string, userId: number): Promise<ExistingAnswer | null> {
    const row = await prisma.clickatonSurveyResponse.findUnique({
      where: { editionId_userId: { editionId, userId } },
      include: { testimonial: true },
    });
    if (!row) return null;

    return {
      response: toResponseRecord(row as unknown as ResponseRow),
      testimonial: row.testimonial
        ? ({
            id: row.testimonial.id,
            surveyResponseId: row.testimonial.surveyResponseId,
            editionId: row.testimonial.editionId,
            userId: row.testimonial.userId,
            authorRole: row.testimonial.authorRole,
            quote: row.testimonial.quote,
            highlightedExcerpt: row.testimonial.highlightedExcerpt,
            status: row.testimonial.status,
            publicationConsent: row.testimonial.publicationConsent,
            authorName: row.testimonial.authorName,
            authorPhotoAssetId: row.testimonial.authorPhotoAssetId,
            authorLinkUrl: row.testimonial.authorLinkUrl,
          } satisfies TestimonialRecord)
        : null,
    };
  }

  async saveResponse(input: SaveResponseInput): Promise<SurveyResponseRecord> {
    const data = {
      authorRole: input.authorRole,
      registrationId: input.registrationId,
      venueId: input.venueId,
      npsScore: input.npsScore,
      ...input.scores,
      wouldReturn: input.wouldReturn,
      improvementNotes: input.improvementNotes,
      auditIp: input.auditIp,
      auditUserAgent: input.auditUserAgent,
    };

    const row = await prisma.clickatonSurveyResponse.upsert({
      where: { editionId_userId: { editionId: input.editionId, userId: input.userId } },
      create: { editionId: input.editionId, userId: input.userId, ...data },
      update: data,
    });

    return toResponseRecord(row as unknown as ResponseRow);
  }

  async saveTestimonial(input: SaveTestimonialInput): Promise<TestimonialRecord> {
    // Editar el texto siempre devuelve a moderación: lo que se aprobó ya no es
    // lo que dice ahora.
    const shared = {
      editionId: input.editionId,
      userId: input.userId,
      authorRole: input.authorRole,
      quote: input.quote,
      highlightedExcerpt: input.highlightedExcerpt,
      status: "PENDING" as const,
      publicationConsent: input.publicationConsent,
      consentAcceptedAt: input.consentAcceptedAt,
      authorName: input.authorName,
      authorPhotoAssetId: input.authorPhotoAssetId,
      authorLinkUrl: input.authorLinkUrl,
      publishedAt: null,
    };

    const row = await prisma.clickatonTestimonial.upsert({
      where: { surveyResponseId: input.surveyResponseId },
      create: { surveyResponseId: input.surveyResponseId, ...shared },
      update: shared,
    });

    return {
      id: row.id,
      surveyResponseId: row.surveyResponseId,
      editionId: row.editionId,
      userId: row.userId,
      authorRole: row.authorRole,
      quote: row.quote,
      highlightedExcerpt: row.highlightedExcerpt,
      status: row.status,
      publicationConsent: row.publicationConsent,
      authorName: row.authorName,
      authorPhotoAssetId: row.authorPhotoAssetId,
      authorLinkUrl: row.authorLinkUrl,
    };
  }

  async deleteTestimonialForResponse(surveyResponseId: string): Promise<void> {
    await prisma.clickatonTestimonial.deleteMany({ where: { surveyResponseId } });
  }

  async markInviteResponded(editionId: string, email: string): Promise<void> {
    await prisma.clickatonTestimonialInvite.updateMany({
      where: { editionId, email: { equals: email.trim(), mode: "insensitive" } },
      data: { status: "RESPONDED", respondedAt: new Date() },
    });
  }
}

export const testimonialRepository = new PrismaTestimonialRepository();
