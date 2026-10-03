import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  portfolio,
  photo,
  member,
  txMock,
  authMock,
  portalMock,
  moduleEnabledMock,
  ensureMock,
  verifyMock,
  deleteR2Mock,
  revalidateMock,
} = vi.hoisted(() => ({
  portfolio: { findFirst: vi.fn(), update: vi.fn() },
  photo: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  member: { findFirst: vi.fn() },
  txMock: vi.fn(),
  authMock: vi.fn(),
  portalMock: vi.fn(),
  moduleEnabledMock: vi.fn(),
  ensureMock: vi.fn(),
  verifyMock: vi.fn(),
  deleteR2Mock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeMemberPortfolio: portfolio,
    fotofficeMemberPortfolioPhoto: photo,
    member,
    $transaction: txMock,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));
vi.mock("@/lib/auth", () => ({ requireAuth: authMock }));
vi.mock("@/lib/portal/access", () => ({ loadPortalContext: portalMock }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: moduleEnabledMock }));
vi.mock("@/lib/portfolio/repository", () => ({ ensurePortfolio: ensureMock }));
vi.mock("@/lib/images/r2-presign", () => ({ verifyUploadedImage: verifyMock }));
vi.mock("@/lib/images/r2-client", () => ({
  deleteFotofficeR2Object: deleteR2Mock,
  getFotofficeR2PublicUrl: (k: string) => `https://cdn.example/${k}`,
}));

const acciones = await import("./portfolio");

const CONTEXTO = {
  member: { id: "m-1", firstName: "Juan", lastName: "Pérez" },
  workspace: { id: "ws-1", name: "SFPR" },
};
const KEY = "fotoffice/member-portfolio/ws-1/abc.jpg";

beforeEach(() => {
  for (const m of [
    ...Object.values(portfolio),
    ...Object.values(photo),
    ...Object.values(member),
    txMock,
    authMock,
    portalMock,
    moduleEnabledMock,
    ensureMock,
    verifyMock,
    deleteR2Mock,
    revalidateMock,
  ]) {
    (m as ReturnType<typeof vi.fn>).mockReset();
  }
  authMock.mockResolvedValue({ id: 7 });
  portalMock.mockResolvedValue(CONTEXTO);
  moduleEnabledMock.mockResolvedValue(true);
  ensureMock.mockResolvedValue({ id: "p1", publicSlug: "juan-perez" });
  // Por defecto la transacción corre el callback con el mismo cliente simulado.
  txMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({ fotofficeMemberPortfolio: portfolio, fotofficeMemberPortfolioPhoto: photo }),
  );
});

describe("registerPortfolioPhotoAction", () => {
  it("sin ficha de socio no escribe nada", async () => {
    portalMock.mockResolvedValue(null);
    const r = await acciones.registerPortfolioPhotoAction({ key: KEY, width: 2400, height: 1600 });
    expect(r.ok).toBe(false);
    expect(photo.create).not.toHaveBeenCalled();
  });

  it("rechaza una foto que no pasó la verificación del objeto subido", async () => {
    photo.count.mockResolvedValue(0);
    verifyMock.mockResolvedValue({ ok: false, error: "no es una imagen" });
    const r = await acciones.registerPortfolioPhotoAction({ key: KEY, width: 2400, height: 1600 });
    expect(r.ok).toBe(false);
    expect(photo.create).not.toHaveBeenCalled();
  });

  it("un archivo rechazado no queda ocupando lugar en R2", async () => {
    photo.count.mockResolvedValue(0);
    verifyMock.mockResolvedValue({ ok: false, error: "no es una imagen" });
    await acciones.registerPortfolioPhotoAction({ key: KEY, width: 2400, height: 1600 });
    expect(deleteR2Mock).toHaveBeenCalledWith(KEY);
  });

  it("la primera foto queda destacada automáticamente", async () => {
    photo.count.mockResolvedValue(0);
    verifyMock.mockResolvedValue({ ok: true, sizeBytes: 1000, contentType: "image/jpeg" });
    photo.create.mockResolvedValue({ id: "f1" });
    const r = await acciones.registerPortfolioPhotoAction({ key: KEY, width: 2400, height: 1600 });
    expect(r.ok).toBe(true);
    expect(portfolio.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { coverPhotoId: "f1" } }),
    );
  });

  it("la segunda foto no le roba la destacada a la primera", async () => {
    photo.count.mockResolvedValue(1);
    verifyMock.mockResolvedValue({ ok: true, sizeBytes: 1000, contentType: "image/jpeg" });
    photo.create.mockResolvedValue({ id: "f2" });
    await acciones.registerPortfolioPhotoAction({ key: KEY, width: 2400, height: 1600 });
    expect(portfolio.update).not.toHaveBeenCalled();
  });

  it("respeta el tope: con 20 fotos no registra ni verifica", async () => {
    photo.count.mockResolvedValue(20);
    const r = await acciones.registerPortfolioPhotoAction({ key: KEY, width: 2400, height: 1600 });
    expect(r.ok).toBe(false);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(photo.create).not.toHaveBeenCalled();
  });

  it("rechaza una key fuera del namespace de FotoOffice", async () => {
    photo.count.mockResolvedValue(0);
    const r = await acciones.registerPortfolioPhotoAction({
      key: "albums/9/robada.jpg",
      width: 2400,
      height: 1600,
    });
    expect(r.ok).toBe(false);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("rechaza una key del namespace correcto pero de OTRA institución", async () => {
    photo.count.mockResolvedValue(0);
    const r = await acciones.registerPortfolioPhotoAction({
      key: "fotoffice/member-portfolio/ws-OTRO/abc.jpg",
      width: 2400,
      height: 1600,
    });
    expect(r.ok).toBe(false);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("rechaza dimensiones que el cliente no pudo leer", async () => {
    photo.count.mockResolvedValue(0);
    const r = await acciones.registerPortfolioPhotoAction({ key: KEY, width: 0, height: 0 });
    expect(r.ok).toBe(false);
    expect(verifyMock).not.toHaveBeenCalled();
  });
});

describe("deletePortfolioPhotoAction", () => {
  it("una foto de otro socio no se borra, aunque se mande su id", async () => {
    photo.findFirst.mockResolvedValue(null);
    const r = await acciones.deletePortfolioPhotoAction({ photoId: "de-otro" });
    expect(r.ok).toBe(false);
    expect(photo.delete).not.toHaveBeenCalled();
    expect(deleteR2Mock).not.toHaveBeenCalled();
  });

  it("la búsqueda de la foto filtra por el portfolio de la sesión", async () => {
    photo.findFirst.mockResolvedValue(null);
    await acciones.deletePortfolioPhotoAction({ photoId: "f9" });
    expect(photo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "f9", portfolioId: "p1" } }),
    );
  });

  it("borrar la destacada deja como destacada la primera que queda", async () => {
    photo.findFirst
      .mockResolvedValueOnce({ id: "f1", r2Key: KEY, portfolioId: "p1" })
      .mockResolvedValueOnce({ id: "f2" });
    portfolio.findFirst.mockResolvedValue({ id: "p1", coverPhotoId: "f1" });
    photo.delete.mockResolvedValue({});
    deleteR2Mock.mockResolvedValue({ ok: true });
    await acciones.deletePortfolioPhotoAction({ photoId: "f1" });
    expect(portfolio.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { coverPhotoId: "f2" } }),
    );
  });

  it("borrar la última foto deja el portfolio sin destacada", async () => {
    photo.findFirst
      .mockResolvedValueOnce({ id: "f1", r2Key: KEY, portfolioId: "p1" })
      .mockResolvedValueOnce(null);
    portfolio.findFirst.mockResolvedValue({ id: "p1", coverPhotoId: "f1" });
    photo.delete.mockResolvedValue({});
    deleteR2Mock.mockResolvedValue({ ok: true });
    await acciones.deletePortfolioPhotoAction({ photoId: "f1" });
    expect(portfolio.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { coverPhotoId: null } }),
    );
  });

  it("borrar una que no era la destacada no toca la destacada", async () => {
    photo.findFirst.mockResolvedValueOnce({ id: "f2", r2Key: KEY, portfolioId: "p1" });
    portfolio.findFirst.mockResolvedValue({ id: "p1", coverPhotoId: "f1" });
    photo.delete.mockResolvedValue({});
    deleteR2Mock.mockResolvedValue({ ok: true });
    await acciones.deletePortfolioPhotoAction({ photoId: "f2" });
    expect(portfolio.update).not.toHaveBeenCalled();
  });
});

describe("setPortfolioCoverAction", () => {
  it("no deja destacar una foto de otro portfolio", async () => {
    photo.findFirst.mockResolvedValue(null);
    const r = await acciones.setPortfolioCoverAction({ photoId: "de-otro" });
    expect(r.ok).toBe(false);
    expect(portfolio.update).not.toHaveBeenCalled();
  });

  it("destaca la foto propia", async () => {
    photo.findFirst.mockResolvedValue({ id: "f2" });
    portfolio.findFirst.mockResolvedValue({ id: "p1", coverPhotoId: "f1" });
    const r = await acciones.setPortfolioCoverAction({ photoId: "f2" });
    expect(r.ok).toBe(true);
    expect(portfolio.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { coverPhotoId: "f2" } }),
    );
  });
});

describe("reorderPortfolioPhotosAction", () => {
  it("sólo reordena fotos del portfolio de la sesión", async () => {
    photo.findMany.mockResolvedValue([{ id: "f1" }, { id: "f2" }]);
    photo.update.mockResolvedValue({});
    const r = await acciones.reorderPortfolioPhotosAction({
      orderedIds: ["f2", "f1", "de-otro"],
    });
    expect(r.ok).toBe(true);
    // Dos actualizaciones, no tres: el id ajeno se descarta.
    expect(photo.update).toHaveBeenCalledTimes(2);
  });

  it("el orden queda denso y arranca en 0", async () => {
    photo.findMany.mockResolvedValue([{ id: "f1" }, { id: "f2" }]);
    photo.update.mockResolvedValue({});
    await acciones.reorderPortfolioPhotosAction({ orderedIds: ["f2", "f1"] });
    const ordenes = photo.update.mock.calls.map((c) => [c[0].where.id, c[0].data.order]);
    expect(ordenes).toEqual([
      ["f2", 0],
      ["f1", 1],
    ]);
  });

  it("una lista vacía no hace nada y no falla", async () => {
    photo.findMany.mockResolvedValue([]);
    const r = await acciones.reorderPortfolioPhotosAction({ orderedIds: [] });
    expect(r.ok).toBe(true);
    expect(photo.update).not.toHaveBeenCalled();
  });
});

describe("updatePortfolioPhotoAction", () => {
  it("no deja editar el título de una foto ajena", async () => {
    photo.findFirst.mockResolvedValue(null);
    const r = await acciones.updatePortfolioPhotoAction({
      photoId: "de-otro",
      title: "mío",
      year: 2024,
    });
    expect(r.ok).toBe(false);
    expect(photo.update).not.toHaveBeenCalled();
  });

  it("rechaza un año imposible en lugar de guardarlo", async () => {
    photo.findFirst.mockResolvedValue({ id: "f1" });
    const r = await acciones.updatePortfolioPhotoAction({
      photoId: "f1",
      title: null,
      year: 99999,
    });
    expect(r.ok).toBe(false);
  });

  it("guarda título y año de la foto propia", async () => {
    photo.findFirst.mockResolvedValue({ id: "f1" });
    photo.update.mockResolvedValue({});
    const r = await acciones.updatePortfolioPhotoAction({
      photoId: "f1",
      title: "  Retrato  ",
      year: 2024,
    });
    expect(r.ok).toBe(true);
    expect(photo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: "Retrato", year: 2024 } }),
    );
  });

  it("un título vacío se guarda como nulo, no como cadena vacía", async () => {
    photo.findFirst.mockResolvedValue({ id: "f1" });
    photo.update.mockResolvedValue({});
    await acciones.updatePortfolioPhotoAction({ photoId: "f1", title: "   ", year: null });
    expect(photo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: null, year: null } }),
    );
  });
});

describe("la descripción para Google y los lectores de pantalla", () => {
  it("se guarda limpia de espacios de sobra", async () => {
    photo.findFirst.mockResolvedValue({ id: "f1" });
    photo.update.mockResolvedValue({});
    await acciones.updatePortfolioPhotoAction({
      photoId: "f1",
      title: null,
      year: null,
      altText: "  Novia   entrando\n a la iglesia  ",
    });
    expect(photo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ altText: "Novia entrando a la iglesia" }),
      }),
    );
  });

  it("vacía se guarda como nula, no como cadena vacía", async () => {
    photo.findFirst.mockResolvedValue({ id: "f1" });
    photo.update.mockResolvedValue({});
    await acciones.updatePortfolioPhotoAction({ photoId: "f1", title: null, year: null, altText: "   " });
    expect(photo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ altText: null }) }),
    );
  });

  it("una descripción larguísima se recorta en vez de perderse entera", async () => {
    photo.findFirst.mockResolvedValue({ id: "f1" });
    photo.update.mockResolvedValue({});
    await acciones.updatePortfolioPhotoAction({
      photoId: "f1",
      title: null,
      year: null,
      altText: "x".repeat(400),
    });
    const guardada = photo.update.mock.calls[0][0].data.altText as string;
    expect(guardada.length).toBe(180);
  });

  it("si no viene en la llamada, no se borra la que había", async () => {
    photo.findFirst.mockResolvedValue({ id: "f1" });
    photo.update.mockResolvedValue({});
    await acciones.updatePortfolioPhotoAction({ photoId: "f1", title: "Retrato", year: 2024 });
    expect(photo.update.mock.calls[0][0].data).not.toHaveProperty("altText");
  });
});

describe("setPortfolioPublishedAction", () => {
  it("publicar sin consentimiento no prende el interruptor", async () => {
    member.findFirst.mockResolvedValue({ directoryOptIn: false });
    photo.count.mockResolvedValue(3);
    const r = await acciones.setPortfolioPublishedAction({ published: true });
    expect(r.ok).toBe(false);
    expect(portfolio.update).not.toHaveBeenCalled();
  });

  it("publicar sin fotos tampoco", async () => {
    member.findFirst.mockResolvedValue({ directoryOptIn: true });
    photo.count.mockResolvedValue(0);
    const r = await acciones.setPortfolioPublishedAction({ published: true });
    expect(r.ok).toBe(false);
    expect(portfolio.update).not.toHaveBeenCalled();
  });

  it("con consentimiento y fotos, publica", async () => {
    member.findFirst.mockResolvedValue({ directoryOptIn: true });
    photo.count.mockResolvedValue(3);
    portfolio.update.mockResolvedValue({});
    const r = await acciones.setPortfolioPublishedAction({ published: true });
    expect(r.ok).toBe(true);
    expect(portfolio.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ memberPublished: true }),
      }),
    );
  });

  it("despublicar no exige nada: bajarse del sitio es siempre posible", async () => {
    member.findFirst.mockResolvedValue({ directoryOptIn: false });
    photo.count.mockResolvedValue(0);
    portfolio.update.mockResolvedValue({});
    const r = await acciones.setPortfolioPublishedAction({ published: false });
    expect(r.ok).toBe(true);
    expect(portfolio.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { memberPublished: false } }),
    );
  });

  it("la primera publicación queda fechada; despublicar no borra esa fecha", async () => {
    member.findFirst.mockResolvedValue({ directoryOptIn: true });
    photo.count.mockResolvedValue(3);
    portfolio.update.mockResolvedValue({});
    await acciones.setPortfolioPublishedAction({ published: true });
    const data = portfolio.update.mock.calls[0][0].data;
    expect(data.memberPublishedAt).toBeInstanceOf(Date);
  });
});

describe("el módulo apagado cierra todas las acciones", () => {
  it("no se puede registrar una foto con el módulo apagado", async () => {
    moduleEnabledMock.mockResolvedValue(false);
    const r = await acciones.registerPortfolioPhotoAction({ key: KEY, width: 2400, height: 1600 });
    expect(r.ok).toBe(false);
  });

  it("no se puede publicar con el módulo apagado", async () => {
    moduleEnabledMock.mockResolvedValue(false);
    const r = await acciones.setPortfolioPublishedAction({ published: true });
    expect(r.ok).toBe(false);
  });
});
