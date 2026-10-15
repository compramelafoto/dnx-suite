import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, requireActiveWorkspaceMock, levelMock, actionMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
  requireActiveWorkspaceMock: vi.fn(),
  levelMock: vi.fn(),
  actionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/workspace", () => ({ requireActiveWorkspace: requireActiveWorkspaceMock }));
vi.mock("@/lib/permissions/module-access", () => ({
  getModuleLevel: levelMock,
  hasModuleAction: actionMock,
}));

const { requireCashViewer, requireCashOperator, requireCashConfigurer } = await import("./access");

const ws = { id: "ws-1", name: "SFPR" };

beforeEach(() => {
  redirectMock.mockClear();
  requireActiveWorkspaceMock.mockReset().mockResolvedValue({ user: { id: 7 }, workspace: ws });
  levelMock.mockReset().mockResolvedValue("MANAGE");
  actionMock.mockReset().mockResolvedValue(false);
});

describe("la puerta del módulo Caja", () => {
  it("pregunta el nivel y la acción de ESTA persona en ESTE workspace", async () => {
    await requireCashViewer();
    expect(levelMock).toHaveBeenCalledWith(7, "ws-1", "cash");
    expect(actionMock).toHaveBeenCalledWith(7, "ws-1", "cash", "cash.configure");
  });

  it("sin workspace activo, va a elegir uno", async () => {
    requireActiveWorkspaceMock.mockResolvedValue({ user: { id: 7 }, workspace: null });
    await expect(requireCashViewer()).rejects.toThrow("REDIRECT:/workspace");
  });

  it("sin nivel (módulo apagado o sin rol), afuera de todo", async () => {
    levelMock.mockResolvedValue("NONE");
    await expect(requireCashViewer()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireCashOperator()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireCashConfigurer()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("con VIEW ve el libro pero no opera ni configura", async () => {
    levelMock.mockResolvedValue("VIEW");
    await expect(requireCashViewer()).resolves.toMatchObject({
      level: "VIEW",
      canOperate: false,
      canConfigure: false,
    });
    await expect(requireCashOperator()).rejects.toThrow("REDIRECT:/caja");
    await expect(requireCashConfigurer()).rejects.toThrow("REDIRECT:/caja");
  });

  it("con VIEW no configura aunque la acción figure (la acción sólo vale con MANAGE)", async () => {
    levelMock.mockResolvedValue("VIEW");
    actionMock.mockResolvedValue(true);
    await expect(requireCashViewer()).resolves.toMatchObject({ canConfigure: false });
    await expect(requireCashConfigurer()).rejects.toThrow("REDIRECT:/caja");
  });

  it("con MANAGE opera, pero sin la acción no configura", async () => {
    await expect(requireCashOperator()).resolves.toMatchObject({
      workspace: ws,
      level: "MANAGE",
      canOperate: true,
      canConfigure: false,
    });
    await expect(requireCashConfigurer()).rejects.toThrow("REDIRECT:/caja");
  });

  it("con MANAGE y cash.configure configura", async () => {
    actionMock.mockResolvedValue(true);
    await expect(requireCashConfigurer()).resolves.toMatchObject({
      workspace: ws,
      user: { id: 7 },
      canOperate: true,
      canConfigure: true,
    });
  });
});
