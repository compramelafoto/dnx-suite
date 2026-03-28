"use server";

import { createHash, randomBytes } from "node:crypto";
import { Prisma, prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "../lib/auth";
import {
  requireJudgeAuth,
  createJudgeSessionForJudge,
  destroyCurrentJudgeSession,
  revokeAllJudgeSessionsForJudge,
} from "../lib/judge-auth";
import type { UserOrganization } from "../lib/fotorank/organizations";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";
import { hashPassword, verifyPassword } from "../lib/security/password";
import { routes } from "../lib/routes";
import {
  eligibilityForLoadedAssignment,
  gateJudgeEvaluationForJudge,
} from "../lib/fotorank/judgeEvaluationGate";
import { rawVoteInputFromFormData, validateVotePayloadForMethod } from "../lib/fotorank/judgeVotePayload";
import {
  filterFotorankEntriesEvaluableForJudging,
  isEvaluableFotorankContestEntry,
} from "../lib/fotorank/fotorankContestEntryDomain";
import { validateMethodConfig } from "../lib/fotorank/judges/contracts";
import { DEFAULT_CRITERIA_BASED_METHOD_CONFIG } from "../lib/fotorank/judges/criteriaBased";
import {
  extensionForJudgeAvatarMime,
  isManagedJudgeAvatarPublicUrl,
  JUDGE_AVATAR_ALLOWED_MIME,
  JUDGE_AVATAR_MAX_BYTES,
  normalizeJudgeInstagram,
  normalizeJudgeWebsite,
  normalizeStoredJudgeAvatarRef,
} from "../lib/fotorank/judges/judgeAvatar";
import {
  emptyJudgeBioDocument,
  emptyJudgeOtherLinksDocument,
  parseAndValidateJudgeBioDocument,
  parseAndValidateJudgeOtherLinks,
} from "../lib/fotorank/judges/judgeBioRich";
import { getJudgeAvatarStorage } from "../lib/fotorank/judges/judgeAvatarStorage";
import {
  buildJudgeInvitationRegistrationUrl,
  logInvitationBaseUrlMisconfigurationIfNeeded,
} from "../lib/fotorank/judges/invitationLinks";

export type JudgeMethodType =
  | "SCORE_1_5"
  | "SCORE_1_10"
  | "SCORE_0_100"
  | "YES_NO"
  | "FAVORITES_SELECTION"
  | "SELECTION_WITH_QUOTA"
  | "CRITERIA_BASED";

export type JudgeActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function buildPublicSlug(firstName: string, lastName: string) {
  return `${firstName}-${lastName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `jurado-${randomBytes(4).toString("hex")}`;
}

type OrganizationScope =
  | { ok: false; error: string }
  | { ok: true; user: Awaited<ReturnType<typeof requireAuth>>; org: UserOrganization };


async function resolveWorkspaceIdForUser(userId: number): Promise<string | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    select: { workspaceId: true },
    orderBy: { id: "asc" },
  });
  return membership?.workspaceId ?? null;
}


/**
 * Workspace de la suite (ComprameLaFoto) vinculado al contexto de la organización del concurso.
 * No usa quién envió la invitación: recorre miembros ACTIVE de la org (por antigüedad) hasta
 * encontrar un usuario con Membership en algún Workspace.
 */
async function resolveWorkspaceIdForContestOrganization(organizationId: string): Promise<string | null> {
  const members = await prisma.contestOrganizationMember.findMany({
    where: { organizationId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  for (const { userId } of members) {
    const membership = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { id: "asc" },
      select: { workspaceId: true },
    });
    if (membership?.workspaceId) return membership.workspaceId;
  }
  return null;
}

async function requireOrganizationScope(): Promise<OrganizationScope> {
  const user = await requireAuth();
  const resolved = await resolveActiveOrganizationForUser(user.id);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  return { ok: true, user, org: resolved.org };
}


export async function uploadJudgeAvatarImage(formData: FormData): Promise<JudgeActionResult<{ url: string }>> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  const file = formData.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  const f = file as File;
  const mime = f.type || "";
  if (!JUDGE_AVATAR_ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "Formato no permitido. Usá JPEG, PNG o WebP." };
  }
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length > JUDGE_AVATAR_MAX_BYTES) {
    return { ok: false, error: "El archivo supera el tamaño máximo (2 MB)." };
  }
  const ext = extensionForJudgeAvatarMime(mime);
  if (!ext) return { ok: false, error: "Tipo de imagen no soportado." };

  const storage = getJudgeAvatarStorage();
  const { publicUrl } = await storage.save(buf, ext as "jpg" | "png" | "webp");
  return { ok: true, data: { url: publicUrl } };
}


export async function listJudgesForOrg(): Promise<JudgeActionResult<Array<Record<string, unknown>>>> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  /**
   * No incluir `category` en el include anidado: si `FotorankJudgeAssignment.categoryId` apunta a una
   * fila inexistente (integridad rota, migración manual, etc.), Prisma lanza
   * "Field category is required to return data, got null instead." Resolvimos nombres aparte para tolerar huérfanos.
   */
  const memberships = await prisma.fotorankJudgeOrganizationMembership.findMany({
    where: { organizationId: scope.org.id },
    include: {
      judgeAccount: {
        include: {
          profile: true,
          assignments: {
            where: { organizationId: scope.org.id },
            select: {
              id: true,
              categoryId: true,
              contest: { select: { title: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const allCategoryIds = [
    ...new Set(memberships.flatMap((m) => m.judgeAccount.assignments.map((a) => a.categoryId))),
  ];
  const categoryRows =
    allCategoryIds.length > 0
      ? await prisma.fotorankContestCategory.findMany({
          where: { id: { in: allCategoryIds } },
          select: { id: true, name: true },
        })
      : [];
  const categoryNameById = new Map(categoryRows.map((c) => [c.id, c.name]));

  const orphanAssignments: { assignmentId: string; categoryId: string }[] = [];
  for (const m of memberships) {
    for (const a of m.judgeAccount.assignments) {
      if (!categoryNameById.has(a.categoryId)) {
        orphanAssignments.push({ assignmentId: a.id, categoryId: a.categoryId });
      }
    }
  }
  if (orphanAssignments.length > 0) {
    console.warn(
      "[listJudgesForOrg] Datos inconsistentes: FotorankJudgeAssignment con categoryId sin FotorankContestCategory. Corregir o eliminar esas filas (p. ej. SQL o script).",
      { organizationId: scope.org.id, orphanAssignments },
    );
  }

  return {
    ok: true,
    data: memberships.map((m) => ({
      membershipId: m.id,
      judgeId: m.judgeAccount.id,
      email: m.judgeAccount.email,
      accountStatus: m.judgeAccount.accountStatus,
      membershipStatus: m.membershipStatus,
      lastLoginAt: m.judgeAccount.lastLoginAt,
      profile: m.judgeAccount.profile,
      assignmentsCount: m.judgeAccount.assignments.length,
      activeContests: [...new Set(m.judgeAccount.assignments.map((a) => a.contest.title))],
      categories: m.judgeAccount.assignments.map((a) =>
        categoryNameById.get(a.categoryId) ??
          `(categoría ausente · assignment ${a.id} · categoryId ${a.categoryId})`,
      ),
    })),
  };
}

export async function createJudgeAccount(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  shortBio?: string;
  fullBioRichJson?: unknown;
  city?: string;
  country?: string;
  website?: string;
  instagram?: string;
  otherLinksJson?: unknown;
  isPublic?: boolean;
}): Promise<JudgeActionResult<{ judgeId: string }>> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  if (!input.email?.trim()) return { ok: false, error: "Email obligatorio." };
  if (!input.password || input.password.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  if (!input.firstName?.trim() || !input.lastName?.trim()) return { ok: false, error: "Nombre y apellido son obligatorios." };

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.fotorankJudgeAccount.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "Ya existe un jurado con ese email." };

  const avatarRef = normalizeStoredJudgeAvatarRef(input.avatarUrl);
  if (input.avatarUrl?.trim() && !avatarRef) {
    return { ok: false, error: "La URL o ruta del avatar no es válida." };
  }

  const bioDoc = parseAndValidateJudgeBioDocument(input.fullBioRichJson ?? emptyJudgeBioDocument());
  if (!bioDoc.ok) return { ok: false, error: bioDoc.error };

  const otherLinks = parseAndValidateJudgeOtherLinks(input.otherLinksJson ?? emptyJudgeOtherLinksDocument());
  if (!otherLinks.ok) return { ok: false, error: otherLinks.error };

  const websiteNorm = normalizeJudgeWebsite(input.website);
  if (input.website?.trim() && !websiteNorm) {
    return { ok: false, error: "El sitio web no es una URL válida." };
  }

  const instagramNorm = normalizeJudgeInstagram(input.instagram);
  if (input.instagram?.trim() && !instagramNorm) {
    return { ok: false, error: "Instagram: valor no válido (sin caracteres < o >, máx. 120)." };
  }

  const baseSlug = buildPublicSlug(input.firstName, input.lastName);
  let publicSlug = baseSlug;
  let idx = 1;
  while (await prisma.fotorankJudgeProfile.findUnique({ where: { publicSlug } })) {
    idx += 1;
    publicSlug = `${baseSlug}-${idx}`;
  }

  const judge = await prisma.fotorankJudgeAccount.create({
    data: {
      workspaceId: (await resolveWorkspaceIdForUser(scope.user.id)) ?? (() => { throw new Error("No workspace linked to current admin user."); })(),
      email,
      passwordHash: hashPassword(input.password),
      accountStatus: "ACTIVE",
      profile: {
        create: {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone: input.phone?.trim() || null,
          avatarUrl: avatarRef,
          shortBio: input.shortBio?.trim() || null,
          fullBioRichJson: bioDoc.doc as never,
          city: input.city?.trim() || null,
          country: input.country?.trim() || null,
          website: websiteNorm,
          instagram: instagramNorm,
          otherLinksJson: otherLinks.doc as never,
          publicSlug,
          isPublic: input.isPublic ?? true,
        },
      },
      organizationMemberships: {
        create: {
          organizationId: scope.org.id,
          membershipStatus: "ACTIVE",
        },
      },
    },
  });

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: scope.org.id,
      actorType: "ADMIN",
      actorUserId: scope.user.id,
      eventType: "JUDGE_CREATED",
      entityType: "FotorankJudgeAccount",
      entityId: judge.id,
      payloadJson: { email },
    },
  });

  revalidatePath("/jurados");
  return { ok: true, data: { judgeId: judge.id } };
}

export async function updateJudgeProfileByAdmin(judgeId: string, input: {
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  shortBio?: string;
  fullBioRichJson?: unknown;
  city?: string;
  country?: string;
  website?: string;
  instagram?: string;
  otherLinksJson?: unknown;
  isPublic?: boolean;
  accountStatus?: "INVITED" | "PENDING_REGISTRATION" | "ACTIVE" | "SUSPENDED" | "DISABLED";
}): Promise<JudgeActionResult> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  const membership = await prisma.fotorankJudgeOrganizationMembership.findFirst({
    where: { judgeAccountId: judgeId, organizationId: scope.org.id },
    include: { judgeAccount: { include: { profile: true } } },
  });
  if (!membership) return { ok: false, error: "Jurado no encontrado en esta organización." };

  const previousAvatarUrl = membership.judgeAccount.profile?.avatarUrl ?? null;

  const avatarRef = normalizeStoredJudgeAvatarRef(input.avatarUrl);
  if (input.avatarUrl?.trim() && !avatarRef) {
    return { ok: false, error: "La URL o ruta del avatar no es válida." };
  }

  const bioDoc = parseAndValidateJudgeBioDocument(input.fullBioRichJson ?? emptyJudgeBioDocument());
  if (!bioDoc.ok) return { ok: false, error: bioDoc.error };

  const otherLinks = parseAndValidateJudgeOtherLinks(input.otherLinksJson ?? emptyJudgeOtherLinksDocument());
  if (!otherLinks.ok) return { ok: false, error: otherLinks.error };

  const websiteNorm = normalizeJudgeWebsite(input.website);
  if (input.website?.trim() && !websiteNorm) {
    return { ok: false, error: "El sitio web no es una URL válida." };
  }

  const instagramNorm = normalizeJudgeInstagram(input.instagram);
  if (input.instagram?.trim() && !instagramNorm) {
    return { ok: false, error: "Instagram: valor no válido (sin caracteres < o >, máx. 120)." };
  }

  await prisma.fotorankJudgeAccount.update({
    where: { id: judgeId },
    data: {
      accountStatus: input.accountStatus,
      profile: {
        upsert: {
          create: {
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            phone: input.phone?.trim() || null,
            avatarUrl: avatarRef,
            shortBio: input.shortBio?.trim() || null,
            fullBioRichJson: bioDoc.doc as never,
            city: input.city?.trim() || null,
            country: input.country?.trim() || null,
            website: websiteNorm,
            instagram: instagramNorm,
            otherLinksJson: otherLinks.doc as never,
            publicSlug: buildPublicSlug(input.firstName, input.lastName),
            isPublic: input.isPublic ?? true,
          },
          update: {
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            phone: input.phone?.trim() || null,
            avatarUrl: avatarRef,
            shortBio: input.shortBio?.trim() || null,
            fullBioRichJson: bioDoc.doc as never,
            city: input.city?.trim() || null,
            country: input.country?.trim() || null,
            website: websiteNorm,
            instagram: instagramNorm,
            otherLinksJson: otherLinks.doc as never,
            isPublic: input.isPublic ?? true,
          },
        },
      },
    },
  });

  if (
    previousAvatarUrl &&
    previousAvatarUrl !== avatarRef &&
    isManagedJudgeAvatarPublicUrl(previousAvatarUrl)
  ) {
    await getJudgeAvatarStorage().deleteIfManagedPublicUrl(previousAvatarUrl);
  }

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: scope.org.id,
      actorType: "ADMIN",
      actorUserId: scope.user.id,
      eventType: "JUDGE_UPDATED",
      entityType: "FotorankJudgeAccount",
      entityId: judgeId,
      payloadJson: { profileUpdated: true },
    },
  });

  if (input.accountStatus !== undefined && input.accountStatus !== "ACTIVE") {
    await revokeAllJudgeSessionsForJudge(judgeId);
  }

  const pub = await prisma.fotorankJudgeProfile.findUnique({
    where: { judgeAccountId: judgeId },
    select: { publicSlug: true },
  });
  if (pub?.publicSlug) {
    revalidatePath(`/jurados/publico/${pub.publicSlug}`);
  }

  revalidatePath("/jurados");
  revalidatePath(`/jurados/${judgeId}/editar`);
  return { ok: true };
}

export async function createJudgeAssignment(input: {
  judgeAccountId: string;
  contestId: string;
  categoryId: string;
  assignmentType: "PRIMARY" | "BACKUP";
  evaluationStartsAt?: string;
  evaluationEndsAt?: string;
  methodType: JudgeMethodType;
  methodConfigJson: unknown;
  allowVoteEdit?: boolean;
  commentsVisibleToParticipants?: boolean;
  sendInvitationNow?: boolean;
}): Promise<JudgeActionResult<{ assignmentId: string }>> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  let methodConfigJson: unknown = input.methodConfigJson ?? {};
  if (input.methodType === "CRITERIA_BASED") {
    const raw = methodConfigJson;
    const criteria =
      raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as { criteria?: unknown }).criteria)
        ? (raw as { criteria: unknown[] }).criteria
        : [];
    if (criteria.length === 0) {
      methodConfigJson = DEFAULT_CRITERIA_BASED_METHOD_CONFIG;
    }
  }

  const methodConfigCheck = validateMethodConfig(input.methodType, methodConfigJson);
  if (!methodConfigCheck.valid) {
    return { ok: false, error: methodConfigCheck.error };
  }

  const contestId = input.contestId.trim();
  const categoryId = input.categoryId.trim();
  if (!contestId) {
    return { ok: false, error: "Seleccioná un concurso." };
  }
  if (!categoryId) {
    return { ok: false, error: "Seleccioná una categoría." };
  }

  const contest = await prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId: scope.org.id },
    select: { id: true },
  });
  if (!contest) {
    return { ok: false, error: "Concurso no encontrado en tu organización." };
  }

  const category = await prisma.fotorankContestCategory.findFirst({
    where: { id: categoryId, contestId: contest.id },
    select: { id: true },
  });
  if (!category) {
    return { ok: false, error: "La categoría no pertenece al concurso seleccionado." };
  }

  const assignment = await prisma.fotorankJudgeAssignment.create({
    data: {
      judgeAccountId: input.judgeAccountId,
      organizationId: scope.org.id,
      contestId,
      categoryId,
      assignmentType: input.assignmentType,
      assignmentStatus: input.sendInvitationNow ? "INVITATION_SENT" : "ASSIGNED",
      evaluationStartsAt: input.evaluationStartsAt ? new Date(input.evaluationStartsAt) : null,
      evaluationEndsAt: input.evaluationEndsAt ? new Date(input.evaluationEndsAt) : null,
      methodType: input.methodType,
      methodConfigJson: methodConfigJson as never,
      allowVoteEdit: input.allowVoteEdit ?? true,
      commentsVisibleToParticipants: input.commentsVisibleToParticipants ?? false,
      createdByUserId: scope.user.id,
    },
  });

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: scope.org.id,
      contestId,
      actorType: "ADMIN",
      actorUserId: scope.user.id,
      eventType: "JUDGE_ASSIGNMENT_CREATED",
      entityType: "FotorankJudgeAssignment",
      entityId: assignment.id,
      payloadJson: { categoryId, assignmentType: input.assignmentType },
    },
  });

  revalidatePath("/jurados/asignaciones");
  revalidatePath(routes.dashboard.concursos.detalle(contestId));
  return { ok: true, data: { assignmentId: assignment.id } };
}

export type CreateJudgeAssignmentsBatchInput = {
  judgeAccountId: string;
  contestId: string;
  /** Si true, se toman todas las categorías del concurso al guardar (estado actual en BD). */
  allCategories: boolean;
  /** Ignorado si `allCategories`; si no, al menos una id válida del concurso. */
  categoryIds: string[];
  assignmentType: "PRIMARY" | "BACKUP";
  evaluationStartsAt?: string;
  evaluationEndsAt?: string;
  methodType: JudgeMethodType;
  methodConfigJson: unknown;
  allowVoteEdit?: boolean;
  commentsVisibleToParticipants?: boolean;
  sendInvitationNow?: boolean;
};

/**
 * Crea una fila `FotorankJudgeAssignment` por categoría (misma config). Omite duplicados
 * (mismo jurado + concurso + categoría ya existente). Auditoría: un evento por asignación creada.
 */
export async function createJudgeAssignmentsBatch(
  input: CreateJudgeAssignmentsBatchInput,
): Promise<JudgeActionResult<{ created: number; skippedExisting: number }>> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  const judgeAccountId = input.judgeAccountId.trim();
  if (!judgeAccountId) {
    return { ok: false, error: "Seleccioná un jurado." };
  }

  let methodConfigJson: unknown = input.methodConfigJson ?? {};
  if (input.methodType === "CRITERIA_BASED") {
    const raw = methodConfigJson;
    const criteria =
      raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as { criteria?: unknown }).criteria)
        ? (raw as { criteria: unknown[] }).criteria
        : [];
    if (criteria.length === 0) {
      methodConfigJson = DEFAULT_CRITERIA_BASED_METHOD_CONFIG;
    }
  }

  const methodConfigCheck = validateMethodConfig(input.methodType, methodConfigJson);
  if (!methodConfigCheck.valid) {
    return { ok: false, error: methodConfigCheck.error };
  }

  const contestId = input.contestId.trim();
  if (!contestId) {
    return { ok: false, error: "Seleccioná un concurso." };
  }

  const contest = await prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId: scope.org.id },
    select: { id: true },
  });
  if (!contest) {
    return { ok: false, error: "Concurso no encontrado en tu organización." };
  }

  let categoryIdsToAssign: string[];
  if (input.allCategories) {
    const rows = await prisma.fotorankContestCategory.findMany({
      where: { contestId: contest.id },
      select: { id: true },
      orderBy: { sortOrder: "asc" },
    });
    categoryIdsToAssign = rows.map((r) => r.id);
  } else {
    categoryIdsToAssign = [...new Set(input.categoryIds.map((id) => id.trim()).filter(Boolean))];
  }

  if (categoryIdsToAssign.length === 0) {
    return {
      ok: false,
      error: input.allCategories
        ? "Este concurso no tiene categorías."
        : "Seleccioná al menos una categoría o marcá «Todas las categorías».",
    };
  }

  const validCategories = await prisma.fotorankContestCategory.findMany({
    where: { contestId: contest.id, id: { in: categoryIdsToAssign } },
    select: { id: true },
  });
  const validSet = new Set(validCategories.map((c) => c.id));
  const invalid = categoryIdsToAssign.filter((id) => !validSet.has(id));
  if (invalid.length > 0) {
    return { ok: false, error: "Una o más categorías no pertenecen al concurso seleccionado." };
  }

  const existing = await prisma.fotorankJudgeAssignment.findMany({
    where: {
      judgeAccountId,
      contestId: contest.id,
      categoryId: { in: categoryIdsToAssign },
    },
    select: { categoryId: true },
  });
  const existingSet = new Set(existing.map((e) => e.categoryId));
  const toCreate = categoryIdsToAssign.filter((id) => !existingSet.has(id));
  const skippedExisting = categoryIdsToAssign.length - toCreate.length;

  if (toCreate.length === 0) {
    revalidatePath("/jurados/asignaciones");
    revalidatePath(routes.dashboard.concursos.detalle(contestId));
    return {
      ok: true,
      data: { created: 0, skippedExisting },
    };
  }

  const evalStart = input.evaluationStartsAt ? new Date(input.evaluationStartsAt) : null;
  const evalEnd = input.evaluationEndsAt ? new Date(input.evaluationEndsAt) : null;
  const assignmentStatus = input.sendInvitationNow ? "INVITATION_SENT" : "ASSIGNED";

  await prisma.$transaction(async (tx) => {
    for (const categoryId of toCreate) {
      const assignment = await tx.fotorankJudgeAssignment.create({
        data: {
          judgeAccountId,
          organizationId: scope.org.id,
          contestId: contest.id,
          categoryId,
          assignmentType: input.assignmentType,
          assignmentStatus,
          evaluationStartsAt: evalStart,
          evaluationEndsAt: evalEnd,
          methodType: input.methodType,
          methodConfigJson: methodConfigJson as never,
          allowVoteEdit: input.allowVoteEdit ?? true,
          commentsVisibleToParticipants: input.commentsVisibleToParticipants ?? false,
          createdByUserId: scope.user.id,
        },
      });
      await tx.fotorankJudgeAuditEvent.create({
        data: {
          organizationId: scope.org.id,
          contestId: contest.id,
          actorType: "ADMIN",
          actorUserId: scope.user.id,
          eventType: "JUDGE_ASSIGNMENT_CREATED",
          entityType: "FotorankJudgeAssignment",
          entityId: assignment.id,
          payloadJson: { categoryId, assignmentType: input.assignmentType, batch: true },
        },
      });
    }
  });

  revalidatePath("/jurados/asignaciones");
  revalidatePath(routes.dashboard.concursos.detalle(contestId));
  return {
    ok: true,
    data: { created: toCreate.length, skippedExisting },
  };
}

export async function sendJudgeInvitation(input: {
  email: string;
  contestId: string;
  categoryId?: string;
  judgeAccountId?: string;
  expiresInDays?: number;
}): Promise<JudgeActionResult<{ invitationId: string; registrationUrl: string }>> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  const email = input.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Ingresá un email válido." };
  }
  if (!input.contestId?.trim()) {
    return { ok: false, error: "Seleccioná un concurso." };
  }

  const contest = await prisma.fotorankContest.findFirst({
    where: { id: input.contestId.trim(), organizationId: scope.org.id },
    select: { id: true },
  });
  if (!contest) {
    return { ok: false, error: "Concurso no encontrado en tu organización." };
  }

  if (input.categoryId?.trim()) {
    const cat = await prisma.fotorankContestCategory.findFirst({
      where: { id: input.categoryId.trim(), contestId: contest.id },
      select: { id: true },
    });
    if (!cat) {
      return { ok: false, error: "La categoría no pertenece al concurso seleccionado." };
    }
  }

  const plainToken = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(plainToken).digest("hex");
  const expiresInDays = Math.max(1, input.expiresInDays ?? 7);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const invitation = await prisma.fotorankJudgeInvitation.create({
    data: {
      organizationId: scope.org.id,
      contestId: input.contestId,
      categoryId: input.categoryId?.trim() || null,
      judgeAccountId: input.judgeAccountId || null,
      email,
      tokenHash,
      expiresAt,
      invitationStatus: "SENT",
      sentByUserId: scope.user.id,
    },
  });

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: scope.org.id,
      contestId: input.contestId,
      actorType: "ADMIN",
      actorUserId: scope.user.id,
      eventType: "JUDGE_INVITATION_SENT",
      entityType: "FotorankJudgeInvitation",
      entityId: invitation.id,
      payloadJson: { email: invitation.email, expiresAt: invitation.expiresAt.toISOString() },
    },
  });

  revalidatePath("/jurados/invitaciones");
  logInvitationBaseUrlMisconfigurationIfNeeded("sendJudgeInvitation");
  const registrationUrl = buildJudgeInvitationRegistrationUrl(plainToken);
  return { ok: true, data: { invitationId: invitation.id, registrationUrl } };
}

export async function listJudgeInvitationsForOrg(): Promise<
  JudgeActionResult<
    Array<{
      id: string;
      email: string;
      contestId: string;
      contestTitle: string;
      categoryId: string | null;
      categoryName: string | null;
      invitationStatus: string;
      expiresAt: string;
      createdAt: string;
      acceptedAt: string | null;
      judgeLabel: string | null;
    }>
  >
> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  const rows = await prisma.fotorankJudgeInvitation.findMany({
    where: { organizationId: scope.org.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      contest: { select: { title: true } },
      category: { select: { name: true } },
      judgeAccount: { include: { profile: { select: { firstName: true, lastName: true } } } },
    },
  });

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      email: r.email,
      contestId: r.contestId,
      contestTitle: r.contest.title,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
      invitationStatus: r.invitationStatus,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
      judgeLabel: r.judgeAccount?.profile
        ? `${r.judgeAccount.profile.firstName} ${r.judgeAccount.profile.lastName}`.trim()
        : null,
    })),
  };
}

export async function revokeJudgeInvitation(invitationId: string): Promise<JudgeActionResult> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  const inv = await prisma.fotorankJudgeInvitation.findFirst({
    where: { id: invitationId, organizationId: scope.org.id },
  });
  if (!inv) return { ok: false, error: "Invitación no encontrada." };
  if (inv.invitationStatus === "ACCEPTED") {
    return { ok: false, error: "No se puede revocar una invitación ya aceptada." };
  }
  if (inv.invitationStatus === "REVOKED") {
    return { ok: false, error: "La invitación ya está revocada." };
  }

  await prisma.fotorankJudgeInvitation.update({
    where: { id: inv.id },
    data: { invitationStatus: "REVOKED" },
  });

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: scope.org.id,
      contestId: inv.contestId,
      actorType: "ADMIN",
      actorUserId: scope.user.id,
      eventType: "JUDGE_INVITATION_REVOKED",
      entityType: "FotorankJudgeInvitation",
      entityId: inv.id,
      payloadJson: { email: inv.email },
    },
  });

  revalidatePath("/jurados/invitaciones");
  return { ok: true };
}

/**
 * Genera un nuevo token (invalida el anterior). Solo invitaciones pendientes.
 * Devuelve la URL de registro una vez para copiar / enviar por canal seguro (p. ej. email futuro).
 */
export async function regenerateJudgeInvitationLink(
  invitationId: string
): Promise<JudgeActionResult<{ registrationUrl: string }>> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  const inv = await prisma.fotorankJudgeInvitation.findFirst({
    where: { id: invitationId, organizationId: scope.org.id },
  });
  if (!inv) return { ok: false, error: "Invitación no encontrada." };
  if (inv.invitationStatus === "ACCEPTED") {
    return { ok: false, error: "La invitación ya fue aceptada." };
  }
  if (inv.invitationStatus === "REVOKED") {
    return { ok: false, error: "La invitación está revocada. Creá una nueva invitación." };
  }
  if (!["SENT", "OPENED", "DRAFT"].includes(inv.invitationStatus)) {
    return { ok: false, error: "No se puede regenerar el enlace en el estado actual." };
  }
  if (inv.expiresAt < new Date()) {
    return { ok: false, error: "La invitación está vencida. Creá una nueva con fecha válida." };
  }

  const plainToken = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(plainToken).digest("hex");

  await prisma.fotorankJudgeInvitation.update({
    where: { id: inv.id },
    data: { tokenHash, invitationStatus: "SENT" },
  });

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: scope.org.id,
      contestId: inv.contestId,
      actorType: "ADMIN",
      actorUserId: scope.user.id,
      eventType: "JUDGE_INVITATION_TOKEN_ROTATED",
      entityType: "FotorankJudgeInvitation",
      entityId: inv.id,
      payloadJson: { email: inv.email },
    },
  });

  revalidatePath("/jurados/invitaciones");
  logInvitationBaseUrlMisconfigurationIfNeeded("rotateJudgeInvitationToken");
  return { ok: true, data: { registrationUrl: buildJudgeInvitationRegistrationUrl(plainToken) } };
}

/**
 * J-P1-06 — Aceptación de invitación: estados de asignación que pueden pasar a ACCEPTED.
 * No se modifican: REJECTED, IN_PROGRESS, COMPLETED, EXTENDED, REPLACED_BY_BACKUP, ACCEPTED.
 */
const ASSIGNMENT_STATUSES_PENDING_INVITE_FLOW = ["ASSIGNED", "INVITATION_SENT"] as const;

type PendingInviteAssignmentStatus = (typeof ASSIGNMENT_STATUSES_PENDING_INVITE_FLOW)[number];

/**
 * Filtro explícito para updateMany/count al aceptar invitación (sin categoryId ?? undefined).
 * - Con categoría: solo esa categoría del concurso.
 * - Sin categoría: todas las categorías del concurso para ese jurado (mismo organizationId).
 */
function assignmentWhereForInviteAcceptance(params: {
  contestId: string;
  organizationId: string;
  judgeAccountId: string;
  /** null = invitación a nivel concurso (todas las categorías pendientes de ese jurado en el concurso) */
  categoryId: string | null;
}): {
  contestId: string;
  organizationId: string;
  judgeAccountId: string;
  assignmentStatus: { in: PendingInviteAssignmentStatus[] };
  categoryId?: string;
} {
  const base = {
    contestId: params.contestId,
    organizationId: params.organizationId,
    judgeAccountId: params.judgeAccountId,
    assignmentStatus: { in: [...ASSIGNMENT_STATUSES_PENDING_INVITE_FLOW] },
  };
  if (params.categoryId !== null) {
    return { ...base, categoryId: params.categoryId };
  }
  return base;
}

export async function registerJudgeFromInvitation(input: {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}): Promise<JudgeActionResult> {
  const tokenHash = createHash("sha256").update(input.token).digest("hex");
  const invitation = await prisma.fotorankJudgeInvitation.findUnique({
    where: { tokenHash },
    include: { organization: true },
  });

  if (!invitation) return { ok: false, error: "Invitación inválida." };
  if (invitation.expiresAt < new Date()) return { ok: false, error: "La invitación está vencida." };
  if (invitation.invitationStatus === "REVOKED") {
    return { ok: false, error: "Esta invitación fue revocada. Pedí una nueva al organizador." };
  }
  if (!["SENT", "OPENED"].includes(invitation.invitationStatus)) {
    return { ok: false, error: "La invitación ya fue procesada." };
  }

  const contestOk = await prisma.fotorankContest.findFirst({
    where: { id: invitation.contestId, organizationId: invitation.organizationId },
    select: { id: true },
  });
  if (!contestOk) {
    return { ok: false, error: "La invitación no coincide con el concurso u organización. Contactá al administrador." };
  }

  if (invitation.categoryId) {
    const categoryOk = await prisma.fotorankContestCategory.findFirst({
      where: { id: invitation.categoryId, contestId: invitation.contestId },
      select: { id: true },
    });
    if (!categoryOk) {
      return { ok: false, error: "La invitación no coincide con la categoría del concurso. Contactá al administrador." };
    }
  }

  const workspaceId = await resolveWorkspaceIdForContestOrganization(invitation.organizationId);
  if (!workspaceId) {
    return {
      ok: false,
      error:
        "No se pudo vincular la organización del concurso a un espacio de trabajo de la suite. Pedí a un administrador que un miembro activo de la organización tenga cuenta en la plataforma.",
    };
  }

  const existing = await prisma.fotorankJudgeAccount.findUnique({ where: { email: invitation.email } });

  const judgeId = existing?.id ?? (
    await prisma.fotorankJudgeAccount.create({
      data: {
        workspaceId,
        email: invitation.email,
        passwordHash: hashPassword(input.password),
        accountStatus: "ACTIVE",
        profile: {
          create: {
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            publicSlug: `${buildPublicSlug(input.firstName, input.lastName)}-${randomBytes(2).toString("hex")}`,
            isPublic: true,
          },
        },
      },
      select: { id: true },
    })
  ).id;

  if (invitation.judgeAccountId != null && invitation.judgeAccountId !== judgeId) {
    return {
      ok: false,
      error:
        "La invitación está asociada a otra cuenta de jurado. Usá el email con el que te invitaron o pedí una nueva invitación.",
    };
  }

  await prisma.fotorankJudgeOrganizationMembership.upsert({
    where: {
      judgeAccountId_organizationId: {
        judgeAccountId: judgeId,
        organizationId: invitation.organizationId,
      },
    },
    create: {
      judgeAccountId: judgeId,
      organizationId: invitation.organizationId,
      membershipStatus: "ACTIVE",
    },
    update: { membershipStatus: "ACTIVE" },
  });

  const invitationCategoryId: string | null = invitation.categoryId;

  const assignmentWhere = assignmentWhereForInviteAcceptance({
    contestId: invitation.contestId,
    organizationId: invitation.organizationId,
    judgeAccountId: judgeId,
    categoryId: invitationCategoryId,
  });

  const pendingAssignmentsCount = await prisma.fotorankJudgeAssignment.count({ where: assignmentWhere });
  if (pendingAssignmentsCount === 0) {
    return {
      ok: false,
      error:
        invitationCategoryId !== null
          ? "No hay una asignación pendiente (ASSIGNED o INVITATION_SENT) para esta categoría, concurso y tu cuenta. Pedí al administrador que revise la invitación o la asignación."
          : "No hay asignaciones pendientes (ASSIGNED o INVITATION_SENT) para este concurso y tu cuenta. Pedí al administrador que revise la invitación o las asignaciones.",
    };
  }

  await prisma.$transaction([
    prisma.fotorankJudgeInvitation.update({
      where: { id: invitation.id },
      data: {
        invitationStatus: "ACCEPTED",
        acceptedAt: new Date(),
        judgeAccountId: judgeId,
      },
    }),
    prisma.fotorankJudgeAssignment.updateMany({
      where: assignmentWhere,
      data: { assignmentStatus: "ACCEPTED" },
    }),
  ]);

  await createJudgeSessionForJudge(judgeId);
  redirect("/jurado/panel");
}

/** Estado del formulario de registro por invitación (`useFormState`). */
export type JudgeRegisterInviteFormState = { error: string | null };

/**
 * Wrapper para `<form action={…}>`: en éxito `registerJudgeFromInvitation` hace `redirect` (lanza);
 * en error devuelve mensaje para pintar `judge-register-error` sin depender de `onSubmit` async en cliente.
 */
export async function registerJudgeInvitationFormAction(
  _prev: JudgeRegisterInviteFormState | undefined,
  formData: FormData,
): Promise<JudgeRegisterInviteFormState> {
  const result = await registerJudgeFromInvitation({
    token: String(formData.get("token") ?? "").trim(),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  return { error: null };
}

export type JudgeLoginFormState = { error: string | null };

/**
 * Misma forma que `loginAction` (admin): `useFormState` + `action` en el `<form>` para que `redirect()` tras login
 * funcione bien con el App Router (evita invocar el action a mano desde `onSubmit`).
 */
export async function judgeLoginAction(
  _prev: JudgeLoginFormState | undefined,
  formData: FormData,
): Promise<JudgeLoginFormState> {
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  if (!email || !password) return { error: "Email y contraseña son obligatorios." };

  const judge = await prisma.fotorankJudgeAccount.findUnique({ where: { email } });
  if (!judge) return { error: "Credenciales inválidas." };
  if (!verifyPassword(password, judge.passwordHash)) return { error: "Credenciales inválidas." };
  if (judge.accountStatus !== "ACTIVE") return { error: "La cuenta no está activa." };

  await prisma.fotorankJudgeAccount.update({
    where: { id: judge.id },
    data: { lastLoginAt: new Date() },
  });

  await createJudgeSessionForJudge(judge.id);
  redirect("/jurado/panel");
}

export async function judgeLogoutAction(): Promise<void> {
  await destroyCurrentJudgeSession();
}

export async function listJudgeAssignmentsForCurrentJudge(): Promise<JudgeActionResult<Array<Record<string, unknown>>>> {
  const judge = await requireJudgeAuth();
  const now = new Date();

  const assignments = await prisma.fotorankJudgeAssignment.findMany({
    where: { judgeAccountId: judge.id },
    include: {
      contest: true,
      category: true,
      votes: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return {
    ok: true,
    data: assignments.map((a) => {
      const eligibility = eligibilityForLoadedAssignment(
        {
          id: a.id,
          judgeAccountId: a.judgeAccountId,
          organizationId: a.organizationId,
          contestId: a.contestId,
          categoryId: a.categoryId,
          assignmentStatus: a.assignmentStatus,
          methodType: a.methodType,
          methodConfigJson: a.methodConfigJson,
          allowVoteEdit: a.allowVoteEdit,
          evaluationStartsAt: a.evaluationStartsAt,
          evaluationEndsAt: a.evaluationEndsAt,
          extendedEndsAt: a.extendedEndsAt,
          contest: { status: a.contest.status },
        },
        judge,
        now,
      );
      return {
        id: a.id,
        contestId: a.contestId,
        contestTitle: a.contest.title,
        categoryName: a.category.name,
        assignmentStatus: a.assignmentStatus,
        assignmentType: a.assignmentType,
        methodType: a.methodType,
        evaluationStartsAt: a.evaluationStartsAt,
        evaluationEndsAt: a.extendedEndsAt ?? a.evaluationEndsAt,
        votesCount: a.votes.length,
        contestStatus: a.contest.status,
        evaluationAllowed: eligibility.allowed,
        evaluationBlockCode: eligibility.allowed ? null : eligibility.code,
        evaluationBlockMessage: eligibility.allowed ? null : eligibility.message,
      };
    }),
  };
}

export async function listEntriesForAssignment(assignmentId: string): Promise<JudgeActionResult<Array<Record<string, unknown>>>> {
  const judge = await requireJudgeAuth();

  const gate = await gateJudgeEvaluationForJudge(assignmentId, judge, new Date());
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  const assignment = gate.assignment;

  const entriesRaw = await prisma.fotorankContestEntry.findMany({
    where: {
      contestId: assignment.contestId,
      categoryId: assignment.categoryId,
    },
    include: {
      votes: {
        where: { assignmentId: assignment.id },
      },
    },
    orderBy: { id: "asc" },
  });

  const entries = filterFotorankEntriesEvaluableForJudging(entriesRaw);

  return {
    ok: true,
    data: entries.map((entry) => ({
      id: entry.id,
      imageUrl: entry.imageUrl,
      title: entry.title,
      description: entry.description,
      // anonimato: no exponer authorUserId en panel jurado
      currentVote: entry.votes[0] ?? null,
    })),
  };
}

export async function saveJudgeVote(input: {
  assignmentId: string;
  entryId: string;
  valueNumeric?: number | null;
  valueBoolean?: boolean | null;
  isFavorite?: boolean | null;
  selectedRank?: number | null;
  criteriaScoresJson?: unknown;
  comment?: string | null;
}): Promise<JudgeActionResult> {
  const judge = await requireJudgeAuth();

  const gate = await gateJudgeEvaluationForJudge(input.assignmentId, judge, new Date());
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  const assignment = gate.assignment;

  const entry = await prisma.fotorankContestEntry.findUnique({
    where: { id: input.entryId },
    select: { id: true, contestId: true, categoryId: true, imageUrl: true },
  });
  if (!entry) {
    return { ok: false, error: "Obra no encontrada." };
  }
  if (entry.contestId !== assignment.contestId) {
    return { ok: false, error: "La obra no pertenece al concurso asignado." };
  }
  if (entry.categoryId !== assignment.categoryId) {
    return { ok: false, error: "La obra no pertenece a la categoría asignada." };
  }

  if (!isEvaluableFotorankContestEntry(entry)) {
    return { ok: false, error: "Esta obra no cumple los requisitos mínimos para ser evaluada (p. ej. imagen faltante)." };
  }

  let existing = await prisma.fotorankJudgeVote.findUnique({
    where: {
      assignmentId_entryId: {
        assignmentId: input.assignmentId,
        entryId: input.entryId,
      },
    },
  });

  if (existing && !assignment.allowVoteEdit) {
    return { ok: false, error: "Esta asignación no permite editar votos." };
  }

  const payloadCheck = validateVotePayloadForMethod(assignment.methodType, assignment.methodConfigJson, {
    valueNumeric: input.valueNumeric,
    valueBoolean: input.valueBoolean,
    isFavorite: input.isFavorite,
    selectedRank: input.selectedRank,
    criteriaScoresJson: input.criteriaScoresJson,
  });
  if (!payloadCheck.ok) {
    return { ok: false, error: payloadCheck.error };
  }
  const voteData = payloadCheck.data;

  let createdNow = false;

  if (!existing) {
    try {
      await prisma.fotorankJudgeVote.create({
        data: {
          assignmentId: input.assignmentId,
          entryId: input.entryId,
          valueNumeric: voteData.valueNumeric,
          valueBoolean: voteData.valueBoolean,
          isFavorite: voteData.isFavorite,
          selectedRank: voteData.selectedRank,
          criteriaScoresJson: voteData.criteriaScoresJson as never,
          comment: input.comment?.trim() || null,
        },
      });
      createdNow = true;
    } catch (e) {
      const isUnique =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isUnique) throw e;
      existing = await prisma.fotorankJudgeVote.findUnique({
        where: {
          assignmentId_entryId: {
            assignmentId: input.assignmentId,
            entryId: input.entryId,
          },
        },
      });
      if (!existing) {
        throw e instanceof Error ? e : new Error("Conflicto al guardar el voto; reintentá.");
      }
    }
  }

  if (!createdNow && existing) {
    if (!assignment.allowVoteEdit) {
      return { ok: false, error: "Esta asignación no permite editar votos." };
    }
    const prevPayload = {
      valueNumeric: existing.valueNumeric,
      valueBoolean: existing.valueBoolean,
      isFavorite: existing.isFavorite,
      selectedRank: existing.selectedRank,
      criteriaScoresJson: existing.criteriaScoresJson,
      comment: existing.comment,
      version: existing.version,
    };

    const updated = await prisma.fotorankJudgeVote.update({
      where: { id: existing.id },
      data: {
        valueNumeric: voteData.valueNumeric,
        valueBoolean: voteData.valueBoolean,
        isFavorite: voteData.isFavorite,
        selectedRank: voteData.selectedRank,
        criteriaScoresJson: voteData.criteriaScoresJson as never,
        comment: input.comment?.trim() || null,
        version: { increment: 1 },
      },
    });

    await prisma.fotorankJudgeVoteHistory.create({
      data: {
        voteId: existing.id,
        assignmentId: input.assignmentId,
        entryId: input.entryId,
        previousPayloadJson: prevPayload as never,
        newPayloadJson: {
          valueNumeric: updated.valueNumeric,
          valueBoolean: updated.valueBoolean,
          isFavorite: updated.isFavorite,
          selectedRank: updated.selectedRank,
          criteriaScoresJson: updated.criteriaScoresJson,
          comment: updated.comment,
          version: updated.version,
        } as never,
        changedByJudgeId: judge.id,
      },
    });
  }

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: assignment.organizationId,
      contestId: assignment.contestId,
      actorType: "JUDGE",
      actorJudgeId: judge.id,
      eventType: "JUDGE_VOTE_SAVED",
      entityType: "FotorankJudgeVote",
      entityId: `${input.assignmentId}:${input.entryId}`,
      payloadJson: { methodType: assignment.methodType },
    },
  });

  revalidatePath("/jurado/panel");
  revalidatePath(`/jurado/asignaciones/${input.assignmentId}/evaluar`);
  revalidatePath(`/dashboard/concursos/${assignment.contestId}/resultados`);
  return { ok: true };
}

/** Estado del formulario de voto (jurado / evaluación) vía `useFormState`. */
export type JudgeEvaluationVoteFormState = { error: string | null; okMessage: string | null };

/**
 * Server action ligada al `<form>` de evaluación: evita depender de onClick en cliente
 * (en E2E / algunos entornos el envío nativo + action es más fiable que handlers React).
 */
export async function judgeEvaluationVoteAction(
  _prev: JudgeEvaluationVoteFormState | undefined,
  formData: FormData,
): Promise<JudgeEvaluationVoteFormState> {
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const entryId = String(formData.get("entryId") ?? "").trim();
  if (!assignmentId || !entryId) {
    return { error: "Datos de envío incompletos.", okMessage: null };
  }

  const judge = await requireJudgeAuth();
  const gate = await gateJudgeEvaluationForJudge(assignmentId, judge, new Date());
  if (!gate.ok) {
    return { error: gate.error, okMessage: null };
  }

  const raw = rawVoteInputFromFormData(formData, gate.assignment.methodType, gate.assignment.methodConfigJson);
  const input = {
    assignmentId,
    entryId,
    comment: String(formData.get("comment") ?? "").trim() || null,
    ...raw,
  };

  const result = await saveJudgeVote(input);
  if (!result.ok) {
    return { error: result.error, okMessage: null };
  }
  return { error: null, okMessage: "Voto guardado" };
}

export async function listJudgeAuditEvents(filters?: { contestId?: string; judgeId?: string }): Promise<JudgeActionResult<Array<Record<string, unknown>>>> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  const events = await prisma.fotorankJudgeAuditEvent.findMany({
    where: {
      organizationId: scope.org.id,
      contestId: filters?.contestId,
      actorJudgeId: filters?.judgeId,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actorJudge: { include: { profile: true } },
      actorUser: true,
      contest: true,
    },
  });

  return {
    ok: true,
    data: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      entityType: e.entityType,
      entityId: e.entityId,
      actorType: e.actorType,
      actorUserName: e.actorUser?.name ?? null,
      actorJudgeName: e.actorJudge?.profile ? `${e.actorJudge.profile.firstName} ${e.actorJudge.profile.lastName}` : null,
      contestTitle: e.contest?.title ?? null,
      payloadJson: e.payloadJson,
      createdAt: e.createdAt,
    })),
  };
}

export async function getJudgePublicProfile(publicSlug: string): Promise<JudgeActionResult<Record<string, unknown>>> {
  const profile = await prisma.fotorankJudgeProfile.findFirst({
    where: { publicSlug, isPublic: true },
    include: {
      judgeAccount: {
        include: {
          assignments: {
            where: { assignmentStatus: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "EXTENDED"] } },
            include: { contest: true, category: true },
          },
        },
      },
    },
  });

  if (!profile) return { ok: false, error: "Perfil no encontrado." };

  return {
    ok: true,
    data: {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
      shortBio: profile.shortBio,
      fullBioRichJson: profile.fullBioRichJson,
      city: profile.city,
      country: profile.country,
      website: profile.website,
      instagram: profile.instagram,
      otherLinksJson: profile.otherLinksJson,
      assignments: profile.judgeAccount.assignments.map((a) => ({
        contestId: a.contestId,
        contestTitle: a.contest.title,
        categoryName: a.category.name,
        assignmentType: a.assignmentType,
      })),
    },
  };
}

export async function listPublicJudgesForContestBySlug(contestSlug: string): Promise<JudgeActionResult<Array<Record<string, unknown>>>> {
  const contest = await prisma.fotorankContest.findFirst({
    where: {
      slug: contestSlug,
      visibility: "PUBLIC",
      status: { in: ["PUBLISHED", "ACTIVE"] },
    },
    include: {
      organization: true,
      judgeAssignments: {
        where: { assignmentStatus: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "EXTENDED"] } },
        include: {
          judgeAccount: { include: { profile: true } },
          category: true,
        },
      },
    },
  });

  if (!contest) return { ok: false, error: "Concurso no encontrado." };

  const byJudge = new Map<string, { profile: any; categories: string[] }>();
  for (const a of contest.judgeAssignments) {
    const profile = a.judgeAccount.profile;
    if (!profile || !profile.isPublic) continue;
    const prev = byJudge.get(a.judgeAccountId);
    if (prev) prev.categories.push(a.category.name);
    else byJudge.set(a.judgeAccountId, { profile, categories: [a.category.name] });
  }

  return {
    ok: true,
    data: [...byJudge.values()].map((v) => ({
      firstName: v.profile.firstName,
      lastName: v.profile.lastName,
      avatarUrl: v.profile.avatarUrl,
      publicSlug: v.profile.publicSlug,
      shortBio: v.profile.shortBio,
      categories: [...new Set(v.categories)],
    })),
  };
}


export async function getJudgeByIdForOrg(judgeId: string): Promise<JudgeActionResult<Record<string, unknown>>> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  const membership = await prisma.fotorankJudgeOrganizationMembership.findFirst({
    where: { organizationId: scope.org.id, judgeAccountId: judgeId },
    include: { judgeAccount: { include: { profile: true } } },
  });
  if (!membership) return { ok: false, error: "Jurado no encontrado." };

  return {
    ok: true,
    data: {
      judgeId: membership.judgeAccount.id,
      email: membership.judgeAccount.email,
      accountStatus: membership.judgeAccount.accountStatus,
      profile: membership.judgeAccount.profile,
    },
  };
}
