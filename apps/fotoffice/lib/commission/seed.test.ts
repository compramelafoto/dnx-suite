import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  roleCount: vi.fn(),
  officeCount: vi.fn(),
  roleCreate: vi.fn(),
  officeCreateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@repo/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@repo/db")>();
  const tx = {
    workspaceCustomRole: { count: H.roleCount, create: H.roleCreate },
    workspaceOffice: { count: H.officeCount, createMany: H.officeCreateMany },
  };
  return {
    ...real,
    prisma: { ...tx, $transaction: (fn: (t: typeof tx) => Promise<unknown>) => H.transaction(fn, tx) },
  };
});

const { ensureCommissionSetup } = await import("./seed");
const { OFFICE_TEMPLATES, ROLE_TEMPLATES } = await import("./templates");

beforeEach(() => {
  H.roleCount.mockReset().mockResolvedValue(0);
  H.officeCount.mockReset().mockResolvedValue(0);
  H.roleCreate.mockReset().mockResolvedValue({});
  H.officeCreateMany.mockReset().mockResolvedValue({ count: 0 });
  H.transaction.mockReset().mockImplementation((fn, tx) => fn(tx));
});

describe("ensureCommissionSetup", () => {
  it("un workspace sin nada recibe todas las plantillas, con sus permisos", async () => {
    expect(await ensureCommissionSetup("ws-1")).toEqual({ seeded: true });
    expect(H.roleCreate).toHaveBeenCalledTimes(ROLE_TEMPLATES.length);
    expect(H.roleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        name: "Tesorería",
        templateKey: "treasury",
        permissions: { create: expect.arrayContaining([expect.objectContaining({ moduleKey: "cash", level: "MANAGE", actions: ["cash.project_money", "cash.configure"] })]) },
      }),
    });
    expect(H.officeCreateMany).toHaveBeenCalledWith({
      data: OFFICE_TEMPLATES.map((o) => ({ workspaceId: "ws-1", name: o.name, votes: o.votes, order: o.order, templateKey: o.key })),
      skipDuplicates: true,
    });
  });

  it("si ya tiene roles o cargos (aunque los haya borrado todos menos uno), no siembra nada", async () => {
    H.roleCount.mockResolvedValue(1);
    expect(await ensureCommissionSetup("ws-1")).toEqual({ seeded: false });
    expect(H.roleCreate).not.toHaveBeenCalled();
    expect(H.officeCreateMany).not.toHaveBeenCalled();
  });

  it("si otra pestaña sembró al mismo tiempo (choque de nombre único), sigue sin error", async () => {
    H.roleCreate.mockRejectedValue(Object.assign(new Error("Unique constraint"), { code: "P2002" }));
    expect(await ensureCommissionSetup("ws-1")).toEqual({ seeded: false });
  });

  it("cualquier otro error se propaga", async () => {
    H.roleCreate.mockRejectedValue(new Error("se cayó la conexión"));
    await expect(ensureCommissionSetup("ws-1")).rejects.toThrow("se cayó la conexión");
  });
});
