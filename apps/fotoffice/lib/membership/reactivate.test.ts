import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  memberFindUnique: vi.fn(),
  memberUpdateMany: vi.fn(),
  chargeFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => {
  const tx = {
    member: { updateMany: H.memberUpdateMany },
    memberAudit: { create: H.auditCreate },
  };
  return {
    prisma: {
      member: { findUnique: H.memberFindUnique },
      membershipCharge: { findFirst: H.chargeFindFirst },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});
vi.mock("./generate-monthly", () => ({ generateMonthlyCharges: H.generate }));

const { reactivateIfDebtCleared, ensureCurrentPeriodCharge } = await import("./reactivate");

beforeEach(() => {
  H.memberFindUnique.mockReset().mockResolvedValue({
    id: "m-1",
    workspaceId: "ws-1",
    status: "INACTIVE",
    leftAt: new Date("2026-08-27T16:19:12.114Z"),
  });
  H.memberUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  H.auditCreate.mockReset().mockResolvedValue({});
  H.generate.mockReset().mockResolvedValue({});
  // Primera llamada: ¿debe algo? Segunda: ¿ya corrió la generación del mes?
  H.chargeFindFirst.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "c" });
});

describe("reactivateIfDebtCleared", () => {
  it("reactiva al de baja que quedó sin deuda, lo audita y le genera la cuota del mes", async () => {
    expect(await reactivateIfDebtCleared("m-1")).toBe("REACTIVATED");
    expect(H.memberUpdateMany).toHaveBeenCalledWith({
      where: { id: "m-1", status: "INACTIVE" },
      data: { status: "ACTIVE", leftAt: null },
    });
    expect(H.auditCreate.mock.calls[0]?.[0].data).toMatchObject({
      action: "STATUS_CHANGED",
      source: "SYSTEM",
      changesJson: { status: { before: "INACTIVE", after: "ACTIVE" } },
    });
    expect(H.generate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1", memberIds: ["m-1"] }),
    );
  });

  it("si todavía debe algo, sigue de baja", async () => {
    H.chargeFindFirst.mockReset().mockResolvedValue({ id: "c-viejo" });
    expect(await reactivateIfDebtCleared("m-1")).toBe("STILL_OWES");
    expect(H.memberUpdateMany).not.toHaveBeenCalled();
  });

  it("un socio activo que paga no se toca", async () => {
    H.memberFindUnique.mockResolvedValue({ id: "m-1", workspaceId: "ws-1", status: "ACTIVE", leftAt: null });
    expect(await reactivateIfDebtCleared("m-1")).toBe("NOT_INACTIVE");
    expect(H.memberUpdateMany).not.toHaveBeenCalled();
  });

  it("si la Secretaría lo reactivó mientras tanto, no duplica la auditoría", async () => {
    H.memberUpdateMany.mockResolvedValue({ count: 0 });
    expect(await reactivateIfDebtCleared("m-1")).toBe("NOT_INACTIVE");
    expect(H.auditCreate).not.toHaveBeenCalled();
    expect(H.generate).not.toHaveBeenCalled();
  });
});

describe("ensureCurrentPeriodCharge", () => {
  it("no genera nada si la institución todavía no generó este mes", async () => {
    H.chargeFindFirst.mockReset().mockResolvedValue(null);
    await ensureCurrentPeriodCharge({ workspaceId: "ws-1", memberId: "m-1", now: new Date("2026-10-05T15:00:00Z") });
    expect(H.generate).not.toHaveBeenCalled();
  });

  it("si ya corrió, genera sólo la de ese socio y ese mes", async () => {
    H.chargeFindFirst.mockReset().mockResolvedValue({ id: "c" });
    await ensureCurrentPeriodCharge({ workspaceId: "ws-1", memberId: "m-1", now: new Date("2026-10-05T15:00:00Z") });
    expect(H.generate).toHaveBeenCalledWith({ workspaceId: "ws-1", period: "2026-10", memberIds: ["m-1"] });
  });
});
