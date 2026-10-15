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

const { requireCoveragesViewer, requireCoveragesReviewer, requireCoveragesCoordinator } =
  await import("./access");

const ws = { id: "ws-1", name: "SFPR" };

beforeEach(() => {
  redirectMock.mockClear();
  requireActiveWorkspaceMock.mockReset().mockResolvedValue({ user: { id: 7 }, workspace: ws });
  levelMock.mockReset().mockResolvedValue("MANAGE");
  actionMock.mockReset().mockResolvedValue(false);
});

/**
 * Tres escalones: ver la bandeja y las fichas (VIEW), trabajar los pedidos —notas, pedir un
 * dato, pasar a evaluación— (MANAGE), y decidir —aprobar, rechazar, cerrar, asignar, convocar,
 * ajustes y colaboradores— (MANAGE + `coverages.coordinate`).
 */
describe("la puerta del módulo Coberturas", () => {
  it("pregunta el nivel y la acción de ESTA persona en ESTE workspace", async () => {
    await requireCoveragesViewer();
    expect(levelMock).toHaveBeenCalledWith(7, "ws-1", "coverages");
    expect(actionMock).toHaveBeenCalledWith(7, "ws-1", "coverages", "coverages.coordinate");
  });

  it("sin workspace activo, va a elegir uno", async () => {
    requireActiveWorkspaceMock.mockResolvedValue({ user: { id: 7 }, workspace: null });
    await expect(requireCoveragesViewer()).rejects.toThrow("REDIRECT:/workspace");
  });

  it("sin nivel (módulo apagado o sin rol), afuera de todo", async () => {
    levelMock.mockResolvedValue("NONE");
    await expect(requireCoveragesViewer()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireCoveragesReviewer()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireCoveragesCoordinator()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("con VIEW mira la bandeja y las fichas, pero no revisa ni coordina", async () => {
    levelMock.mockResolvedValue("VIEW");
    await expect(requireCoveragesViewer()).resolves.toMatchObject({
      workspace: ws,
      level: "VIEW",
      canReview: false,
      canCoordinate: false,
    });
    await expect(requireCoveragesReviewer()).rejects.toThrow("REDIRECT:/coberturas");
    await expect(requireCoveragesCoordinator()).rejects.toThrow(
      "REDIRECT:/coberturas?forbidden=coordinar",
    );
  });

  it("con VIEW no coordina aunque la acción figure (la acción sólo vale con MANAGE)", async () => {
    levelMock.mockResolvedValue("VIEW");
    actionMock.mockResolvedValue(true);
    await expect(requireCoveragesViewer()).resolves.toMatchObject({ canCoordinate: false });
    await expect(requireCoveragesCoordinator()).rejects.toThrow(
      "REDIRECT:/coberturas?forbidden=coordinar",
    );
  });

  it("con MANAGE revisa (el personal de antes), pero sin la acción no coordina", async () => {
    await expect(requireCoveragesReviewer()).resolves.toMatchObject({
      user: { id: 7 },
      workspace: ws,
      level: "MANAGE",
      canReview: true,
      canCoordinate: false,
    });
    await expect(requireCoveragesCoordinator()).rejects.toThrow(
      "REDIRECT:/coberturas?forbidden=coordinar",
    );
  });

  it("con MANAGE y coverages.coordinate coordina", async () => {
    actionMock.mockResolvedValue(true);
    await expect(requireCoveragesCoordinator()).resolves.toMatchObject({
      user: { id: 7 },
      workspace: ws,
      level: "MANAGE",
      canReview: true,
      canCoordinate: true,
    });
  });
});
