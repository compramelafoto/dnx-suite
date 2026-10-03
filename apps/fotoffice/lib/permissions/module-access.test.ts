import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@repo/db";

const H = vi.hoisted(() => ({
  findMany: vi.fn(),
  enabled: vi.fn(),
  role: vi.fn(),
}));

vi.mock("@repo/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@repo/db")>();
  return { ...real, prisma: { workspaceRoleAssignment: { findMany: H.findMany } } };
});
vi.mock("@/lib/modules/gating", () => ({ getEnabledModuleKeysForWorkspace: H.enabled }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.role }));

const { getModuleLevel, getModuleLevels, hasModuleAction, hasModuleLevel } = await import("./module-access");

beforeEach(() => {
  H.findMany.mockReset().mockResolvedValue([]);
  H.enabled.mockReset().mockResolvedValue(new Set(["members", "raffles", "bookings"]));
  H.role.mockReset().mockResolvedValue("STAFF");
});

describe("getModuleLevels", () => {
  it("STAFF sin roles: lo de hoy", async () => {
    const levels = await getModuleLevels(7, "ws-1");
    expect(levels.members).toBe("VIEW");
    expect(levels.raffles).toBe("VIEW");
    expect(levels["membership-dues"]).toBe("NONE");
  });

  it("consulta sólo asignaciones de ESTA persona en ESTE workspace, con roles de ese workspace", async () => {
    await getModuleLevels(7, "ws-1");
    expect(H.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "ws-1",
          role: { workspaceId: "ws-1" },
          OR: [{ userId: 7 }, { member: { userId: 7, workspaceId: "ws-1" } }],
        },
      }),
    );
  });

  it("una asignación revocada llega a la regla (para no volver a la compatibilidad)", async () => {
    H.findMany.mockResolvedValue([
      { startsAt: null, endsAt: null, revokedAt: new Date("2026-01-01"), role: { permissions: [] } },
    ]);
    expect((await getModuleLevels(7, "ws-1")).members).toBe("NONE");
  });

  it("aplica las asignaciones que vienen de la base", async () => {
    H.findMany.mockResolvedValue([
      {
        startsAt: null,
        endsAt: null,
        revokedAt: null,
        role: { permissions: [{ moduleKey: "membership-dues", level: "MANAGE" }] },
      },
    ]);
    const levels = await getModuleLevels(7, "ws-1");
    expect(levels["membership-dues"]).toBe("MANAGE");
    expect(levels.members).toBe("NONE");
  });

  it("si la tabla todavía no existe en la base, sigue con la compatibilidad", async () => {
    H.findMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("The table `WorkspaceRoleAssignment` does not exist", {
        code: "P2021",
        clientVersion: "6",
      }),
    );
    expect((await getModuleLevels(7, "ws-1")).members).toBe("VIEW");
  });

  it("si falta una columna de la etapa 2 (P2022), sigue con la compatibilidad en vez de dar 500", async () => {
    H.findMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "The column `WorkspaceRoleAssignment.memberId` does not exist in the current database.",
        { code: "P2022", clientVersion: "6" },
      ),
    );
    expect((await getModuleLevels(7, "ws-1")).members).toBe("VIEW");
    H.role.mockResolvedValue("WORKSPACE_OWNER");
    expect((await getModuleLevels(8, "ws-1")).members).toBe("MANAGE");
  });

  it("cualquier otro error de base se propaga", async () => {
    H.findMany.mockRejectedValue(new Error("se cayó la conexión"));
    await expect(getModuleLevels(7, "ws-1")).rejects.toThrow("se cayó la conexión");
  });
});

describe("getModuleLevel y hasModuleLevel", () => {
  it("un módulo apagado da NONE", async () => {
    H.role.mockResolvedValue("WORKSPACE_OWNER");
    expect(await getModuleLevel(7, "ws-1", "evaluaciones")).toBe("NONE");
  });

  it("hasModuleLevel compara contra el nivel pedido", async () => {
    expect(await hasModuleLevel(7, "ws-1", "raffles", "VIEW")).toBe(true);
    expect(await hasModuleLevel(7, "ws-1", "raffles", "MANAGE")).toBe(false);
  });
});

describe("hasModuleAction", () => {
  const cashOn = () => H.enabled.mockResolvedValue(new Set(["cash"]));
  it("pide `actions` a la base", async () => {
    await hasModuleAction(7, "ws-1", "cash", "cash.configure");
    expect(H.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          role: { select: { permissions: { select: { moduleKey: true, level: true, actions: true } } } },
        }),
      }),
    );
  });
  it("dueño: sí; STAFF sin roles: no", async () => {
    cashOn();
    H.role.mockResolvedValue("WORKSPACE_OWNER");
    expect(await hasModuleAction(7, "ws-1", "cash", "cash.configure")).toBe(true);
    H.role.mockResolvedValue("STAFF");
    expect(await hasModuleAction(7, "ws-1", "cash", "cash.configure")).toBe(false);
  });
  it("rol vigente con MANAGE y la acción: sí; módulo apagado: no", async () => {
    H.findMany.mockResolvedValue([
      {
        startsAt: null,
        endsAt: null,
        revokedAt: null,
        role: { permissions: [{ moduleKey: "cash", level: "MANAGE", actions: ["cash.configure"] }] },
      },
    ]);
    cashOn();
    expect(await hasModuleAction(7, "ws-1", "cash", "cash.configure")).toBe(true);
    expect(await hasModuleAction(7, "ws-1", "cash", "cash.project_money")).toBe(false);
    H.enabled.mockResolvedValue(new Set());
    expect(await hasModuleAction(7, "ws-1", "cash", "cash.configure")).toBe(false);
  });
});
