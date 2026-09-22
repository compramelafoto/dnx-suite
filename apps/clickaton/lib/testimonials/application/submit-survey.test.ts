import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryTestimonialRepository } from "../infrastructure/in-memory-testimonial-repository.ts";
import { submitSurvey, type SubmitSurveyInput } from "./submit-survey.ts";

const autor = {
  eligible: true as const,
  role: "PARTICIPANT" as const,
  authorName: "Ana Pérez",
  authorPhotoAssetId: "asset1",
  suggestedLinkUrl: "https://instagram.com/ana",
  registrationId: "reg1",
  venueId: null,
};

function entrada(over: Partial<SubmitSurveyInput> = {}): SubmitSurveyInput {
  return {
    editionId: "ed1",
    userId: 7,
    email: "ana@example.test",
    eligibility: autor,
    npsScore: 9,
    scores: {
      scoreOrganization: 5,
      scorePrompts: 4,
      scoreVenue: null,
      scoreKit: 3,
      scoreAccreditation: 5,
      scoreCommunication: 4,
      scoreValueForMoney: 4,
    },
    wouldReturn: "YES",
    improvementNotes: null,
    publicQuote: null,
    authorLinkRaw: null,
    publicationConsent: false,
    audit: { ip: null, userAgent: null },
    ...over,
  };
}

test("guarda la encuesta y no crea testimonio sin consentimiento", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(repo, entrada({ publicQuote: "Estuvo buenísimo" }));

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.testimonialId, null);
  assert.equal(repo.testimonials.size, 0);
  assert.equal(repo.responses.size, 1);
});

test("con consentimiento y texto crea el testimonio en PENDING", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(
    repo,
    entrada({ publicQuote: "Estuvo buenísimo", publicationConsent: true }),
  );

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.testimonialId);
  const t = repo.testimonials.get(r.testimonialId!)!;
  assert.equal(t.status, "PENDING");
  assert.equal(t.quote, "Estuvo buenísimo");
  assert.equal(t.authorName, "Ana Pérez");
  assert.equal(t.publicationConsent, true);
});

test("la crítica constructiva nunca llega al testimonio", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(
    repo,
    entrada({
      publicQuote: "Estuvo buenísimo",
      publicationConsent: true,
      improvementNotes: "la fila de acreditación fue un desastre",
    }),
  );

  assert.equal(r.ok, true);
  const guardado = JSON.stringify([...repo.testimonials.values()]);
  assert.ok(!guardado.includes("desastre"), "la crítica se filtró al testimonio");

  const respuesta = [...repo.responses.values()][0]!;
  assert.equal(respuesta.improvementNotes, "la fila de acreditación fue un desastre");
});

test("la identidad sale de la elegibilidad, no de lo que se mande", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(
    repo,
    entrada({ publicQuote: "Buenísimo", publicationConsent: true }),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const t = repo.testimonials.get(r.testimonialId!)!;
  assert.equal(t.authorName, "Ana Pérez");
  assert.equal(t.authorPhotoAssetId, "asset1");
});

test("el enlace propio se normaliza antes de guardarse", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(
    repo,
    entrada({
      publicQuote: "Buenísimo",
      publicationConsent: true,
      authorLinkRaw: "@anafoto",
    }),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(
    repo.testimonials.get(r.testimonialId!)!.authorLinkUrl,
    "https://instagram.com/anafoto",
  );
});

test("sin enlace propio se usa el Instagram de la inscripción", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(
    repo,
    entrada({ publicQuote: "Buenísimo", publicationConsent: true }),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(
    repo.testimonials.get(r.testimonialId!)!.authorLinkUrl,
    "https://instagram.com/ana",
  );
});

test("responder dos veces edita, no duplica", async () => {
  const repo = new InMemoryTestimonialRepository();
  await submitSurvey(repo, entrada({ npsScore: 8 }));
  await submitSurvey(repo, entrada({ npsScore: 10 }));

  assert.equal(repo.responses.size, 1);
  assert.equal([...repo.responses.values()][0]!.npsScore, 10);
});

test("editar un testimonio publicado lo devuelve a PENDING", async () => {
  const repo = new InMemoryTestimonialRepository();
  const primero = await submitSurvey(
    repo,
    entrada({ publicQuote: "Primera versión", publicationConsent: true }),
  );
  assert.equal(primero.ok, true);
  if (!primero.ok) return;

  repo.publishForTest(primero.testimonialId!);
  assert.equal(repo.testimonials.get(primero.testimonialId!)!.status, "PUBLISHED");

  await submitSurvey(
    repo,
    entrada({ publicQuote: "Segunda versión", publicationConsent: true }),
  );

  const t = [...repo.testimonials.values()][0]!;
  assert.equal(t.status, "PENDING");
  assert.equal(t.quote, "Segunda versión");
});

test("retirar el consentimiento borra el testimonio que había", async () => {
  const repo = new InMemoryTestimonialRepository();
  await submitSurvey(
    repo,
    entrada({ publicQuote: "Buenísimo", publicationConsent: true }),
  );
  assert.equal(repo.testimonials.size, 1);

  await submitSurvey(
    repo,
    entrada({ publicQuote: "Buenísimo", publicationConsent: false }),
  );
  assert.equal(repo.testimonials.size, 0);
});

test("responder marca la invitación como respondida", async () => {
  const repo = new InMemoryTestimonialRepository();
  await submitSurvey(repo, entrada());
  assert.deepEqual(repo.invitesMarked, [{ editionId: "ed1", email: "ana@example.test" }]);
});

test("un NPS fuera de 0..10 se rechaza", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(repo, entrada({ npsScore: 11 }));
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error, "INVALID_NPS");
  assert.equal(repo.responses.size, 0);
});

test("una nota fuera de 1..5 se rechaza", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(
    repo,
    entrada({
      scores: {
        scoreOrganization: 9,
        scorePrompts: null,
        scoreVenue: null,
        scoreKit: null,
        scoreAccreditation: null,
        scoreCommunication: null,
        scoreValueForMoney: null,
      },
    }),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error, "INVALID_SCORE");
});

test("una cita de más de 400 se rechaza", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(
    repo,
    entrada({ publicQuote: "a".repeat(401), publicationConsent: true }),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error, "QUOTE_TOO_LONG");
});

test("una crítica de más de 1000 se rechaza", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(repo, entrada({ improvementNotes: "a".repeat(1001) }));
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error, "NOTES_TOO_LONG");
});

test("consentir sin escribir nada se rechaza", async () => {
  const repo = new InMemoryTestimonialRepository();
  const r = await submitSurvey(
    repo,
    entrada({ publicQuote: "   ", publicationConsent: true }),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error, "CONSENT_WITHOUT_QUOTE");
});
