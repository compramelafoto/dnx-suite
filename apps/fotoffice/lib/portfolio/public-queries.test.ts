import { beforeEach, describe, expect, it, vi } from "vitest";

const { portfolio, charge, moduleEnabledMock } = vi.hoisted(() => ({
  portfolio: { findMany: vi.fn(), findFirst: vi.fn() },
  charge: { groupBy: vi.fn() },
  moduleEnabledMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: { fotofficeMemberPortfolio: portfolio, membershipCharge: charge },
}));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: moduleEnabledMock }));

const { loadPublicDirectory, loadPublicPortfolio } = await import("./public-queries");

/** Una fila que cumple todo. Cada test rompe una sola cosa. */
function filaAlAire(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    publicSlug: "juan-perez",
    memberId: "m-1",
    memberPublished: true,
    hiddenByAdminAt: null,
    adminForcePublish: false,
    coverPhotoId: "f1",
    member: {
      firstName: "Juan",
      lastName: "Pérez",
      status: "ACTIVE",
      directoryOptIn: true,
      businessName: "Estudio Pérez",
      businessLogoUrl: "https://cdn.example/logo-perez.png",
      specialties: ["retrato"],
      bio: "Hago retratos.",
      website: "https://perez.example",
      instagram: "perezfoto",
      tiktok: null,
      facebook: null,
      youtube: null,
      linkedin: null,
      profilePhotoUrl: null,
    },
    coverPhoto: { url: "u1", width: 2400, height: 1600 },
    photos: [
      {
        id: "f1",
        url: "u1",
        width: 2400,
        height: 1600,
        order: 0,
        title: null,
        year: null,
      },
    ],
    _count: { photos: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  portfolio.findMany.mockReset();
  portfolio.findFirst.mockReset();
  charge.groupBy.mockReset();
  moduleEnabledMock.mockReset();
  moduleEnabledMock.mockResolvedValue(true);
  charge.groupBy.mockResolvedValue([]);
});

describe("loadPublicDirectory — qué NO se lista", () => {
  it("con el módulo apagado no lista a nadie, ni consulta la base", async () => {
    moduleEnabledMock.mockResolvedValue(false);
    expect(await loadPublicDirectory("ws-1")).toEqual([]);
    expect(portfolio.findMany).not.toHaveBeenCalled();
  });

  it("no lista a quien no dio consentimiento", async () => {
    portfolio.findMany.mockResolvedValue([
      filaAlAire({ member: { ...filaAlAire().member, directoryOptIn: false } }),
    ]);
    expect(await loadPublicDirectory("ws-1")).toEqual([]);
  });

  it("no lista a quien no publicó su portfolio", async () => {
    portfolio.findMany.mockResolvedValue([filaAlAire({ memberPublished: false })]);
    expect(await loadPublicDirectory("ws-1")).toEqual([]);
  });

  it("no lista a quien no tiene fotos", async () => {
    portfolio.findMany.mockResolvedValue([
      filaAlAire({ photos: [], _count: { photos: 0 }, coverPhotoId: null, coverPhoto: null }),
    ]);
    expect(await loadPublicDirectory("ws-1")).toEqual([]);
  });

  it("no lista a quien está dado de baja", async () => {
    portfolio.findMany.mockResolvedValue([
      filaAlAire({ member: { ...filaAlAire().member, status: "INACTIVE" } }),
    ]);
    expect(await loadPublicDirectory("ws-1")).toEqual([]);
  });

  it("no lista a quien está suspendido", async () => {
    portfolio.findMany.mockResolvedValue([
      filaAlAire({ member: { ...filaAlAire().member, status: "SUSPENDED" } }),
    ]);
    expect(await loadPublicDirectory("ws-1")).toEqual([]);
  });

  it("no lista a quien tiene 3 cargos vencidos", async () => {
    portfolio.findMany.mockResolvedValue([filaAlAire()]);
    charge.groupBy.mockResolvedValue([{ memberId: "m-1", _count: { _all: 3 } }]);
    expect(await loadPublicDirectory("ws-1")).toEqual([]);
  });

  it("no lista un portfolio bajado por la institución", async () => {
    portfolio.findMany.mockResolvedValue([filaAlAire({ hiddenByAdminAt: new Date() })]);
    expect(await loadPublicDirectory("ws-1")).toEqual([]);
  });
});

describe("loadPublicDirectory — qué sí se lista", () => {
  it("lista a quien cumple las siete condiciones", async () => {
    portfolio.findMany.mockResolvedValue([filaAlAire()]);
    const r = await loadPublicDirectory("ws-1");
    expect(r).toHaveLength(1);
    expect(r[0].publicSlug).toBe("juan-perez");
    expect(r[0].displayName).toBe("Juan Pérez");
    expect(r[0].businessName).toBe("Estudio Pérez");
  });

  it("con 2 cargos vencidos todavía se lista: el umbral es 3", async () => {
    portfolio.findMany.mockResolvedValue([filaAlAire()]);
    charge.groupBy.mockResolvedValue([{ memberId: "m-1", _count: { _all: 2 } }]);
    expect(await loadPublicDirectory("ws-1")).toHaveLength(1);
  });

  it("sí lista a quien debe pero la institución publicó igual", async () => {
    portfolio.findMany.mockResolvedValue([filaAlAire({ adminForcePublish: true })]);
    charge.groupBy.mockResolvedValue([{ memberId: "m-1", _count: { _all: 7 } }]);
    expect(await loadPublicDirectory("ws-1")).toHaveLength(1);
  });

  it("lleva la foto destacada con su alto y ancho, para que la grilla no salte", async () => {
    portfolio.findMany.mockResolvedValue([filaAlAire()]);
    const r = await loadPublicDirectory("ws-1");
    expect(r[0].coverUrl).toBe("u1");
    expect(r[0].coverWidth).toBe(2400);
    expect(r[0].coverHeight).toBe(1600);
  });

  it("ordena alfabéticamente por apellido", async () => {
    portfolio.findMany.mockResolvedValue([
      filaAlAire({
        publicSlug: "zoe-zapata",
        memberId: "m-2",
        member: { ...filaAlAire().member, firstName: "Zoe", lastName: "Zapata" },
      }),
      filaAlAire({
        publicSlug: "ana-alvarez",
        memberId: "m-3",
        member: { ...filaAlAire().member, firstName: "Ana", lastName: "Álvarez" },
      }),
      filaAlAire(),
    ]);
    const r = await loadPublicDirectory("ws-1");
    expect(r.map((e) => e.publicSlug)).toEqual(["ana-alvarez", "juan-perez", "zoe-zapata"]);
  });

  it("los cargos vencidos se cuentan en UNA consulta para todo el workspace", async () => {
    portfolio.findMany.mockResolvedValue([filaAlAire(), filaAlAire({ memberId: "m-2" })]);
    await loadPublicDirectory("ws-1");
    // Un directorio de 150 personas no puede hacer 150 viajes a la base.
    expect(charge.groupBy).toHaveBeenCalledTimes(1);
  });
});

describe("el logo de la empresa", () => {
  it("la ficha lo expone, para que el estudio se vea identificado", async () => {
    portfolio.findFirst.mockResolvedValue(filaAlAire());
    const r = await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "juan-perez" });
    expect(r?.businessLogoUrl).toBe("https://cdn.example/logo-perez.png");
  });

  it("quien no subió logo no rompe la ficha", async () => {
    portfolio.findFirst.mockResolvedValue(
      filaAlAire({ member: { ...filaAlAire().member, businessLogoUrl: null } }),
    );
    const r = await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "juan-perez" });
    expect(r?.businessLogoUrl).toBeNull();
  });

  it("el directorio NO lo trae: la grilla es obra, no una pared de logos", async () => {
    portfolio.findMany.mockResolvedValue([filaAlAire()]);
    const [entrada] = await loadPublicDirectory("ws-1");
    expect(entrada).not.toHaveProperty("businessLogoUrl");
  });
});

describe("loadPublicPortfolio", () => {
  it("devuelve la ficha de quien está al aire", async () => {
    portfolio.findFirst.mockResolvedValue(filaAlAire());
    const r = await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "juan-perez" });
    expect(r?.displayName).toBe("Juan Pérez");
    expect(r?.photos).toHaveLength(1);
  });

  it("devuelve null si no está publicado: no hay puerta lateral", async () => {
    portfolio.findFirst.mockResolvedValue(filaAlAire({ memberPublished: false }));
    expect(await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "juan-perez" })).toBeNull();
  });

  it("devuelve null si lo bajó la institución", async () => {
    portfolio.findFirst.mockResolvedValue(filaAlAire({ hiddenByAdminAt: new Date() }));
    expect(await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "juan-perez" })).toBeNull();
  });

  it("devuelve null si retiró el consentimiento", async () => {
    portfolio.findFirst.mockResolvedValue(
      filaAlAire({ member: { ...filaAlAire().member, directoryOptIn: false } }),
    );
    expect(await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "juan-perez" })).toBeNull();
  });

  it("devuelve null con el módulo apagado, sin consultar la base", async () => {
    moduleEnabledMock.mockResolvedValue(false);
    expect(await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "juan-perez" })).toBeNull();
    expect(portfolio.findFirst).not.toHaveBeenCalled();
  });

  it("devuelve null si el slug no existe", async () => {
    portfolio.findFirst.mockResolvedValue(null);
    expect(await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "nadie" })).toBeNull();
  });

  it("busca dentro del workspace: un slug de otra institución no abre", async () => {
    portfolio.findFirst.mockResolvedValue(null);
    await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "juan-perez" });
    expect(portfolio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws-1", publicSlug: "juan-perez" },
      }),
    );
  });

  it("trae las fotos en el orden que eligió la persona", async () => {
    portfolio.findFirst.mockResolvedValue(filaAlAire());
    await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "juan-perez" });
    const select = portfolio.findFirst.mock.calls[0][0].select;
    expect(select.photos.orderBy).toEqual({ order: "asc" });
  });

  it("no expone nada que el socio no haya aceptado publicar", async () => {
    portfolio.findFirst.mockResolvedValue(filaAlAire());
    const r = await loadPublicPortfolio({ workspaceId: "ws-1", publicSlug: "juan-perez" });
    const serializado = JSON.stringify(r);
    // Ni número de socio, ni documento, ni email, ni teléfono.
    expect(serializado).not.toMatch(/memberNumber|documentNumber|"email"|"phone"/);
  });
});
