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

const { requireBookingsConfigurer, requireBookingsOperator, requireBookingsViewer } = await import("./access");

const ws = { id: "ws-1", name: "SFPR" };

beforeEach(() => {
  redirectMock.mockClear();
  requireActiveWorkspaceMock.mockReset().mockResolvedValue({ user: { id: 7 }, workspace: ws });
  levelMock.mockReset().mockResolvedValue("MANAGE");
  actionMock.mockReset().mockResolvedValue(true);
});

describe("la puerta del módulo Reservas", () => {
  it("pregunta el nivel y la acción de ESTA persona en ESTE workspace y ESTE módulo", async () => {
    await requireBookingsViewer();
    expect(levelMock).toHaveBeenCalledWith(7, "ws-1", "bookings");
    expect(actionMock).toHaveBeenCalledWith(7, "ws-1", "bookings", "bookings.configure");
  });

  it("sin workspace activo, va a elegir uno", async () => {
    requireActiveWorkspaceMock.mockResolvedValue({ user: { id: 7 }, workspace: null });
    await expect(requireBookingsViewer()).rejects.toThrow("REDIRECT:/workspace");
  });

  it("NONE (módulo apagado o sin rol): afuera de todo", async () => {
    levelMock.mockResolvedValue("NONE");
    actionMock.mockResolvedValue(false);
    await expect(requireBookingsViewer()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireBookingsOperator()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireBookingsConfigurer()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("VIEW ve la agenda pero no carga, cancela ni aprueba reservas", async () => {
    levelMock.mockResolvedValue("VIEW");
    actionMock.mockResolvedValue(false);
    await expect(requireBookingsViewer()).resolves.toMatchObject({
      level: "VIEW",
      canOperate: false,
      canConfigure: false,
    });
    await expect(requireBookingsOperator()).rejects.toThrow("REDIRECT:/reservas");
    await expect(requireBookingsConfigurer()).rejects.toThrow("REDIRECT:/reservas");
  });

  it("VIEW con la acción listada (no debería pasar) tampoco configura", async () => {
    levelMock.mockResolvedValue("VIEW");
    await expect(requireBookingsConfigurer()).rejects.toThrow("REDIRECT:/reservas");
  });

  it("MANAGE sin la acción opera reservas pero no configura espacios, extras ni tarifas", async () => {
    actionMock.mockResolvedValue(false);
    await expect(requireBookingsOperator()).resolves.toMatchObject({ canOperate: true, canConfigure: false });
    await expect(requireBookingsConfigurer()).rejects.toThrow("REDIRECT:/reservas");
  });

  it("MANAGE con bookings.configure configura", async () => {
    await expect(requireBookingsConfigurer()).resolves.toMatchObject({
      workspace: ws,
      level: "MANAGE",
      canOperate: true,
      canConfigure: true,
    });
  });
});
