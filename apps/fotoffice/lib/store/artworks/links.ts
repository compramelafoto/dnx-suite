/**
 * Vínculo entre un workspace de FOTOFFICE y una organización de concursos de FotoRank
 * (spec etapa 3, O1). Sólo las obras de concursos de organizaciones vinculadas se pueden
 * listar, publicar o vender: `assertContestLinked` se llama en cada lectura de obras.
 *
 * Vincular exige ser dueño o admin en los DOS lados, y se vuelve a comprobar acá en el
 * servidor en el momento de vincular (no alcanza con que la pantalla lo haya ofrecido):
 * - en el workspace: `WorkspaceMembership` OWNER/ADMIN (`canManageWorkspaceSettings`);
 * - en FotoRank: `ContestOrganizationMember` ACTIVE con rol OWNER o ADMIN, o ser super admin
 *   de la plataforma (como hace FotoRank).
 *
 * Desvincular sólo borra el vínculo: las obras publicadas y los permisos de los autores quedan,
 * pero `assertContestLinked` deja de pasar y esas obras ya no se listan ni se venden.
 */
import "server-only";

import { isGlobalSuperAdmin } from "@repo/auth";
import { prisma, type Prisma } from "@repo/db";

import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";

type Db = Pick<
  Prisma.TransactionClient,
  "user" | "contestOrganization" | "contestOrganizationMember" | "workspaceContestOrganizationLink" | "fotorankContest"
>;

/** Roles de FotoRank que pueden vincular su organización. */
const ROLES_QUE_VINCULAN = ["OWNER", "ADMIN"] as const;

export type OrganizationLinkErrorCode = "NOT_WORKSPACE_ADMIN" | "NOT_ORGANIZATION_ADMIN" | "ORGANIZATION_NOT_FOUND";

const MENSAJES: Record<OrganizationLinkErrorCode, string> = {
  NOT_WORKSPACE_ADMIN: "Sólo el dueño o un administrador de FOTOFFICE puede vincular organizaciones.",
  NOT_ORGANIZATION_ADMIN:
    "Para vincular esta organización tenés que ser dueño o administrador de ella en FotoRank, con el mismo email.",
  ORGANIZATION_NOT_FOUND: "Esa organización ya no existe en FotoRank.",
};

export class OrganizationLinkError extends Error {
  readonly code: OrganizationLinkErrorCode;
  constructor(code: OrganizationLinkErrorCode) {
    super(MENSAJES[code]);
    this.name = "OrganizationLinkError";
    this.code = code;
  }
}

/** El concurso no pertenece a una organización vinculada a este workspace (o no existe). */
export class ContestNotLinkedError extends Error {
  readonly code = "CONTEST_NOT_LINKED" as const;
  constructor() {
    super("Ese concurso no pertenece a una organización vinculada a tu tienda.");
    this.name = "ContestNotLinkedError";
  }
}

export type LinkableOrganization = { id: string; name: string; slug: string };

export type LinkedOrganization = {
  organizationId: string;
  name: string;
  slug: string;
  linkedAt: Date;
  /** Nombre (o email si no tiene) de quien vinculó; null si la cuenta ya no existe. */
  linkedByName: string | null;
};

async function esSuperAdmin(userId: number, db: Db): Promise<boolean> {
  // Desde la base y no desde la sesión: es una comprobación de permiso al escribir.
  const u = await db.user.findUnique({ where: { id: userId }, select: { globalRole: true, role: true } });
  return u ? isGlobalSuperAdmin(u) : false;
}

/**
 * Lado FOTOFFICE del permiso para vincular: dueño o admin del workspace. Es un chequeo por rol
 * a propósito (spec O1): vincular una organización externa es una decisión de la institución,
 * como conectar Mercado Pago. La pantalla lo usa para explicar por qué no puede vincular.
 */
export async function canLinkFromWorkspace(userId: number, workspaceId: string): Promise<boolean> {
  return canManageWorkspaceSettings(await resolveWorkspaceRole(userId, workspaceId));
}

export async function linkedOrganizationIds(workspaceId: string, db: Db = prisma): Promise<string[]> {
  const filas = await db.workspaceContestOrganizationLink.findMany({
    where: { workspaceId },
    select: { organizationId: true },
  });
  return filas.map((f) => f.organizationId);
}

/**
 * Organizaciones que esta persona podría vincular (lado FotoRank) y que todavía no están
 * vinculadas al workspace. El lado del workspace lo mira la pantalla aparte, para explicar
 * cuál de los dos falta.
 */
export async function listLinkableOrganizations(
  userId: number,
  workspaceId: string,
  db: Db = prisma,
): Promise<LinkableOrganization[]> {
  const [yaVinculadas, superAdmin] = await Promise.all([
    linkedOrganizationIds(workspaceId, db),
    esSuperAdmin(userId, db),
  ]);
  return db.contestOrganization.findMany({
    where: {
      id: { notIn: yaVinculadas },
      ...(superAdmin
        ? {}
        : { members: { some: { userId, status: "ACTIVE", role: { in: [...ROLES_QUE_VINCULAN] } } } }),
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}

/**
 * Crea el vínculo. Idempotente: vincular algo ya vinculado no falla (`created: false`).
 * Tira `OrganizationLinkError` si falta el rol en alguno de los dos lados.
 */
export async function linkOrganization(
  workspaceId: string,
  organizationId: string,
  userId: number,
  db: Db = prisma,
): Promise<{ created: boolean }> {
  if (!(await canLinkFromWorkspace(userId, workspaceId))) throw new OrganizationLinkError("NOT_WORKSPACE_ADMIN");

  const organizacion = await db.contestOrganization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!organizacion) throw new OrganizationLinkError("ORGANIZATION_NOT_FOUND");

  if (!(await esSuperAdmin(userId, db))) {
    const miembro = await db.contestOrganizationMember.findFirst({
      where: { organizationId, userId, status: "ACTIVE", role: { in: [...ROLES_QUE_VINCULAN] } },
      select: { id: true },
    });
    if (!miembro) throw new OrganizationLinkError("NOT_ORGANIZATION_ADMIN");
  }

  const { count } = await db.workspaceContestOrganizationLink.createMany({
    data: [{ workspaceId, organizationId, linkedByUserId: userId }],
    skipDuplicates: true,
  });
  return { created: count > 0 };
}

/** Quita el vínculo. No toca obras publicadas ni permisos de autores. */
export async function unlinkOrganization(
  workspaceId: string,
  organizationId: string,
  db: Db = prisma,
): Promise<{ removed: boolean }> {
  const { count } = await db.workspaceContestOrganizationLink.deleteMany({ where: { workspaceId, organizationId } });
  return { removed: count > 0 };
}

export async function listLinkedOrganizations(workspaceId: string, db: Db = prisma): Promise<LinkedOrganization[]> {
  const filas = await db.workspaceContestOrganizationLink.findMany({
    where: { workspaceId },
    select: {
      organizationId: true,
      linkedByUserId: true,
      createdAt: true,
      organization: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const ids = [...new Set(filas.map((f) => f.linkedByUserId))];
  const personas = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : [];
  const nombre = new Map(personas.map((p) => [p.id, p.name?.trim() || p.email]));
  return filas.map((f) => ({
    organizationId: f.organizationId,
    name: f.organization?.name ?? "",
    slug: f.organization?.slug ?? "",
    linkedAt: f.createdAt,
    linkedByName: nombre.get(f.linkedByUserId) ?? null,
  }));
}

/** ¿El concurso es de una organización vinculada a este workspace? Concurso inexistente → false. */
export async function isContestLinked(workspaceId: string, contestId: string, db: Db = prisma): Promise<boolean> {
  const concurso = await db.fotorankContest.findUnique({ where: { id: contestId }, select: { organizationId: true } });
  if (!concurso) return false;
  const vinculo = await db.workspaceContestOrganizationLink.findFirst({
    where: { workspaceId, organizationId: concurso.organizationId },
    select: { id: true },
  });
  return vinculo !== null;
}

/** Igual que `isContestLinked`, pero tira `ContestNotLinkedError`. */
export async function assertContestLinked(workspaceId: string, contestId: string, db: Db = prisma): Promise<void> {
  if (!(await isContestLinked(workspaceId, contestId, db))) throw new ContestNotLinkedError();
}
