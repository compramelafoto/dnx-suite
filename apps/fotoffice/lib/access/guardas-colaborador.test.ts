import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ role: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ id: 7 }), getAuthUser: async () => ({ id: 7 }) }));
vi.mock("@/lib/workspace", () => ({
  requireActiveWorkspace: async () => ({ user: { id: 7 }, workspace: { id: "ws-1" } }),
  resolveActiveWorkspace: async () => ({ id: "ws-1" }),
}));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.role }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async () => true }));

const { requireBookingsStaff } = await import("@/lib/bookings/access");
const { requireCashStaff } = await import("@/lib/cash/access");
const { requireClientsStaff } = await import("@/lib/clients/access");
const { requireRafflesStaff } = await import("@/lib/raffles/access");
const { requireCoveragesReviewer, requireCoveragesCoordinator } = await import("@/lib/coverages/access");
const { requireMembersContext } = await import("@/lib/members/access");

const GUARDAS: [string, () => Promise<unknown>][] = [
  ["reservas", requireBookingsStaff],
  ["caja", requireCashStaff],
  ["clientes", requireClientsStaff],
  ["sorteos", requireRafflesStaff],
  ["coberturas (revisar)", requireCoveragesReviewer],
  ["coberturas (coordinar)", requireCoveragesCoordinator],
  ["socios", requireMembersContext],
];

beforeEach(() => H.role.mockReset());

describe.each(GUARDAS)("guarda de %s", (_nombre, guarda) => {
  it("deja pasar a Equipo", async () => {
    H.role.mockResolvedValue("STAFF");
    await expect(guarda()).resolves.toBeDefined();
  });
  it("deja pasar a MEMBER (legacy de Equipo)", async () => {
    H.role.mockResolvedValue("MEMBER");
    await expect(guarda()).resolves.toBeDefined();
  });
  it("deja afuera al Colaborador", async () => {
    H.role.mockResolvedValue("COLLABORATOR");
    await expect(guarda()).rejects.toThrow("REDIRECT:");
  });
  it("deja afuera a quien no tiene rol", async () => {
    H.role.mockResolvedValue(null);
    await expect(guarda()).rejects.toThrow("REDIRECT:");
  });
});
