import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  db: {
    workspaceOfficeTerm: { findMany: vi.fn() },
    workspaceRoleAssignment: { findMany: vi.fn() },
    member: { findMany: vi.fn() },
    membershipCharge: { findMany: vi.fn() },
  },
}));
vi.mock("@repo/db", () => ({ prisma: H.db }));

const { groupPendingIntegrants, listPendingIntegrants, pendingReasonLabel } = await import("./urgent-notice");

const NOW = new Date("2026-10-06T12:00:00Z");
const AYER = new Date("2026-10-05T12:00:00Z");
const MANANA = new Date("2026-10-07T12:00:00Z");

type M = Parameters<typeof groupPendingIntegrants>[0][number]["member"];
function member(over: Partial<NonNullable<M>> = {}): NonNullable<M> {
  return {
    id: "m1",
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@test.com",
    status: "ACTIVE",
    userId: null,
    accountEmail: null,
    ...over,
  };
}
function period(over: Partial<Parameters<typeof groupPendingIntegrants>[0][number]> = {}) {
  return {
    kind: "office" as const,
    name: "Tesorería",
    order: 1,
    startsAt: null,
    endsAt: null,
    revokedAt: null,
    member: member(),
    ...over,
  };
}
function charge(over: Partial<Parameters<typeof groupPendingIntegrants>[1][number]> = {}) {
  return { memberId: "m1", balanceMinor: 1_200_000, period: "2026-09", dueDate: AYER, ...over };
}

describe("groupPendingIntegrants", () => {
  it("sin cuenta y sin deuda → SIN_CUENTA", () => {
    const [p] = groupPendingIntegrants([period()], [], NOW);
    expect(p).toMatchObject({
      memberId: "m1",
      name: "Ana Pérez",
      firstName: "Ana",
      email: "ana@test.com",
      hasEmail: true,
      officeName: "Tesorería",
      roleNames: [],
      reason: "SIN_CUENTA",
      pendingCount: 0,
      pendingTotalArs: 0,
      blocker: null,
    });
  });

  it("con cuenta y al día → no figura", () => {
    expect(groupPendingIntegrants([period({ member: member({ userId: 7 }) })], [], NOW)).toEqual([]);
  });

  it("con cuenta y deuda vencida → DEUDA, con cantidad y total", () => {
    const [p] = groupPendingIntegrants(
      [period({ member: member({ userId: 7 }) })],
      [charge(), charge({ period: "2026-08", balanceMinor: 600_050 })],
      NOW,
    );
    expect(p).toMatchObject({ reason: "DEUDA", pendingCount: 2, pendingTotalMinor: 1_800_050, pendingTotalArs: 18000.5 });
  });

  it("sin cuenta y con deuda → SIN_CUENTA_Y_DEUDA", () => {
    const [p] = groupPendingIntegrants([period()], [charge()], NOW);
    expect(p.reason).toBe("SIN_CUENTA_Y_DEUDA");
  });

  it("no cuenta la apertura, lo no vencido ni lo saldado, ni cuotas de otras personas", () => {
    const out = groupPendingIntegrants(
      [period({ member: member({ userId: 7 }) })],
      [
        charge({ period: "APERTURA" }),
        charge({ dueDate: MANANA }),
        charge({ balanceMinor: 0 }),
        charge({ memberId: "otra" }),
      ],
      NOW,
    );
    expect(out).toEqual([]);
  });

  it("sólo cuenta mandatos y roles vigentes hoy", () => {
    const out = groupPendingIntegrants(
      [
        period({ revokedAt: AYER }),
        period({ endsAt: AYER }),
        period({ startsAt: MANANA }),
        period({ member: null }),
      ],
      [],
      NOW,
    );
    expect(out).toEqual([]);
  });

  it("agrupa cargos y roles de la misma persona", () => {
    const [p, ...resto] = groupPendingIntegrants(
      [
        period({ kind: "role", name: "Vocal" }),
        period({ kind: "office", name: "Secretaría", order: 2 }),
        period({ kind: "office", name: "Presidencia", order: 0 }),
        period({ kind: "role", name: "Admin" }),
        period({ kind: "role", name: "Vocal" }),
      ],
      [],
      NOW,
    );
    expect(resto).toEqual([]);
    expect(p.officeName).toBe("Presidencia y Secretaría");
    expect(p.roleNames).toEqual(["Admin", "Vocal"]);
  });

  it("usa el correo de la cuenta si la ficha no tiene; sin ninguno, queda bloqueado", () => {
    const [a] = groupPendingIntegrants(
      [period({ member: member({ userId: 7, email: null, accountEmail: "cuenta@test.com" }) })],
      [charge()],
      NOW,
    );
    expect(a.email).toBe("cuenta@test.com");
    const [b] = groupPendingIntegrants([period({ member: member({ email: "  " }) })], [], NOW);
    expect(b).toMatchObject({ email: null, hasEmail: false, blocker: "No tiene correo cargado." });
  });

  it("una ficha que no está activa no puede recibir invitación", () => {
    const [p] = groupPendingIntegrants([period({ member: member({ status: "SUSPENDED" }) })], [], NOW);
    expect(p.blocker).toBe("La ficha no está activa: no se le puede mandar la invitación.");
    // Con cuenta y deuda, el estado no impide el aviso de pago.
    const [q] = groupPendingIntegrants(
      [period({ member: member({ status: "SUSPENDED", userId: 3 }) })],
      [charge()],
      NOW,
    );
    expect(q.blocker).toBeNull();
  });
});

describe("pendingReasonLabel", () => {
  it("dice el motivo en castellano", () => {
    expect(pendingReasonLabel({ reason: "SIN_CUENTA", pendingCount: 0, pendingTotalMinor: 0 })).toBe(
      "Sin cuenta activada",
    );
    expect(pendingReasonLabel({ reason: "DEUDA", pendingCount: 2, pendingTotalMinor: 2_400_000 })).toBe(
      "Con cuotas pendientes: 2 por $ 24.000",
    );
    expect(pendingReasonLabel({ reason: "SIN_CUENTA_Y_DEUDA", pendingCount: 1, pendingTotalMinor: 1_200_000 })).toBe(
      "Sin cuenta activada · Con cuotas pendientes: 1 por $ 12.000",
    );
  });
});

describe("listPendingIntegrants", () => {
  const MEMBER_ROW = {
    id: "m1",
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@test.com",
    status: "ACTIVE",
    userId: 7,
    user: { email: "cuenta@test.com" },
  };

  beforeEach(() => {
    for (const model of Object.values(H.db)) for (const fn of Object.values(model)) fn.mockReset();
    H.db.workspaceOfficeTerm.findMany.mockResolvedValue([]);
    H.db.workspaceRoleAssignment.findMany.mockResolvedValue([]);
    H.db.member.findMany.mockResolvedValue([]);
    H.db.membershipCharge.findMany.mockResolvedValue([]);
  });

  it("filtra todo por el workspace y resuelve la ficha de quien está anclado por cuenta", async () => {
    H.db.workspaceRoleAssignment.findMany.mockResolvedValue([
      { startsAt: null, endsAt: null, revokedAt: null, memberId: null, userId: 7, member: null, role: { name: "Vocal" } },
    ]);
    H.db.member.findMany.mockResolvedValue([MEMBER_ROW]);
    H.db.membershipCharge.findMany.mockResolvedValue([
      { memberId: "m1", balanceArs: { toString: () => "12000.00" }, period: "2026-09", dueDate: AYER },
    ]);

    const out = await listPendingIntegrants("ws-1", NOW);

    expect(H.db.workspaceOfficeTerm.findMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws-1", revokedAt: null });
    expect(H.db.workspaceRoleAssignment.findMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws-1", revokedAt: null });
    expect(H.db.member.findMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws-1", userId: { in: [7] } });
    expect(H.db.membershipCharge.findMany.mock.calls[0][0].where).toMatchObject({
      workspaceId: "ws-1",
      memberId: { in: ["m1"] },
    });
    expect(out).toEqual([
      expect.objectContaining({ memberId: "m1", reason: "DEUDA", roleNames: ["Vocal"], pendingTotalMinor: 1_200_000 }),
    ]);
  });

  it("sin nadie en la comisión no consulta cuotas", async () => {
    expect(await listPendingIntegrants("ws-1", NOW)).toEqual([]);
    expect(H.db.membershipCharge.findMany).not.toHaveBeenCalled();
  });
});
