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

const { requireRafflesConductor, requireRafflesOperator, requireRafflesViewer } = await import("./access");

const ws = { id: "ws-1", name: "SFPR" };

beforeEach(() => {
  redirectMock.mockClear();
  requireActiveWorkspaceMock.mockReset().mockResolvedValue({ user: { id: 7 }, workspace: ws });
  levelMock.mockReset().mockResolvedValue("MANAGE");
  actionMock.mockReset().mockResolvedValue(true);
});

describe("la puerta del módulo Sorteos", () => {
  it("pregunta el nivel y la acción de ESTA persona en ESTE workspace y ESTE módulo", async () => {
    await requireRafflesViewer();
    expect(levelMock).toHaveBeenCalledWith(7, "ws-1", "raffles");
    expect(actionMock).toHaveBeenCalledWith(7, "ws-1", "raffles", "raffles.conduct");
  });

  it("sin workspace activo, va a elegir uno", async () => {
    requireActiveWorkspaceMock.mockResolvedValue({ user: { id: 7 }, workspace: null });
    await expect(requireRafflesViewer()).rejects.toThrow("REDIRECT:/workspace");
  });

  it("NONE (módulo apagado o sin rol): afuera de todo", async () => {
    levelMock.mockResolvedValue("NONE");
    actionMock.mockResolvedValue(false);
    await expect(requireRafflesViewer()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireRafflesOperator()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireRafflesConductor()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("VIEW ve los sorteos pero no entrega premios ni reintenta avisos", async () => {
    levelMock.mockResolvedValue("VIEW");
    actionMock.mockResolvedValue(false);
    await expect(requireRafflesViewer()).resolves.toMatchObject({
      level: "VIEW",
      canOperate: false,
      canConduct: false,
    });
    await expect(requireRafflesOperator()).rejects.toThrow("REDIRECT:/sorteos");
    await expect(requireRafflesConductor()).rejects.toThrow("REDIRECT:/sorteos");
  });

  it("VIEW con la acción listada (no debería pasar) tampoco conduce", async () => {
    levelMock.mockResolvedValue("VIEW");
    await expect(requireRafflesConductor()).rejects.toThrow("REDIRECT:/sorteos");
  });

  it("MANAGE sin la acción entrega premios pero no crea, anuncia, sella, resuelve ni cancela", async () => {
    actionMock.mockResolvedValue(false);
    await expect(requireRafflesOperator()).resolves.toMatchObject({ canOperate: true, canConduct: false });
    await expect(requireRafflesConductor()).rejects.toThrow("REDIRECT:/sorteos");
  });

  it("MANAGE con raffles.conduct conduce", async () => {
    await expect(requireRafflesConductor()).resolves.toMatchObject({
      workspace: ws,
      level: "MANAGE",
      canOperate: true,
      canConduct: true,
    });
  });
});
