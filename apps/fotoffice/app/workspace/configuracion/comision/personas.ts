import "server-only";
import { prisma } from "@repo/db";
import { isCurrentOrUpcoming } from "@/lib/commission/rules";

/**
 * Lectura de la Comisión directiva para las pantallas: quiénes la integran, con qué cargo y qué
 * roles, y el historial.
 *
 * Mandatos y asignaciones pueden estar anclados a la ficha (`memberId`) o a la cuenta
 * (`userId`). Para la pantalla, una persona es una sola: si la cuenta tiene ficha en este
 * workspace, se agrupa bajo la ficha (el mismo criterio que `personWhere` en las acciones).
 *
 * "Vigente" acá incluye lo que empieza más adelante (`isCurrentOrUpcoming`): un mandato que
 * arranca el mes que viene tiene que verse para poder editarlo o quitarlo.
 */

const MEMBER_SEL = {
  id: true,
  firstName: true,
  lastName: true,
  memberNumber: true,
  status: true,
  userId: true,
} as const;

type MemberInfo = {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string;
  status: string;
  userId: number | null;
};
type UserInfo = { id: number; name: string | null; email: string };

export type PersonaComision = {
  key: string;
  /** Para editar y quitar: uno de los dos. */
  memberId: string | null;
  userId: number | null;
  nombre: string;
  numero: string | null;
  tieneCuenta: boolean;
  /** "ACTIVE", "SUSPENDED", "INACTIVE"; null si no es socia. */
  estado: string | null;
};

export type PeriodoComision = {
  id: string;
  tipo: "cargo" | "rol";
  /** Id del cargo o del rol. */
  refId: string;
  nombre: string;
  vota: boolean;
  orden: number;
  startsAt: Date | null;
  endsAt: Date | null;
  revokedAt: Date | null;
  persona: PersonaComision;
};

export type IntegranteComision = PersonaComision & {
  cargos: PeriodoComision[];
  roles: PeriodoComision[];
};

function persona(
  memberId: string | null,
  userId: number | null,
  member: MemberInfo | null,
  user: UserInfo | null,
  memberByUser: Map<number, MemberInfo>,
): PersonaComision {
  const ficha = member ?? (userId !== null ? memberByUser.get(userId) ?? null : null);
  if (ficha) {
    return {
      key: `m:${ficha.id}`,
      memberId: ficha.id,
      userId: null,
      nombre: `${ficha.firstName} ${ficha.lastName}`.trim(),
      numero: ficha.memberNumber,
      tieneCuenta: ficha.userId !== null,
      estado: ficha.status,
    };
  }
  return {
    key: `u:${userId ?? memberId ?? "?"}`,
    memberId: null,
    userId,
    nombre: user?.name?.trim() || user?.email || "Sin nombre",
    numero: null,
    tieneCuenta: userId !== null,
    estado: null,
  };
}

/** Todos los mandatos y asignaciones del workspace, de cargos y roles, con la persona resuelta. */
export async function loadPeriodosComision(workspaceId: string): Promise<PeriodoComision[]> {
  const [terms, assignments] = await Promise.all([
    prisma.workspaceOfficeTerm.findMany({
      where: { workspaceId },
      select: {
        id: true,
        officeId: true,
        memberId: true,
        userId: true,
        startsAt: true,
        endsAt: true,
        revokedAt: true,
        office: { select: { name: true, votes: true, order: true } },
        member: { select: MEMBER_SEL },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.workspaceRoleAssignment.findMany({
      where: { workspaceId },
      select: {
        id: true,
        roleId: true,
        memberId: true,
        userId: true,
        startsAt: true,
        endsAt: true,
        revokedAt: true,
        role: { select: { name: true } },
        member: { select: MEMBER_SEL },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  // Cuentas ancladas por userId que además tienen ficha acá: se agrupan bajo la ficha.
  const userIds = new Set<number>();
  for (const r of [...terms, ...assignments]) if (!r.memberId && r.userId !== null) userIds.add(r.userId);
  const fichas =
    userIds.size > 0
      ? await prisma.member.findMany({
          where: { workspaceId, userId: { in: Array.from(userIds) } },
          select: MEMBER_SEL,
        })
      : [];
  const memberByUser = new Map<number, MemberInfo>();
  for (const f of fichas) if (f.userId !== null) memberByUser.set(f.userId, f);

  return [
    ...terms.map(
      (t): PeriodoComision => ({
        id: t.id,
        tipo: "cargo",
        refId: t.officeId,
        nombre: t.office.name,
        vota: t.office.votes,
        orden: t.office.order,
        startsAt: t.startsAt,
        endsAt: t.endsAt,
        revokedAt: t.revokedAt,
        persona: persona(t.memberId, t.userId, t.member, t.user, memberByUser),
      }),
    ),
    ...assignments.map(
      (a): PeriodoComision => ({
        id: a.id,
        tipo: "rol",
        refId: a.roleId,
        nombre: a.role.name,
        vota: false,
        orden: Number.MAX_SAFE_INTEGER,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        revokedAt: a.revokedAt,
        persona: persona(a.memberId, a.userId, a.member, a.user, memberByUser),
      }),
    ),
  ];
}

/** Integrantes vigentes (o por empezar), ordenados por el cargo y después por nombre. */
export function integrantesVigentes(periodos: PeriodoComision[], now: Date): IntegranteComision[] {
  const byKey = new Map<string, IntegranteComision>();
  for (const p of periodos) {
    if (!isCurrentOrUpcoming(p, now)) continue;
    let it = byKey.get(p.persona.key);
    if (!it) {
      it = { ...p.persona, cargos: [], roles: [] };
      byKey.set(p.persona.key, it);
    }
    (p.tipo === "cargo" ? it.cargos : it.roles).push(p);
  }
  const ordenDe = (i: IntegranteComision) => Math.min(Number.MAX_SAFE_INTEGER, ...i.cargos.map((c) => c.orden));
  const list = Array.from(byKey.values());
  for (const i of list) {
    i.cargos.sort((a, b) => a.orden - b.orden);
    i.roles.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }
  return list.sort((a, b) => ordenDe(a) - ordenDe(b) || a.nombre.localeCompare(b.nombre, "es"));
}

/** Lo revocado o vencido, lo más reciente primero. */
export function historialComision(periodos: PeriodoComision[], now: Date): PeriodoComision[] {
  const cuando = (p: PeriodoComision) => (p.revokedAt ?? p.endsAt ?? new Date(0)).getTime();
  return periodos.filter((p) => !isCurrentOrUpcoming(p, now)).sort((a, b) => cuando(b) - cuando(a));
}
