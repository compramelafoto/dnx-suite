import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, requireActiveWorkspaceMock, resolveRoleMock, isModuleEnabledMock } = vi.hoisted(
  () => ({
    redirectMock: vi.fn((destino: string) => {
      throw new Error(`REDIRECT:${destino}`);
    }),
    requireActiveWorkspaceMock: vi.fn(),
    resolveRoleMock: vi.fn(),
    isModuleEnabledMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/workspace", () => ({ requireActiveWorkspace: requireActiveWorkspaceMock }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: resolveRoleMock }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: isModuleEnabledMock }));

const { requireRafflesAdmin, requireRafflesStaff } = await import("./access");

const ws = { id: "ws-1", name: "SFPR" };

beforeEach(() => {
  redirectMock.mockClear();
  requireActiveWorkspaceMock.mockReset().mockResolvedValue({ user: { id: 7 }, workspace: ws });
  resolveRoleMock.mockReset().mockResolvedValue("WORKSPACE_OWNER");
  isModuleEnabledMock.mockReset().mockResolvedValue(true);
});

describe("la puerta del módulo", () => {
  it("con el módulo apagado, nadie entra aunque sea dueño", async () => {
    isModuleEnabledMock.mockResolvedValue(false);
    await expect(requireRafflesStaff()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("el módulo se consulta para ESTE workspace, no en general", async () => {
    await requireRafflesStaff();
    expect(isModuleEnabledMock).toHaveBeenCalledWith("ws-1", "raffles");
  });

  it("sin rol en el workspace, no entra", async () => {
    resolveRoleMock.mockResolvedValue(null);
    await expect(requireRafflesStaff()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("sin workspace activo, va a elegir uno", async () => {
    requireActiveWorkspaceMock.mockResolvedValue({ user: { id: 7 }, workspace: null });
    await expect(requireRafflesStaff()).rejects.toThrow("REDIRECT:/workspace");
  });

  it("el equipo ve la lista", async () => {
    resolveRoleMock.mockResolvedValue("STAFF");
    await expect(requireRafflesStaff()).resolves.toMatchObject({ workspace: ws, role: "STAFF" });
  });

  it("STAFF no puede anunciar ni sortear: lo manda a la lista", async () => {
    resolveRoleMock.mockResolvedValue("STAFF");
    await expect(requireRafflesAdmin()).rejects.toThrow("REDIRECT:/sorteos");
  });

  it("el dueño sí puede", async () => {
    await expect(requireRafflesAdmin()).resolves.toMatchObject({ role: "WORKSPACE_OWNER" });
  });

  it("el administrador también", async () => {
    resolveRoleMock.mockResolvedValue("WORKSPACE_ADMIN");
    await expect(requireRafflesAdmin()).resolves.toMatchObject({ role: "WORKSPACE_ADMIN" });
  });

  it("con el módulo apagado, ni siquiera se llega a mirar el rol", async () => {
    isModuleEnabledMock.mockResolvedValue(false);
    await expect(requireRafflesAdmin()).rejects.toThrow("REDIRECT:/dashboard");
    expect(resolveRoleMock).not.toHaveBeenCalled();
  });
});
