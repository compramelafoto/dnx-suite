/**
 * Repositorio en memoria para probar el guardado sin base de datos.
 * No se usa en producción.
 */
import type {
  ExistingAnswer,
  SaveResponseInput,
  SaveTestimonialInput,
  SurveyResponseRecord,
  TestimonialRecord,
  TestimonialRepository,
} from "../domain/repository.ts";

export class InMemoryTestimonialRepository implements TestimonialRepository {
  readonly responses = new Map<string, SurveyResponseRecord>();
  readonly testimonials = new Map<string, TestimonialRecord>();
  readonly invitesMarked: Array<{ editionId: string; email: string }> = [];

  private nextId = 1;

  private key(editionId: string, userId: number): string {
    return `${editionId}::${userId}`;
  }

  async findAnswer(editionId: string, userId: number): Promise<ExistingAnswer | null> {
    const response = [...this.responses.values()].find(
      (r) => this.key(r.editionId, r.userId) === this.key(editionId, userId),
    );
    if (!response) return null;
    const testimonial =
      [...this.testimonials.values()].find(
        (t) => t.surveyResponseId === response.id,
      ) ?? null;
    return { response, testimonial };
  }

  async saveResponse(input: SaveResponseInput): Promise<SurveyResponseRecord> {
    const existing = await this.findAnswer(input.editionId, input.userId);
    const id = existing?.response.id ?? `resp${this.nextId++}`;
    const record: SurveyResponseRecord = {
      id,
      editionId: input.editionId,
      userId: input.userId,
      authorRole: input.authorRole,
      registrationId: input.registrationId,
      venueId: input.venueId,
      npsScore: input.npsScore,
      scores: input.scores,
      wouldReturn: input.wouldReturn,
      improvementNotes: input.improvementNotes,
    };
    this.responses.set(id, record);
    return record;
  }

  async saveTestimonial(input: SaveTestimonialInput): Promise<TestimonialRecord> {
    const existing = [...this.testimonials.values()].find(
      (t) => t.surveyResponseId === input.surveyResponseId,
    );
    const id = existing?.id ?? `test${this.nextId++}`;
    const record: TestimonialRecord = {
      id,
      surveyResponseId: input.surveyResponseId,
      editionId: input.editionId,
      userId: input.userId,
      authorRole: input.authorRole,
      quote: input.quote,
      highlightedExcerpt: input.highlightedExcerpt,
      // Editar siempre devuelve a moderación.
      status: "PENDING",
      publicationConsent: input.publicationConsent,
      authorName: input.authorName,
      authorPhotoAssetId: input.authorPhotoAssetId,
      authorLinkUrl: input.authorLinkUrl,
    };
    this.testimonials.set(id, record);
    return record;
  }

  async deleteTestimonialForResponse(surveyResponseId: string): Promise<void> {
    for (const [id, t] of this.testimonials) {
      if (t.surveyResponseId === surveyResponseId) this.testimonials.delete(id);
    }
  }

  async markInviteResponded(editionId: string, email: string): Promise<void> {
    this.invitesMarked.push({ editionId, email });
  }

  /** Sólo para pruebas: simula que el admin publicó. */
  publishForTest(testimonialId: string): void {
    const t = this.testimonials.get(testimonialId);
    if (t) this.testimonials.set(testimonialId, { ...t, status: "PUBLISHED" });
  }
}
