import "server-only";

/**
 * La bandeja del panel: todas las respuestas, con su testimonio si lo hay.
 *
 * Acá sí se lee la crítica privada — es el único lugar donde se muestra, y
 * detrás del guard de administrador.
 */
import { prisma } from "@repo/db";
import type {
  ClickatonTestimonialAuthorRole,
  ClickatonTestimonialStatus,
} from "../domain/types";

export type ResponseFilter = {
  editionId?: string;
  authorRole?: ClickatonTestimonialAuthorRole;
  /** `SURVEY_ONLY` = contestó la encuesta y no dejó testimonio publicable. */
  state?: ClickatonTestimonialStatus | "SURVEY_ONLY" | "NO_CONSENT";
  search?: string;
};

export type ResponseRow = {
  id: string;
  editionName: string;
  authorRole: ClickatonTestimonialAuthorRole;
  authorName: string;
  npsScore: number;
  submittedAt: Date;
  hasImprovementNotes: boolean;
  testimonial: {
    id: string;
    status: ClickatonTestimonialStatus;
    publicationConsent: boolean;
    excerpt: string;
  } | null;
};

function stateWhere(state: ResponseFilter["state"]) {
  switch (state) {
    case undefined:
      return {};
    case "SURVEY_ONLY":
      return { testimonial: { is: null } };
    case "NO_CONSENT":
      return { testimonial: { is: { publicationConsent: false } } };
    default:
      return { testimonial: { is: { status: state, publicationConsent: true } } };
  }
}

export async function listSurveyResponses(
  filter: ResponseFilter = {},
): Promise<ResponseRow[]> {
  const search = filter.search?.trim();

  const rows = await prisma.clickatonSurveyResponse.findMany({
    where: {
      ...(filter.editionId ? { editionId: filter.editionId } : {}),
      ...(filter.authorRole ? { authorRole: filter.authorRole } : {}),
      ...stateWhere(filter.state),
      ...(search
        ? {
            OR: [
              { testimonial: { is: { authorName: { contains: search, mode: "insensitive" } } } },
              { testimonial: { is: { quote: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      userId: true,
      authorRole: true,
      npsScore: true,
      submittedAt: true,
      improvementNotes: true,
      edition: { select: { name: true } },
      testimonial: {
        select: {
          id: true,
          status: true,
          publicationConsent: true,
          quote: true,
          highlightedExcerpt: true,
          authorName: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 200,
  });

  // Quien no autorizó la publicación no tiene nombre guardado en el testimonio,
  // pero el panel igual necesita saber de quién es cada respuesta.
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, name: true, email: true },
  });
  const nameByUserId = new Map(
    users.map((u) => [u.id, u.name?.trim() || u.email] as const),
  );

  return rows.map((row) => ({
    id: row.id,
    editionName: row.edition.name,
    authorRole: row.authorRole,
    authorName:
      row.testimonial?.authorName ?? nameByUserId.get(row.userId) ?? "—",
    npsScore: row.npsScore,
    submittedAt: row.submittedAt,
    hasImprovementNotes: Boolean(row.improvementNotes?.trim()),
    testimonial: row.testimonial
      ? {
          id: row.testimonial.id,
          status: row.testimonial.status,
          publicationConsent: row.testimonial.publicationConsent,
          excerpt:
            row.testimonial.highlightedExcerpt?.trim() || row.testimonial.quote,
        }
      : null,
  }));
}

export async function loadResponseDetail(responseId: string) {
  return prisma.clickatonSurveyResponse.findUnique({
    where: { id: responseId },
    include: {
      edition: { select: { name: true, slug: true } },
      testimonial: true,
    },
  });
}
