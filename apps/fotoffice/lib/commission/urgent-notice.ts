import "server-only";
import { prisma } from "@repo/db";
import { APERTURA_PERIOD } from "@/lib/membership/charge-labels";
import { decimalArsToMinor } from "@/lib/membership/money";
import { isAssignmentActive } from "@/lib/permissions/levels";
import { formatPesos } from "./urgent-notice-email";

/**
 * Integrantes de la Comisión Directiva que todavía no pueden gestionarla: no activaron su cuenta
 * (la ficha no tiene usuario) o tienen cuotas vencidas sin pagar.
 *
 * "Integrante" = alguien con un mandato o un rol vigente HOY (`isAssignmentActive`): a quien
 * empieza el mes que viene todavía no le corre prisa. Sólo cuentan las personas con ficha de
 * socio: quien está en la comisión sin ser socio entra con su cuenta y no tiene cuotas.
 *
 * "Deuda" es la misma que deja a alguien fuera de un sorteo (`raffles/eligibility.ts`): saldo
 * mayor a cero, ya vencido y sin el arrastre del sistema anterior (`APERTURA`), que para parte
 * del padrón no reconcilia. Mandar un correo URGENTE por una cuota que todavía no venció, o por
 * un saldo migrado que puede estar mal, sería reclamarle a alguien algo que no debe.
 */

export type PendingReason = "SIN_CUENTA" | "DEUDA" | "SIN_CUENTA_Y_DEUDA";

export type PendingMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
  userId: number | null;
  /** Correo de la cuenta vinculada, si la ficha no tiene uno propio. */
  accountEmail: string | null;
};

export type PendingPeriod = {
  kind: "office" | "role";
  name: string;
  order: number;
  startsAt: Date | null;
  endsAt: Date | null;
  revokedAt: Date | null;
  member: PendingMember | null;
};

export type PendingCharge = { memberId: string; balanceMinor: number; period: string; dueDate: Date };

export type PendingIntegrant = {
  memberId: string;
  name: string;
  firstName: string;
  email: string | null;
  hasEmail: boolean;
  officeName: string | null;
  roleNames: string[];
  reason: PendingReason;
  pendingCount: number;
  pendingTotalMinor: number;
  /** En pesos (con decimales). */
  pendingTotalArs: number;
  status: string;
  /** Cuenta vinculada a la ficha, si la tiene. */
  userId: number | null;
  /** Por qué no se le puede mandar el aviso; `null` si se puede. */
  blocker: string | null;
};

export const BLOCKER_NO_EMAIL = "No tiene correo cargado.";
export const BLOCKER_NOT_ACTIVE = "La ficha no está activa: no se le puede mandar la invitación.";

export function needsInvitation(reason: PendingReason): boolean {
  return reason !== "DEUDA";
}

/** PURA. Agrupa por persona y se queda con quienes no pueden gestionar todavía. */
export function groupPendingIntegrants(
  periods: readonly PendingPeriod[],
  charges: readonly PendingCharge[],
  now: Date,
): PendingIntegrant[] {
  const byMember = new Map<string, { member: PendingMember; offices: { name: string; order: number }[]; roles: Set<string> }>();
  for (const p of periods) {
    if (!p.member || !isAssignmentActive(p, now)) continue;
    let it = byMember.get(p.member.id);
    if (!it) {
      it = { member: p.member, offices: [], roles: new Set() };
      byMember.set(p.member.id, it);
    }
    if (p.kind === "office") {
      if (!it.offices.some((o) => o.name === p.name)) it.offices.push({ name: p.name, order: p.order });
    } else {
      it.roles.add(p.name);
    }
  }

  const debts = new Map<string, { count: number; totalMinor: number }>();
  for (const c of charges) {
    if (c.balanceMinor <= 0 || c.period === APERTURA_PERIOD || c.dueDate.getTime() >= now.getTime()) continue;
    const d = debts.get(c.memberId) ?? { count: 0, totalMinor: 0 };
    d.count += 1;
    d.totalMinor += c.balanceMinor;
    debts.set(c.memberId, d);
  }

  const out: PendingIntegrant[] = [];
  for (const { member, offices, roles } of byMember.values()) {
    const debt = debts.get(member.id) ?? { count: 0, totalMinor: 0 };
    const noAccount = member.userId === null;
    const hasDebt = debt.count > 0;
    if (!noAccount && !hasDebt) continue;
    const reason: PendingReason = noAccount && hasDebt ? "SIN_CUENTA_Y_DEUDA" : noAccount ? "SIN_CUENTA" : "DEUDA";
    const email = member.email?.trim() || member.accountEmail?.trim() || null;
    const blocker = !email
      ? BLOCKER_NO_EMAIL
      : needsInvitation(reason) && member.status !== "ACTIVE"
        ? BLOCKER_NOT_ACTIVE
        : null;
    offices.sort((a, b) => a.order - b.order);
    const officeNames = offices.map((o) => o.name);
    out.push({
      memberId: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      firstName: member.firstName.trim() || `${member.firstName} ${member.lastName}`.trim(),
      email,
      hasEmail: email !== null,
      officeName:
        officeNames.length === 0
          ? null
          : officeNames.length === 1
            ? officeNames[0]
            : `${officeNames.slice(0, -1).join(", ")} y ${officeNames[officeNames.length - 1]}`,
      roleNames: Array.from(roles).sort((a, b) => a.localeCompare(b, "es")),
      reason,
      pendingCount: debt.count,
      pendingTotalMinor: debt.totalMinor,
      pendingTotalArs: debt.totalMinor / 100,
      status: member.status,
      userId: member.userId,
      blocker,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Lo que la pantalla muestra al lado de cada nombre. */
export function pendingReasonLabel(p: Pick<PendingIntegrant, "reason" | "pendingCount" | "pendingTotalMinor">): string {
  const sinCuenta = "Sin cuenta activada";
  const deuda = `Con cuotas pendientes: ${p.pendingCount} por ${formatPesos(p.pendingTotalMinor)}`;
  if (p.reason === "SIN_CUENTA") return sinCuenta;
  if (p.reason === "DEUDA") return deuda;
  return `${sinCuenta} · ${deuda}`;
}

const MEMBER_SELECT = {
  id: true,
  workspaceId: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  userId: true,
  user: { select: { email: true } },
} as const;

type MemberRow = {
  id: string;
  workspaceId?: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
  userId: number | null;
  user: { email: string } | null;
};

function toPendingMember(m: MemberRow): PendingMember {
  return {
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email,
    status: m.status,
    userId: m.userId,
    accountEmail: m.user?.email ?? null,
  };
}

/** Lee mandatos, roles y cuotas del workspace y devuelve a quienes hay que avisarles. */
export async function listPendingIntegrants(workspaceId: string, now: Date): Promise<PendingIntegrant[]> {
  const common = { startsAt: true, endsAt: true, revokedAt: true, memberId: true, userId: true, member: { select: MEMBER_SELECT } } as const;
  const [terms, assignments] = await Promise.all([
    prisma.workspaceOfficeTerm.findMany({
      where: { workspaceId, revokedAt: null },
      select: { ...common, office: { select: { name: true, order: true } } },
    }),
    prisma.workspaceRoleAssignment.findMany({
      where: { workspaceId, revokedAt: null },
      select: { ...common, role: { select: { name: true } } },
    }),
  ]);

  // Quien quedó anclado por cuenta pero tiene ficha acá se agrupa bajo la ficha (como en la pantalla).
  const userIds = new Set<number>();
  for (const r of [...terms, ...assignments]) if (!r.memberId && r.userId !== null) userIds.add(r.userId);
  const byUser = new Map<number, PendingMember>();
  if (userIds.size > 0) {
    const fichas = await prisma.member.findMany({
      where: { workspaceId, userId: { in: Array.from(userIds) } },
      select: MEMBER_SELECT,
    });
    for (const f of fichas) if (f.userId !== null) byUser.set(f.userId, toPendingMember(f));
  }

  const resolve = (r: { userId: number | null; member: MemberRow | null }): PendingMember | null => {
    if (r.member) return r.member.workspaceId === undefined || r.member.workspaceId === workspaceId ? toPendingMember(r.member) : null;
    return r.userId !== null ? byUser.get(r.userId) ?? null : null;
  };

  const periods: PendingPeriod[] = [
    ...terms.map((t) => ({
      kind: "office" as const,
      name: t.office.name,
      order: t.office.order,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      revokedAt: t.revokedAt,
      member: resolve(t),
    })),
    ...assignments.map((a) => ({
      kind: "role" as const,
      name: a.role.name,
      order: Number.MAX_SAFE_INTEGER,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      revokedAt: a.revokedAt,
      member: resolve(a),
    })),
  ];

  const memberIds = Array.from(
    new Set(periods.filter((p) => p.member && isAssignmentActive(p, now)).map((p) => (p.member as PendingMember).id)),
  );
  if (memberIds.length === 0) return [];

  const charges = await prisma.membershipCharge.findMany({
    where: {
      workspaceId,
      memberId: { in: memberIds },
      balanceArs: { gt: 0 },
      period: { not: APERTURA_PERIOD },
      dueDate: { lt: now },
    },
    select: { memberId: true, balanceArs: true, period: true, dueDate: true },
  });

  return groupPendingIntegrants(
    periods,
    charges.map((c) => ({
      memberId: c.memberId,
      balanceMinor: decimalArsToMinor(c.balanceArs),
      period: c.period,
      dueDate: c.dueDate,
    })),
    now,
  );
}
