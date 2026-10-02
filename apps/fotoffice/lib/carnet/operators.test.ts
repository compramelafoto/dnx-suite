import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ wm: vi.fn(), m: vi.fn(), grant: vi.fn() }));
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: H.wm },
    membership: { findUnique: H.m },
    memberCardOperator: { findUnique: H.grant },
  },
}));

const { resolveCardCapabilities } = await import("./operators");

beforeEach(() => {
  H.wm.mockReset().mockResolvedValue(null);
  H.m.mockReset().mockResolvedValue(null);
  H.grant.mockReset().mockResolvedValue(null);
});

describe("resolveCardCapabilities (0.1)", () => {
  it("Dueño y Admin: todo", async () => {
    H.wm.mockResolvedValue({ role: "WORKSPACE_OWNER" });
    expect(await resolveCardCapabilities(1, "w")).toEqual(["PRODUCIR", "ENTREGAR", "ADMINISTRAR"]);
    H.wm.mockResolvedValue({ role: "WORKSPACE_ADMIN" });
    expect(await resolveCardCapabilities(1, "w")).toEqual(["PRODUCIR", "ENTREGAR", "ADMINISTRAR"]);
  });
  it("Equipo: producir y entregar, no administrar", async () => {
    H.wm.mockResolvedValue({ role: "STAFF" });
    expect(await resolveCardCapabilities(1, "w")).toEqual(["PRODUCIR", "ENTREGAR"]);
  });
  it("MEMBER legacy se comporta como Equipo", async () => {
    H.m.mockResolvedValue({ role: "MEMBER" });
    expect(await resolveCardCapabilities(1, "w")).toEqual(["PRODUCIR", "ENTREGAR"]);
  });
  it("Colaborador: nada", async () => {
    H.wm.mockResolvedValue({ role: "COLLABORATOR" });
    expect(await resolveCardCapabilities(1, "w")).toEqual([]);
  });
  it("un permiso otorgado sigue valiendo para quien no tiene rol de operar", async () => {
    H.grant.mockResolvedValue({ canProduce: true, canDeliver: false });
    expect(await resolveCardCapabilities(1, "w")).toEqual(["PRODUCIR"]);
  });
});
