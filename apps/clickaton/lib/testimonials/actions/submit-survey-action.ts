"use server";

import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import {
  SUBMIT_SURVEY_ERROR_COPY,
  submitSurvey,
  type SubmitSurveyInput,
} from "../application/submit-survey";
import { resolveEligibility } from "../domain/eligibility";
import type { SurveyScores } from "../domain/repository";
import {
  SURVEY_ASPECT_FIELDS,
  type WouldReturnValue,
} from "../domain/survey-definition";
import { loadEligibilityFacts } from "../infrastructure/prisma-eligibility";
import { testimonialRepository } from "../infrastructure/prisma-testimonial-repository";

export type TestimonialFormState = {
  ok: boolean;
  message?: string;
  /** Para que la pantalla sepa si quedó pendiente de moderación. */
  published?: boolean;
};

function readText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function readScore(formData: FormData, key: string): number | null {
  const raw = readText(formData, key);
  if (raw === null || raw === "" || raw === "NA") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function readWouldReturn(formData: FormData): WouldReturnValue | null {
  const raw = readText(formData, "wouldReturn");
  return raw === "YES" || raw === "MAYBE" || raw === "NO" ? raw : null;
}

export async function submitTestimonialSurveyAction(
  _prev: TestimonialFormState | undefined,
  formData: FormData,
): Promise<TestimonialFormState> {
  const slug = readText(formData, "editionSlug")?.trim();
  if (!slug) return { ok: false, message: "Falta la edición." };

  // La sesión se vuelve a leer del servidor: nada de lo que venga en el
  // formulario decide quién es quien responde.
  const user = await getClickatonAuthUser();
  if (!user) {
    return {
      ok: false,
      message: "Tu sesión venció. Volvé a entrar y mandá de nuevo tu respuesta.",
    };
  }

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug },
    select: { id: true, testimonialsEnabled: true, fotorankContestId: true },
  });
  if (!edition || !edition.testimonialsEnabled) {
    return { ok: false, message: "La encuesta de esta edición no está abierta." };
  }

  const facts = await loadEligibilityFacts({
    userId: user.id,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    editionId: edition.id,
    fotorankContestId: edition.fotorankContestId,
  });
  const eligibility = resolveEligibility(facts);
  if (!eligibility.eligible) {
    return {
      ok: false,
      message: "No pudimos verificar tu participación en esta edición.",
    };
  }

  const npsRaw = readText(formData, "npsScore");
  const npsScore = npsRaw === null ? Number.NaN : Number.parseInt(npsRaw, 10);

  const scores = Object.fromEntries(
    SURVEY_ASPECT_FIELDS.map((field) => [field, readScore(formData, field)]),
  ) as SurveyScores;

  const headerStore = await headers();

  const input: SubmitSurveyInput = {
    editionId: edition.id,
    userId: user.id,
    email: user.email,
    eligibility,
    npsScore,
    scores,
    wouldReturn: readWouldReturn(formData),
    improvementNotes: readText(formData, "improvementNotes"),
    publicQuote: readText(formData, "publicQuote"),
    authorLinkRaw: readText(formData, "authorLinkUrl"),
    publicationConsent: formData.get("publicationConsent") === "on",
    audit: {
      ip:
        headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        headerStore.get("x-real-ip"),
      userAgent: headerStore.get("user-agent"),
    },
  };

  const result = await submitSurvey(testimonialRepository, input);

  if (!result.ok) {
    return { ok: false, message: SUBMIT_SURVEY_ERROR_COPY[result.error] };
  }

  revalidatePath(`/maratones/${slug}/testimonio`);

  return {
    ok: true,
    published: result.testimonialId !== null,
    message:
      result.testimonialId !== null
        ? "¡Gracias! Guardamos tu respuesta. Tu testimonio queda para revisión antes de publicarse."
        : "¡Gracias! Guardamos tu respuesta.",
  };
}
