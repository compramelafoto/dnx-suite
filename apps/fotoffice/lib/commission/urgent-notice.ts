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
 * "Deuda" parte del criterio de los sorteos (`raffles/eligibility.ts`): saldo mayor a cero, ya
 * vencido y sin el arrastre del sistema anterior (`APERTURA`), que para parte del padrón no
 * reconcilia. Con una excepción: el INGRESO (el alta) impago cuenta aunque no haya vencido; ver
 * `countsAsDebt`. Mandar un correo URGENTE por una cuota mensual que todavía no venció, o por
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

export type PendingCharge = {
  memberId: string;
  balanceMinor: number;
  period: string;
  /** `MembershipChargeConcept` como texto: INGRESO | MENSUAL | EXTRAORDINARIA | OTRO. */
  concept: string;
  dueDate: Date;
};

/**
 * ¿Esta cuota cuenta como deuda para el aviso? Nunca el arrastre de APERTURA. Un ingreso (el alta)
 * impago cuenta siempre, aunque no haya vencido: es justo el caso que hay que perseguir. El resto,
 * sólo si ya venció.
 */
export function countsAsDebt(c: PendingCharge, now: Date): boolean {
  if (c.balanceMinor <= 0 || c.period === APERTURA_PERIOD) return false;
  if (c.concept === "INGRESO") return true;
  return c.dueDate.getTime() < now.getTime();
}

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
  /**
   * Último aviso que le llegó: el envío de la invitación vigente (sin cuenta) o el último aviso
   * urgente de cuotas que salió (con cuenta). `null` si nunca.
   */
  lastNoticeAt: Date | null;
};

export const URGENT_DEBT_TEMPLATE_KEY = "commission-urgent-debt";

/** No se repite el aviso antes de esto: dos correos URGENTES el mismo día son spam. */
export const NOTICE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type NoticeHistory = {
  /** memberId → envío de la invitación vigente más reciente. */
  invitationSentAt: Map<string, Date>;
  /** correo (en minúsculas) → último aviso urgente de cuotas que salió. */
  debtNoticeSentAt: Map<string, Date>;
};

const AR = "America/Argentina/Buenos_Aires";
const fechaAr = new Intl.DateTimeFormat("es-AR", { timeZone: AR, day: "2-digit", month: "2-digit" });
const horaAr = new Intl.DateTimeFormat("es-AR", { timeZone: AR, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "06/10" y "14:30", en hora argentina. */
export function formatNoticeMoment(d: Date): { fecha: string; hora: string } {
  // Por partes: con sólo día y mes, es-AR ignora el "2-digit" del día y escribe "6/10".
  const parts = fechaAr.formatToParts(d);
  const dos = (type: string) => (parts.find((p) => p.type === type)?.value ?? "").padStart(2, "0");
  return { fecha: `${dos("day")}/${dos("month")}`, hora: horaAr.format(d) };
}

/** Si el último aviso fue hace menos de 24 h, el motivo para no repetirlo. */
export function recentNoticeReason(lastNoticeAt: Date | null, now: Date): string | null {
  if (!lastNoticeAt || now.getTime() - lastNoticeAt.getTime() >= NOTICE_COOLDOWN_MS) return null;
  const { fecha, hora } = formatNoticeMoment(lastNoticeAt);
  return `Ya se le avisó el ${fecha} a las ${hora}`;
}

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
  notices: NoticeHistory = { invitationSentAt: new Map(), debtNoticeSentAt: new Map() },
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
    if (!countsAsDebt(c, now)) continue;
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
    // En minúsculas, como lo guarda la invitación: así se cruza con el registro de envíos.
    const email = (member.email?.trim() || member.accountEmail?.trim() || "").toLowerCase() || null;
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
      lastNoticeAt: needsInvitation(reason)
        ? notices.invitationSentAt.get(member.id) ?? null
        : email
          ? notices.debtNoticeSentAt.get(email) ?? null
          : null,
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
      OR: [{ concept: "INGRESO" }, { dueDate: { lt: now } }],
    },
    select: { memberId: true, balanceArs: true, period: true, concept: true, dueDate: true },
  });

  const emails = Array.from(
    new Set(
      periods
        .filter((p) => p.member && isAssignmentActive(p, now))
        .map((p) => (p.member as PendingMember))
        .map((m) => (m.email?.trim() || m.accountEmail?.trim() || "").toLowerCase())
        .filter((e) => e.length > 0),
    ),
  );
  const [invitations, logs] = await Promise.all([
    prisma.memberInvitation.findMany({
      where: {
        workspaceId,
        memberId: { in: memberIds },
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        sentAt: { not: null },
      },
      select: { memberId: true, sentAt: true },
    }),
    emails.length > 0
      ? prisma.sentEmailLog.findMany({
          where: { templateKey: URGENT_DEBT_TEMPLATE_KEY, status: "SENT", to: { in: emails } },
          select: { to: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  const notices: NoticeHistory = { invitationSentAt: new Map(), debtNoticeSentAt: new Map() };
  for (const i of invitations) {
    if (!i.sentAt) continue;
    const prev = notices.invitationSentAt.get(i.memberId);
    if (!prev || prev < i.sentAt) notices.invitationSentAt.set(i.memberId, i.sentAt);
  }
  for (const l of logs) {
    const key = l.to.toLowerCase();
    const prev = notices.debtNoticeSentAt.get(key);
    if (!prev || prev < l.createdAt) notices.debtNoticeSentAt.set(key, l.createdAt);
  }

  return groupPendingIntegrants(
    periods,
    charges.map((c) => ({
      memberId: c.memberId,
      balanceMinor: decimalArsToMinor(c.balanceArs),
      period: c.period,
      concept: c.concept,
      dueDate: c.dueDate,
    })),
    now,
    notices,
  );
}
