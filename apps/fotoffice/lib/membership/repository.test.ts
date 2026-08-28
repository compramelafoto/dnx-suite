import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  appFindFirst: vi.fn(),
  appUpdateMany: vi.fn(),
  memberFindMany: vi.fn(),
  memberCreate: vi.fn(),
  chargeCreateMany: vi.fn(),
  settingsFindUnique: vi.fn(),
  feeFindFirst: vi.fn(),
  categoryFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  const tx = {
    member: { create: H.memberCreate },
    membershipCharge: { createMany: H.chargeCreateMany },
    membershipApplication: { updateMany: H.appUpdateMany },
  };
  return {
    ...actual,
    prisma: {
      membershipApplication: { findFirst: H.appFindFirst, updateMany: H.appUpdateMany },
      member: { findMany: H.memberFindMany },
      membershipDuesSettings: { findUnique: H.settingsFindUnique },
      membershipFeeValue: { findFirst: H.feeFindFirst },
      memberCategory: { findMany: H.categoryFindMany },
      $transaction: H.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx)),
    },
  };
});

const { Prisma } = await import("@repo/db");
const { approveApplication, rejectApplication } = await import("./repository");
const { ApprovalError } = await import("./approve");

const SOLICITUD = {
  id: "app-1",
  workspaceId: "ws-sfpr",
  firstName: "Ana",
  lastName: "Fotógrafa",
  email: "ana@test.com",
  declaredFeeScale: "PLENA",
  ownDuesAmount: null,
  originInstitution: null,
  avatarUrl: null,
  noticeAddress: "San Martín 1234",
  documentType: "DNI",
  documentNumber: "30111222",
  phone: null,
  taxId: null,
  city: null,
  province: null,
  postalCode: null,
  categoryId: "cat-1",
  status: "PENDIENTE",
};

beforeEach(() => {
  H.appFindFirst.mockReset().mockResolvedValue({ ...SOLICITUD });
  H.appUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  H.memberFindMany.mockReset().mockResolvedValue([{ memberNumber: "733" }]);
  H.memberCreate.mockReset().mockResolvedValue({ id: "m-1", memberNumber: "734" });
  H.chargeCreateMany.mockReset().mockResolvedValue({ count: 3 });
  H.settingsFindUnique.mockReset().mockResolvedValue(null);
  H.feeFindFirst.mockReset().mockResolvedValue({ id: "fv-1", amountArs: new Prisma.Decimal("10000") });
  H.categoryFindMany.mockReset().mockResolvedValue([
    { id: "cat-prof", name: "Profesional" },
    { id: "cat-est", name: "Estudiante" },
  ]);
  H.transaction.mockClear();
});

describe("approveApplication", () => {
  it("crea el socio con el número siguiente y genera los cargos", async () => {
    const r = await approveApplication({
      applicationId: "app-1",
      workspaceId: "ws-sfpr",
      resolvedByUserId: 7,
      now: new Date("2026-08-18T12:00:00Z"),
    });

    expect(r.memberNumber).toBe("734");
    expect(r.chargeCount).toBe(3);
    expect(r.totalArs).toBe("30000.00");
    expect(H.chargeCreateMany).toHaveBeenCalledTimes(1);
  });

  /** Socio, cargos y solicitud son un solo hecho: si no, quedaría un socio sin cuotas. */
  it("todo ocurre dentro de una transacción", async () => {
    await approveApplication({
      applicationId: "app-1",
      workspaceId: "ws-sfpr",
      resolvedByUserId: 7,
    });
    expect(H.transaction).toHaveBeenCalledTimes(1);
  });

  it("los cargos se crean con el id del socio recién creado", async () => {
    await approveApplication({
      applicationId: "app-1",
      workspaceId: "ws-sfpr",
      resolvedByUserId: 7,
    });
    const data = H.chargeCreateMany.mock.calls[0]?.[0]?.data;
    expect(data.every((c: { memberId: string }) => c.memberId === "m-1")).toBe(true);
  });

  /**
   * Segunda defensa contra la doble aprobación: si otra transacción ya resolvió la
   * solicitud, el updateMany no encuentra nada y la operación entera falla.
   */
  it("falla si otra persona resolvió la solicitud mientras tanto", async () => {
    H.appUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      approveApplication({ applicationId: "app-1", workspaceId: "ws-sfpr", resolvedByUserId: 7 }),
    ).rejects.toThrow(ApprovalError);
  });

  it("no aprueba una solicitud que ya estaba resuelta", async () => {
    H.appFindFirst.mockResolvedValue({ ...SOLICITUD, status: "APROBADA_IMPAGA" });
    await expect(
      approveApplication({ applicationId: "app-1", workspaceId: "ws-sfpr", resolvedByUserId: 7 }),
    ).rejects.toThrow(ApprovalError);
  });

  it("no aprueba si no hay valor de cuota configurado", async () => {
    H.feeFindFirst.mockResolvedValue(null);
    await expect(
      approveApplication({ applicationId: "app-1", workspaceId: "ws-sfpr", resolvedByUserId: 7 }),
    ).rejects.toThrow(/valor de la cuota/i);
  });

  it("no aprueba una solicitud inexistente", async () => {
    H.appFindFirst.mockResolvedValue(null);
    await expect(
      approveApplication({ applicationId: "x", workspaceId: "ws-sfpr", resolvedByUserId: 7 }),
    ).rejects.toThrow(ApprovalError);
  });

  /** Dos secretarios aprobando a la vez: uno choca contra el número y reintenta. */
  it("reintenta si el número de socio ya fue tomado", async () => {
    H.memberCreate
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockResolvedValueOnce({ id: "m-2", memberNumber: "735" });
    H.memberFindMany
      .mockResolvedValueOnce([{ memberNumber: "733" }])
      .mockResolvedValueOnce([{ memberNumber: "733" }, { memberNumber: "734" }]);

    const r = await approveApplication({
      applicationId: "app-1",
      workspaceId: "ws-sfpr",
      resolvedByUserId: 7,
    });
    expect(r.memberNumber).toBe("735");
  });

  it("un error que no es de unicidad no se reintenta", async () => {
    H.memberCreate.mockRejectedValue(Object.assign(new Error("db caida"), { code: "P1001" }));
    await expect(
      approveApplication({ applicationId: "app-1", workspaceId: "ws-sfpr", resolvedByUserId: 7 }),
    ).rejects.toThrow("db caida");
    expect(H.memberCreate).toHaveBeenCalledTimes(1);
  });
});

describe("rejectApplication", () => {
  it("rechaza guardando el motivo", async () => {
    await rejectApplication({
      applicationId: "app-1",
      workspaceId: "ws-sfpr",
      resolvedByUserId: 7,
      reason: "No acredita actividad profesional",
    });
    const call = H.appUpdateMany.mock.calls[0]?.[0];
    expect(call.data.status).toBe("RECHAZADA");
    expect(call.data.rejectionReason).toBe("No acredita actividad profesional");
  });

  /** Sin motivo la persona no sabe qué pasó ni qué corregir. */
  it.each(["", "   "])("exige un motivo (%s)", async (reason) => {
    await expect(
      rejectApplication({ applicationId: "app-1", workspaceId: "ws-sfpr", resolvedByUserId: 7, reason }),
    ).rejects.toThrow(/motivo/i);
    expect(H.appUpdateMany).not.toHaveBeenCalled();
  });

  it("solo rechaza solicitudes pendientes", async () => {
    H.appUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      rejectApplication({
        applicationId: "app-1",
        workspaceId: "ws-sfpr",
        resolvedByUserId: 7,
        reason: "motivo",
      }),
    ).rejects.toThrow(ApprovalError);
  });
});
