"use server";

import { Prisma, prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "../lib/auth";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";
import { normalizeSlug } from "../lib/fotorank/slug";
import { routes } from "../lib/routes";

export type ContestCategoryInput = {
  name: string;
  slug: string;
  description?: string;
  maxFiles: number;
  sortOrder: number;
};

export type CreateFotorankContestInput = {
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription?: string;
  coverImageUrl?: string;
  startAt?: string;
  submissionDeadline?: string;
  judgingStartAt?: string;
  judgingEndAt?: string;
  resultsAt?: string;
  status: "DRAFT" | "SETUP_IN_PROGRESS" | "READY_TO_PUBLISH" | "PUBLISHED" | "CLOSED" | "ARCHIVED" | "ACTIVE";
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  categories: ContestCategoryInput[];
};

export type UpdateFotorankContestInput = Partial<{
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  coverImageUrl: string;
  prizesSummary: string;
  sponsorsText: string;
  startAt: string;
  submissionDeadline: string;
  judgingStartAt: string;
  judgingEndAt: string;
  resultsAt: string;
  status: "DRAFT" | "SETUP_IN_PROGRESS" | "READY_TO_PUBLISH" | "PUBLISHED" | "CLOSED" | "ARCHIVED" | "ACTIVE";
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  categories: ContestCategoryInput[];
}>;

export type CreateFotorankContestResult =
  | { ok: true; contestId: string }
  | { ok: false; error: string };

export type UpdateFotorankContestResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireActiveOrganizationIdForContests(
  userId: number,
): Promise<{ ok: true; organizationId: string } | { ok: false; error: string }> {
  const r = await resolveActiveOrganizationForUser(userId);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, organizationId: r.org.id };
}

function parseDate(s: string | undefined): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function validateDateSequence(dates: {
  startAt?: Date | null;
  submissionDeadline?: Date | null;
  judgingStartAt?: Date | null;
  judgingEndAt?: Date | null;
  resultsAt?: Date | null;
}): string | null {
  const { startAt, submissionDeadline, judgingStartAt, judgingEndAt, resultsAt } = dates;
  const list = [
    { d: startAt, label: "Inicio" },
    { d: submissionDeadline, label: "Cierre de inscripciones" },
    { d: judgingStartAt, label: "Inicio de evaluación" },
    { d: judgingEndAt, label: "Fin de evaluación" },
    { d: resultsAt, label: "Publicación de resultados" },
  ].filter((x) => x.d);
  for (let i = 1; i < list.length; i++) {
    const prevItem = list[i - 1]!;
    const currItem = list[i]!;
    const prev = prevItem.d!.getTime();
    const curr = currItem.d!.getTime();
    if (curr < prev) {
      return `${currItem.label} debe ser posterior a ${prevItem.label}.`;
    }
  }
  return null;
}

function validateCategories(categories: ContestCategoryInput[]): string | null {
  if (!categories?.length) return null;
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]!;
    if (!c.name?.trim()) return `Categoría ${i + 1}: el nombre es obligatorio.`;
    if (!c.slug?.trim()) return `Categoría ${i + 1}: el slug es obligatorio.`;
    const catSlug = normalizeSlug(c.slug);
    if (!catSlug) return `Categoría ${i + 1}: slug no válido.`;
    if (c.maxFiles < 1) return `Categoría ${i + 1}: maxFiles debe ser al menos 1.`;
  }
  return null;
}

export async function createFotorankContest(
  input: CreateFotorankContestInput
): Promise<CreateFotorankContestResult> {
  const user = await requireAuth();

  const orgScope = await requireActiveOrganizationIdForContests(user.id);
  if (!orgScope.ok) return { ok: false, error: orgScope.error };

  const organizationId = orgScope.organizationId;

  const title = input.title?.trim();
  const slugRaw = input.slug?.trim();
  const shortDescription = input.shortDescription?.trim();

  if (!title) return { ok: false, error: "El título es obligatorio." };
  if (!slugRaw) return { ok: false, error: "El slug es obligatorio." };
  if (!shortDescription) return { ok: false, error: "La descripción breve es obligatoria." };

  const slug = normalizeSlug(slugRaw);
  if (!slug) return { ok: false, error: "El slug no es válido." };

  const existing = await prisma.fotorankContest.findUnique({
    where: { organizationId_slug: { organizationId, slug } },
  });
  if (existing) return { ok: false, error: "Ese slug ya está en uso en esta organización." };

  const validCats = input.categories?.filter((c) => c.name?.trim()) ?? [];
  const catError = validateCategories(validCats);
  if (catError) return { ok: false, error: catError };

  const startAt = parseDate(input.startAt);
  const submissionDeadline = parseDate(input.submissionDeadline);
  const judgingStartAt = parseDate(input.judgingStartAt);
  const judgingEndAt = parseDate(input.judgingEndAt);
  const resultsAt = parseDate(input.resultsAt);

  const dateError = validateDateSequence({
    startAt,
    submissionDeadline,
    judgingStartAt,
    judgingEndAt,
    resultsAt,
  });
  if (dateError) return { ok: false, error: dateError };

  const contest = await prisma.$transaction(async (tx) => {
    const c = await tx.fotorankContest.create({
      data: {
        organizationId,
        title,
        slug,
        shortDescription,
        fullDescription: input.fullDescription?.trim() || null,
        coverImageUrl: input.coverImageUrl?.trim() || null,
        status: input.status ?? "DRAFT",
        visibility: input.visibility ?? "PUBLIC",
        startAt,
        submissionDeadline,
        judgingStartAt,
        judgingEndAt,
        resultsAt,
        createdByUserId: user.id,
      },
    });

    for (let i = 0; i < validCats.length; i++) {
      const cat = validCats[i]!;
      const catSlug = normalizeSlug(cat.slug) || normalizeSlug(cat.name) || `cat-${i + 1}`;
      await tx.fotorankContestCategory.create({
        data: {
          contestId: c.id,
          name: cat.name.trim(),
          slug: catSlug,
          description: cat.description?.trim() || null,
          maxFiles: Math.max(1, cat.maxFiles),
          sortOrder: cat.sortOrder ?? i,
        },
      });
    }

    return c;
  });

  revalidatePath(routes.concursos.index());
  revalidatePath(routes.dashboard.concursos.detalle(contest.id));

  return { ok: true, contestId: contest.id };
}

export async function updateFotorankContest(
  contestId: string,
  input: UpdateFotorankContestInput
): Promise<UpdateFotorankContestResult> {
  const user = await requireAuth();

  const orgScope = await requireActiveOrganizationIdForContests(user.id);
  if (!orgScope.ok) return { ok: false, error: orgScope.error };

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId, organizationId: orgScope.organizationId },
  });
  if (!contest) return { ok: false, error: "Concurso no encontrado." };

  if (input.slug !== undefined) {
    const slug = normalizeSlug(input.slug.trim());
    if (!slug) return { ok: false, error: "El slug no es válido." };
    const existing = await prisma.fotorankContest.findFirst({
      where: {
        organizationId: contest.organizationId,
        slug,
        id: { not: contestId },
      },
    });
    if (existing) return { ok: false, error: "Ese slug ya está en uso." };
  }

  if (input.categories !== undefined) {
    const catError = validateCategories(input.categories.filter((c) => c.name?.trim()));
    if (catError) return { ok: false, error: catError };
  }

  const newDates = {
    startAt: input.startAt !== undefined ? parseDate(input.startAt) : contest.startAt,
    submissionDeadline: input.submissionDeadline !== undefined ? parseDate(input.submissionDeadline) : contest.submissionDeadline,
    judgingStartAt: input.judgingStartAt !== undefined ? parseDate(input.judgingStartAt) : contest.judgingStartAt,
    judgingEndAt: input.judgingEndAt !== undefined ? parseDate(input.judgingEndAt) : contest.judgingEndAt,
    resultsAt: input.resultsAt !== undefined ? parseDate(input.resultsAt) : contest.resultsAt,
  };
  const dateError = validateDateSequence(newDates);
  if (dateError) return { ok: false, error: dateError };

  await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.slug !== undefined) updateData.slug = normalizeSlug(input.slug.trim());
    if (input.shortDescription !== undefined) updateData.shortDescription = input.shortDescription.trim() || null;
    if (input.fullDescription !== undefined) updateData.fullDescription = input.fullDescription?.trim() || null;
    if (input.coverImageUrl !== undefined) updateData.coverImageUrl = input.coverImageUrl?.trim() || null;
    if (input.prizesSummary !== undefined) updateData.prizesSummary = input.prizesSummary?.trim() || null;
    if (input.sponsorsText !== undefined) updateData.sponsorsText = input.sponsorsText?.trim() || null;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.startAt !== undefined) updateData.startAt = newDates.startAt;
    if (input.submissionDeadline !== undefined) updateData.submissionDeadline = newDates.submissionDeadline;
    if (input.judgingStartAt !== undefined) updateData.judgingStartAt = newDates.judgingStartAt;
    if (input.judgingEndAt !== undefined) updateData.judgingEndAt = newDates.judgingEndAt;
    if (input.resultsAt !== undefined) updateData.resultsAt = newDates.resultsAt;

    if (Object.keys(updateData).length > 0) {
      await tx.fotorankContest.update({
        where: { id: contestId },
        data: updateData,
      });
    }

    if (input.categories !== undefined) {
      await tx.fotorankContestCategory.deleteMany({ where: { contestId } });
      const validCats = input.categories.filter((c) => c.name?.trim());
      for (let i = 0; i < validCats.length; i++) {
        const cat = validCats[i]!;
        const catSlug = normalizeSlug(cat.slug) || normalizeSlug(cat.name) || `cat-${i + 1}`;
        await tx.fotorankContestCategory.create({
          data: {
            contestId,
            name: cat.name.trim(),
            slug: catSlug,
            description: cat.description?.trim() || null,
            maxFiles: Math.max(1, cat.maxFiles),
            sortOrder: cat.sortOrder ?? i,
          },
        });
      }
    }
  });

  revalidatePath(routes.concursos.index());
  revalidatePath(routes.dashboard.concursos.detalle(contestId));

  const landingSlug =
    input.slug !== undefined ? normalizeSlug(input.slug.trim()) : contest.slug;
  revalidatePath(routes.concursos.publico(landingSlug));
  if (input.slug !== undefined && landingSlug !== contest.slug) {
    revalidatePath(routes.concursos.publico(contest.slug));
  }

  return { ok: true };
}

function displayStatusToDb(displayStatus: string): UpdateFotorankContestInput["status"] {
  if (displayStatus === "READY") return "READY_TO_PUBLISH";
  return displayStatus as UpdateFotorankContestInput["status"];
}

export async function updateContestStatus(
  contestId: string,
  newStatus: "DRAFT" | "READY" | "PUBLISHED" | "CLOSED" | "ARCHIVED"
): Promise<UpdateFotorankContestResult> {
  const statusForDb = displayStatusToDb(newStatus);
  return updateFotorankContest(contestId, { status: statusForDb });
}

export async function deleteFotorankContest(contestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAuth();
  const orgScope = await requireActiveOrganizationIdForContests(user.id);
  if (!orgScope.ok) return { ok: false, error: orgScope.error };
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId, organizationId: orgScope.organizationId },
  });
  if (!contest) return { ok: false, error: "Concurso no encontrado." };
  await prisma.fotorankContest.delete({ where: { id: contestId } });
  revalidatePath(routes.concursos.index());
  return { ok: true };
}

export type ContestForEdit = {
  id: string;
  title: string;
  shortDescription: string | null;
  fullDescription: string | null;
  status: string;
};

export async function getContestForEdit(contestId: string): Promise<ContestForEdit | null> {
  const user = await requireAuth();
  const orgScope = await requireActiveOrganizationIdForContests(user.id);
  if (!orgScope.ok) return null;

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId, organizationId: orgScope.organizationId },
    select: { id: true, title: true, shortDescription: true, fullDescription: true, status: true },
  });

  if (!contest) return null;

  return {
    id: contest.id,
    title: contest.title,
    shortDescription: contest.shortDescription,
    fullDescription: contest.fullDescription,
    status:
      contest.status === "ACTIVE"
        ? "PUBLISHED"
        : contest.status === "SETUP_IN_PROGRESS"
          ? "DRAFT"
          : contest.status,
  };
}

export async function updateContestFromForm(formData: FormData): Promise<UpdateFotorankContestResult> {
  const contestId = formData.get("contestId")?.toString();
  if (!contestId) return { ok: false, error: "ID de concurso no válido." };
  const title = formData.get("title")?.toString()?.trim();
  const shortDescription = formData.get("shortDescription")?.toString()?.trim() ?? "";
  const fullDescription = formData.get("fullDescription")?.toString()?.trim() ?? "";
  const prizesSummary = (formData.get("prizesSummary")?.toString() ?? "").trim();
  const sponsorsText = (formData.get("sponsorsText")?.toString() ?? "").trim();
  const status = formData.get("status")?.toString() as UpdateFotorankContestInput["status"];
  if (!title) return { ok: false, error: "El título es obligatorio." };
  const validStatuses = ["DRAFT", "SETUP_IN_PROGRESS", "READY_TO_PUBLISH", "PUBLISHED", "CLOSED", "ARCHIVED", "ACTIVE"];
  if (status && !validStatuses.includes(status)) return { ok: false, error: "Estado no válido." };
  const result = await updateFotorankContest(contestId, {
    title,
    shortDescription: shortDescription || undefined,
    fullDescription: fullDescription || undefined,
    prizesSummary,
    sponsorsText,
    status: status || undefined,
  });
  if (result.ok) redirect(routes.dashboard.concursos.detalle(contestId));
  return result;
}

export async function updateContestFromFormModal(formData: FormData): Promise<UpdateFotorankContestResult> {
  const contestId = formData.get("contestId")?.toString();
  if (!contestId) return { ok: false, error: "ID de concurso no válido." };
  const title = formData.get("title")?.toString()?.trim();
  const shortDescription = formData.get("shortDescription")?.toString()?.trim() ?? "";
  const fullDescription = formData.get("fullDescription")?.toString()?.trim() ?? "";
  let statusRaw = formData.get("status")?.toString();
  if (!title) return { ok: false, error: "El título es obligatorio." };
  const validStatuses = ["DRAFT", "SETUP_IN_PROGRESS", "READY_TO_PUBLISH", "READY", "PUBLISHED", "CLOSED", "ARCHIVED", "ACTIVE"];
  if (statusRaw && !validStatuses.includes(statusRaw)) return { ok: false, error: "Estado no válido." };
  const statusForDb = (statusRaw === "READY" ? "READY_TO_PUBLISH" : statusRaw) as UpdateFotorankContestInput["status"] | undefined;
  const result = await updateFotorankContest(contestId, {
    title,
    shortDescription: shortDescription || undefined,
    fullDescription: fullDescription || undefined,
    status: statusForDb || undefined,
  });
  revalidatePath(routes.concursos.index());
  revalidatePath(routes.dashboard.concursos.detalle(contestId));
  return result;
}

export async function editContestFormAction(_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> {
  const result = await updateContestFromForm(formData);
  if (result.ok) return null;
  return { error: result.error };
}

export async function editContestFormActionForModal(_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> {
  const result = await updateContestFromFormModal(formData);
  if (result.ok) return null;
  return { error: result.error };
}

export async function updateContestDatesFromModal(formData: FormData): Promise<UpdateFotorankContestResult> {
  const contestId = formData.get("contestId")?.toString();
  if (!contestId) return { ok: false, error: "ID de concurso no válido." };

  const startAt = formData.get("startAt")?.toString()?.trim() || undefined;
  const submissionDeadline = formData.get("submissionDeadline")?.toString()?.trim() || undefined;
  const judgingStartAt = formData.get("judgingStartAt")?.toString()?.trim() || undefined;
  const judgingEndAt = formData.get("judgingEndAt")?.toString()?.trim() || undefined;
  const resultsAt = formData.get("resultsAt")?.toString()?.trim() || undefined;

  const result = await updateFotorankContest(contestId, {
    startAt,
    submissionDeadline,
    judgingStartAt,
    judgingEndAt,
    resultsAt,
  });
  if (result.ok) {
    revalidatePath(routes.concursos.index());
    revalidatePath(routes.dashboard.concursos.detalle(contestId));
  }
  return result;
}


export async function updateContestCategoriesFromModal(formData: FormData): Promise<UpdateFotorankContestResult> {
  const contestId = formData.get("contestId")?.toString();
  if (!contestId) return { ok: false, error: "ID de concurso no válido." };

  const raw = formData.get("categories")?.toString() ?? "[]";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Formato de categorías inválido." };
  }

  if (!Array.isArray(parsed)) return { ok: false, error: "Formato de categorías inválido." };

  const categories: ContestCategoryInput[] = parsed.map((item, i) => {
    const obj = (item ?? {}) as Record<string, unknown>;
    const name = String(obj.name ?? "").trim();
    const slugRaw = String(obj.slug ?? "").trim();
    const slug = normalizeSlug(slugRaw || name);
    const description = String(obj.description ?? "").trim();
    const maxFilesRaw = Number(obj.maxFiles ?? 1);

    return {
      name,
      slug: slug || `categoria-${i + 1}`,
      description: description || undefined,
      maxFiles: Number.isFinite(maxFilesRaw) ? Math.max(1, Math.floor(maxFilesRaw)) : 1,
      sortOrder: i,
    };
  });

  const nonEmpty = categories.filter((c) => c.name.trim() !== "");
  const result = await updateFotorankContest(contestId, { categories: nonEmpty });
  if (result.ok) {
    revalidatePath(routes.concursos.index());
    revalidatePath(routes.dashboard.concursos.detalle(contestId));
  }
  return result;
}
export async function updateContestRules(
  contestId: string,
  rulesText: string,
  rulesData?: Record<string, unknown>
): Promise<UpdateFotorankContestResult> {
  const user = await requireAuth();

  const orgScope = await requireActiveOrganizationIdForContests(user.id);
  if (!orgScope.ok) return { ok: false, error: orgScope.error };

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId, organizationId: orgScope.organizationId },
  });
  if (!contest) return { ok: false, error: "Concurso no encontrado." };

  await prisma.fotorankContest.update({
    where: { id: contestId },
    data: {
      rulesText: rulesText?.trim() || null,
      rulesData: (rulesData ?? Prisma.DbNull) as Prisma.InputJsonValue,
    },
  });

  revalidatePath(routes.dashboard.concursos.detalle(contestId));

  return { ok: true };
}
