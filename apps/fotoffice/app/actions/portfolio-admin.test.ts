import { beforeEach, describe, expect, it, vi } from "vitest";

const { portfolio, audit, txMock, contextMock, revalidateMock } = vi.hoisted(() => ({
  portfolio: { findFirst: vi.fn(), update: vi.fn() },
  audit: { create: vi.fn() },
  txMock: vi.fn(),
  contextMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeMemberPortfolio: portfolio,
    memberAudit: audit,
    $transaction: txMock,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));
vi.mock("@/lib/portfolio/admin-access", () => ({ resolvePortfolioAdminContext: contextMock }));

const acciones = await import("./portfolio-admin");

const CONTEXTO = {
  user: { id: 7, name: "Secretaría", email: "sec@sfpr.test" },
  workspace: { id: "ws-1" },
};

const FILA = { id: "p1", memberId: "m-1", hiddenByAdminAt: null, adminForcePublish: false };

beforeEach(() => {
  portfolio.findFirst.mockReset();
  portfolio.update.mockReset();
  audit.create.mockReset();
  txMock.mockReset();
  contextMock.mockReset();
  revalidateMock.mockReset();
  contextMock.mockResolvedValue(CONTEXTO);
  portfolio.findFirst.mockResolvedValue(FILA);
  txMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({ fotofficeMemberPortfolio: portfolio, memberAudit: audit }),
  );
});

describe("hidePortfolioAction", () => {
  it("sin motivo no escribe nada", async () => {
    const r = await acciones.hidePortfolioAction({ portfolioId: "p1", reason: "   " });
    expect(r.ok).toBe(false);
    expect(portfolio.update).not.toHaveBeenCalled();
    expect(audit.create).not.toHaveBeenCalled();
  });

  it("baja el portfolio y guarda quién y por qué", async () => {
    const r = await acciones.hidePortfolioAction({
      portfolioId: "p1",
      reason: "Fotos de terceros sin permiso",
    });
    expect(r.ok).toBe(true);
    const data = portfolio.update.mock.calls[0][0].data;
    expect(data.hiddenByAdminAt).toBeInstanceOf(Date);
    expect(data.hiddenByAdminUserId).toBe(7);
    expect(data.hiddenReason).toBe("Fotos de terceros sin permiso");
  });

  it("registra PORTFOLIO_HIDDEN en el historial del socio", async () => {
    await acciones.hidePortfolioAction({ portfolioId: "p1", reason: "Un motivo" });
    const data = audit.create.mock.calls[0][0].data;
    expect(data.action).toBe("PORTFOLIO_HIDDEN");
    expect(data.memberId).toBe("m-1");
    expect(data.workspaceId).toBe("ws-1");
    expect(data.reason).toBe("Un motivo");
  });

  it("el origen es MANUAL: lo decide una persona, no un proceso", async () => {
    await acciones.hidePortfolioAction({ portfolioId: "p1", reason: "Un motivo" });
    expect(audit.create.mock.calls[0][0].data.source).toBe("MANUAL");
  });

  it("guarda el nombre del administrador, no sólo su id", async () => {
    await acciones.hidePortfolioAction({ portfolioId: "p1", reason: "Un motivo" });
    const data = audit.create.mock.calls[0][0].data;
    expect(data.actorUserId).toBe(7);
    expect(data.actorLabel).toBe("Secretaría");
  });

  it("el cambio y su auditoría van en la misma transacción", async () => {
    await acciones.hidePortfolioAction({ portfolioId: "p1", reason: "Un motivo" });
    expect(txMock).toHaveBeenCalledTimes(1);
  });

  it("un portfolio de otra institución no se baja, aunque se mande su id", async () => {
    portfolio.findFirst.mockResolvedValue(null);
    const r = await acciones.hidePortfolioAction({ portfolioId: "de-otro-ws", reason: "Un motivo" });
    expect(r.ok).toBe(false);
    expect(portfolio.update).not.toHaveBeenCalled();
  });

  it("la búsqueda filtra por el workspace de la sesión", async () => {
    await acciones.hidePortfolioAction({ portfolioId: "p1", reason: "Un motivo" });
    expect(portfolio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", workspaceId: "ws-1" } }),
    );
  });

  it("quien no puede administrar no baja nada", async () => {
    contextMock.mockResolvedValue(null);
    const r = await acciones.hidePortfolioAction({ portfolioId: "p1", reason: "Un motivo" });
    expect(r.ok).toBe(false);
    expect(portfolio.findFirst).not.toHaveBeenCalled();
  });
});

describe("restorePortfolioAction", () => {
  it("limpia los tres campos de la bajada", async () => {
    portfolio.findFirst.mockResolvedValue({ ...FILA, hiddenByAdminAt: new Date() });
    await acciones.restorePortfolioAction({ portfolioId: "p1", reason: "Se aclaró" });
    expect(portfolio.update.mock.calls[0][0].data).toEqual({
      hiddenByAdminAt: null,
      hiddenByAdminUserId: null,
      hiddenReason: null,
    });
  });

  it("registra PORTFOLIO_RESTORED", async () => {
    portfolio.findFirst.mockResolvedValue({ ...FILA, hiddenByAdminAt: new Date() });
    await acciones.restorePortfolioAction({ portfolioId: "p1", reason: "Se aclaró" });
    expect(audit.create.mock.calls[0][0].data.action).toBe("PORTFOLIO_RESTORED");
  });

  it("también exige motivo: volver a publicar algo también se explica", async () => {
    portfolio.findFirst.mockResolvedValue({ ...FILA, hiddenByAdminAt: new Date() });
    const r = await acciones.restorePortfolioAction({ portfolioId: "p1", reason: "" });
    expect(r.ok).toBe(false);
    expect(portfolio.update).not.toHaveBeenCalled();
  });
});

describe("forcePublishPortfolioAction", () => {
  it("prende el perdón de deuda y nada más", async () => {
    await acciones.forcePublishPortfolioAction({
      portfolioId: "p1",
      reason: "Pagó en efectivo, falta cargarlo",
      force: true,
    });
    // No toca la deuda, no toca el interruptor del socio, no lo despubica.
    expect(portfolio.update.mock.calls[0][0].data).toEqual({ adminForcePublish: true });
  });

  it("registra el perdón en el historial, con su motivo", async () => {
    await acciones.forcePublishPortfolioAction({
      portfolioId: "p1",
      reason: "Pagó en efectivo",
      force: true,
    });
    const data = audit.create.mock.calls[0][0].data;
    expect(data.action).toBe("PORTFOLIO_RESTORED");
    expect(data.reason).toContain("Pagó en efectivo");
  });

  it("se puede dar de baja el perdón", async () => {
    portfolio.findFirst.mockResolvedValue({ ...FILA, adminForcePublish: true });
    await acciones.forcePublishPortfolioAction({
      portfolioId: "p1",
      reason: "Ya se regularizó",
      force: false,
    });
    expect(portfolio.update.mock.calls[0][0].data).toEqual({ adminForcePublish: false });
  });

  it("exige motivo: perdonar una deuda deja rastro o no se hace", async () => {
    const r = await acciones.forcePublishPortfolioAction({
      portfolioId: "p1",
      reason: "  ",
      force: true,
    });
    expect(r.ok).toBe(false);
    expect(portfolio.update).not.toHaveBeenCalled();
  });

  it("un portfolio de otra institución tampoco se publica igual", async () => {
    portfolio.findFirst.mockResolvedValue(null);
    const r = await acciones.forcePublishPortfolioAction({
      portfolioId: "de-otro-ws",
      reason: "Un motivo",
      force: true,
    });
    expect(r.ok).toBe(false);
    expect(portfolio.update).not.toHaveBeenCalled();
  });
});
