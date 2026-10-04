import { beforeEach, describe, expect, it, vi } from "vitest";

const { portfolio, member, photo, moduleEnabledMock, balanceMock } = vi.hoisted(() => ({
  portfolio: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  member: { findFirst: vi.fn() },
  photo: { count: vi.fn() },
  moduleEnabledMock: vi.fn(),
  balanceMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeMemberPortfolio: portfolio,
    fotofficeMemberPortfolioPhoto: photo,
    member,
  },
}));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: moduleEnabledMock }));
vi.mock("@/lib/membership/balance", () => ({ loadMemberBalance: balanceMock }));

const { ensurePortfolio, loadPortfolioForMember } = await import("./repository");

describe("ensurePortfolio", () => {
  beforeEach(() => {
    portfolio.findUnique.mockReset();
    portfolio.findMany.mockReset();
    portfolio.create.mockReset();
  });

  it("si ya existe, lo devuelve sin crear nada", async () => {
    portfolio.findUnique.mockResolvedValueOnce({ id: "p1", publicSlug: "juan-perez" });
    const r = await ensurePortfolio({
      workspaceId: "ws-1",
      memberId: "m-1",
      firstName: "Juan",
      lastName: "Pérez",
    });
    expect(r).toEqual({ id: "p1", publicSlug: "juan-perez" });
    expect(portfolio.create).not.toHaveBeenCalled();
  });

  it("si no existe, lo crea con el slug derivado del nombre", async () => {
    portfolio.findUnique.mockResolvedValueOnce(null);
    portfolio.findMany.mockResolvedValueOnce([]);
    portfolio.create.mockResolvedValueOnce({ id: "p2", publicSlug: "juan-perez" });
    await ensurePortfolio({
      workspaceId: "ws-1",
      memberId: "m-1",
      firstName: "Juan",
      lastName: "Pérez",
    });
    expect(portfolio.create).toHaveBeenCalledWith({
      data: { workspaceId: "ws-1", memberId: "m-1", publicSlug: "juan-perez" },
      select: { id: true, publicSlug: true },
    });
  });

  it("desambigua contra los slugs ya tomados en esa institución", async () => {
    portfolio.findUnique.mockResolvedValueOnce(null);
    portfolio.findMany.mockResolvedValueOnce([{ publicSlug: "juan-perez" }]);
    portfolio.create.mockResolvedValueOnce({ id: "p3", publicSlug: "juan-perez-2" });
    await ensurePortfolio({
      workspaceId: "ws-1",
      memberId: "m-9",
      firstName: "Juan",
      lastName: "Pérez",
    });
    expect(portfolio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publicSlug: "juan-perez-2" }),
      }),
    );
  });

  it("los slugs tomados se buscan sólo dentro del workspace: dos instituciones no colisionan", async () => {
    portfolio.findUnique.mockResolvedValueOnce(null);
    portfolio.findMany.mockResolvedValueOnce([]);
    portfolio.create.mockResolvedValueOnce({ id: "p4", publicSlug: "juan-perez" });
    await ensurePortfolio({
      workspaceId: "ws-2",
      memberId: "m-1",
      firstName: "Juan",
      lastName: "Pérez",
    });
    expect(portfolio.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-2" },
      select: { publicSlug: true },
    });
  });

  it("si dos pestañas crean a la vez, el choque de slug se reintenta una vez", async () => {
    portfolio.findUnique.mockResolvedValueOnce(null);
    portfolio.findMany
      .mockResolvedValueOnce([])
      // El segundo intento ya ve el slug que escribió la otra pestaña.
      .mockResolvedValueOnce([{ publicSlug: "juan-perez" }]);
    portfolio.create
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockResolvedValueOnce({ id: "p5", publicSlug: "juan-perez-2" });

    const r = await ensurePortfolio({
      workspaceId: "ws-1",
      memberId: "m-2",
      firstName: "Juan",
      lastName: "Pérez",
    });
    expect(r.publicSlug).toBe("juan-perez-2");
    expect(portfolio.create).toHaveBeenCalledTimes(2);
  });

  it("un error que no es choque de unicidad no se reintenta: se propaga", async () => {
    portfolio.findUnique.mockResolvedValueOnce(null);
    portfolio.findMany.mockResolvedValueOnce([]);
    portfolio.create.mockRejectedValueOnce(Object.assign(new Error("caída"), { code: "P1001" }));
    await expect(
      ensurePortfolio({
        workspaceId: "ws-1",
        memberId: "m-3",
        firstName: "Juan",
        lastName: "Pérez",
      }),
    ).rejects.toThrow("caída");
    expect(portfolio.create).toHaveBeenCalledTimes(1);
  });
});

describe("loadPortfolioForMember", () => {
  beforeEach(() => {
    portfolio.findUnique.mockReset();
    member.findFirst.mockReset();
    photo.count.mockReset();
    moduleEnabledMock.mockReset();
    balanceMock.mockReset();
  });

  const prepararAlAire = () => {
    moduleEnabledMock.mockResolvedValue(true);
    member.findFirst.mockResolvedValue({ status: "ACTIVE", directoryOptIn: true });
    balanceMock.mockResolvedValue({ overdueCount: 0 });
    portfolio.findUnique.mockResolvedValue({
      id: "p1",
      publicSlug: "juan-perez",
      memberPublished: true,
      coverPhotoId: "f2",
      hiddenByAdminAt: null,
      adminForcePublish: false,
      photos: [
        { id: "f1", url: "u1", width: 2400, height: 1600, order: 0, title: null, year: null },
        { id: "f2", url: "u2", width: 1600, height: 2400, order: 1, title: "Retrato", year: 2024 },
      ],
    });
  };

  it("junta los siete hechos y contesta que se ve", async () => {
    prepararAlAire();
    const r = await loadPortfolioForMember({ workspaceId: "ws-1", memberId: "m-1" });
    expect(r.visibility).toEqual({ visible: true });
    expect(r.photos).toHaveLength(2);
  });

  it("marca cuál es la foto destacada, no la deja adivinar a la pantalla", async () => {
    prepararAlAire();
    const r = await loadPortfolioForMember({ workspaceId: "ws-1", memberId: "m-1" });
    expect(r.photos.find((f) => f.isCover)?.id).toBe("f2");
    expect(r.photos.filter((f) => f.isCover)).toHaveLength(1);
  });

  it("devuelve las fotos en el orden que eligió la persona", async () => {
    prepararAlAire();
    const r = await loadPortfolioForMember({ workspaceId: "ws-1", memberId: "m-1" });
    expect(r.photos.map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("sin consentimiento, el motivo llega hasta la pantalla", async () => {
    prepararAlAire();
    member.findFirst.mockResolvedValue({ status: "ACTIVE", directoryOptIn: false });
    const r = await loadPortfolioForMember({ workspaceId: "ws-1", memberId: "m-1" });
    expect(r.visibility).toEqual({ visible: false, reason: "NO_CONSENT" });
  });

  it("con deuda por encima del umbral, el motivo es la deuda", async () => {
    prepararAlAire();
    balanceMock.mockResolvedValue({ overdueCount: 4 });
    const r = await loadPortfolioForMember({ workspaceId: "ws-1", memberId: "m-1" });
    expect(r.visibility).toEqual({ visible: false, reason: "OVERDUE_DUES" });
  });

  it("si la institución lo publicó igual, la deuda no lo baja", async () => {
    prepararAlAire();
    balanceMock.mockResolvedValue({ overdueCount: 4 });
    portfolio.findUnique.mockResolvedValue({
      id: "p1",
      publicSlug: "juan-perez",
      memberPublished: true,
      coverPhotoId: "f1",
      hiddenByAdminAt: null,
      adminForcePublish: true,
      photos: [
        { id: "f1", url: "u1", width: 2400, height: 1600, order: 0, title: null, year: null },
      ],
    });
    const r = await loadPortfolioForMember({ workspaceId: "ws-1", memberId: "m-1" });
    expect(r.visibility).toEqual({ visible: true });
  });

  it("sin portfolio todavía, contesta que no hay fotos en lugar de romper", async () => {
    moduleEnabledMock.mockResolvedValue(true);
    member.findFirst.mockResolvedValue({ status: "ACTIVE", directoryOptIn: true });
    balanceMock.mockResolvedValue({ overdueCount: 0 });
    portfolio.findUnique.mockResolvedValue(null);
    const r = await loadPortfolioForMember({ workspaceId: "ws-1", memberId: "m-1" });
    expect(r.visibility).toEqual({ visible: false, reason: "NO_PHOTOS" });
    expect(r.photos).toEqual([]);
    expect(r.id).toBeNull();
  });

  it("la ficha se busca dentro del workspace, no sólo por id de socio", async () => {
    prepararAlAire();
    await loadPortfolioForMember({ workspaceId: "ws-1", memberId: "m-1" });
    expect(member.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m-1", workspaceId: "ws-1" } }),
    );
  });
});
