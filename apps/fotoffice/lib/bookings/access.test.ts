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

const { requireBookingsAdmin, requireBookingsStaff } = await import("./access");

const ws = { id: "ws-1", name: "SFPR" };

beforeEach(() => {
  redirectMock.mockClear();
  requireActiveWorkspaceMock.mockReset().mockResolvedValue({ user: { id: 7 }, workspace: ws });
  levelMock.mockReset().mockResolvedValue("MANAGE");
});

describe("la puerta del módulo Reservas", () => {
  it("pregunta el nivel de ESTA persona en ESTE workspace y ESTE módulo", async () => {
    await requireBookingsStaff();
    expect(levelMock).toHaveBeenCalledWith(7, "ws-1", "bookings");
  });

  it("sin workspace activo, va a elegir uno", async () => {
    requireActiveWorkspaceMock.mockResolvedValue({ user: { id: 7 }, workspace: null });
    await expect(requireBookingsStaff()).rejects.toThrow("REDIRECT:/workspace");
  });

  it("sin nivel (módulo apagado o sin rol), afuera", async () => {
    levelMock.mockResolvedValue("NONE");
    await expect(requireBookingsStaff()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireBookingsAdmin()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("con VIEW ve la lista pero no administra", async () => {
    levelMock.mockResolvedValue("VIEW");
    await expect(requireBookingsStaff()).resolves.toMatchObject({ level: "VIEW" });
    await expect(requireBookingsAdmin()).rejects.toThrow("REDIRECT:/reservas");
  });

  it("con MANAGE administra", async () => {
    await expect(requireBookingsAdmin()).resolves.toMatchObject({ workspace: ws, level: "MANAGE" });
  });
});
