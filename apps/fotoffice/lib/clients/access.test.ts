import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, requireActiveWorkspaceMock, levelMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
  requireActiveWorkspaceMock: vi.fn(),
  levelMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/workspace", () => ({ requireActiveWorkspace: requireActiveWorkspaceMock }));
vi.mock("@/lib/permissions/module-access", () => ({ getModuleLevel: levelMock }));

const { requireClientsViewer, requireClientsEditor } = await import("./access");

const ws = { id: "ws-1", name: "SFPR" };

beforeEach(() => {
  redirectMock.mockClear();
  requireActiveWorkspaceMock.mockReset().mockResolvedValue({ user: { id: 7 }, workspace: ws });
  levelMock.mockReset().mockResolvedValue("MANAGE");
});

describe("la puerta del módulo Clientes", () => {
  it("pregunta el nivel de ESTA persona en ESTE workspace y ESTE módulo", async () => {
    await requireClientsViewer();
    expect(levelMock).toHaveBeenCalledWith(7, "ws-1", "clients");
  });

  it("sin workspace activo, va a elegir uno", async () => {
    requireActiveWorkspaceMock.mockResolvedValue({ user: { id: 7 }, workspace: null });
    await expect(requireClientsViewer()).rejects.toThrow("REDIRECT:/workspace");
  });

  it("sin nivel (módulo apagado o sin rol), afuera", async () => {
    levelMock.mockResolvedValue("NONE");
    await expect(requireClientsViewer()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireClientsEditor()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("con VIEW ve el padrón pero no edita", async () => {
    levelMock.mockResolvedValue("VIEW");
    await expect(requireClientsViewer()).resolves.toMatchObject({ level: "VIEW", canEdit: false });
    await expect(requireClientsEditor()).rejects.toThrow("REDIRECT:/clientes");
  });

  it("con MANAGE crea, edita y desactiva", async () => {
    await expect(requireClientsEditor()).resolves.toMatchObject({
      workspace: ws,
      level: "MANAGE",
      canEdit: true,
    });
  });
});
