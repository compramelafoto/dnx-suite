import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, findManyMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceFeatureModule: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
    },
  },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {},
  },
}));

const { isModuleEnabledForWorkspace, getEnabledModuleKeysForWorkspace } = await import("./gating");

describe("isModuleEnabledForWorkspace", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findManyMock.mockReset();
  });

  it("Workspace A con courses-sales habilitado: puede verlo/acceder (true)", async () => {
    findUniqueMock.mockResolvedValueOnce({ enabled: true });
    await expect(isModuleEnabledForWorkspace("ws-a", "courses-sales")).resolves.toBe(true);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { workspaceId_moduleKey: { workspaceId: "ws-a", moduleKey: "courses-sales" } },
    });
  });

  it("Workspace B con courses-sales deshabilitado: no puede verlo/acceder (false)", async () => {
    findUniqueMock.mockResolvedValueOnce({ enabled: false });
    await expect(isModuleEnabledForWorkspace("ws-b", "courses-sales")).resolves.toBe(false);
  });

  it("sin fila en WorkspaceFeatureModule (nunca configurado): false", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    await expect(isModuleEnabledForWorkspace("ws-c", "courses-sales")).resolves.toBe(false);
  });

  it("evaluaciones conserva el mismo comportamiento (misma consulta genérica, otra moduleKey)", async () => {
    findUniqueMock.mockResolvedValueOnce({ enabled: true });
    await expect(isModuleEnabledForWorkspace("ws-a", "evaluaciones")).resolves.toBe(true);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { workspaceId_moduleKey: { workspaceId: "ws-a", moduleKey: "evaluaciones" } },
    });
  });

  it("aislamiento: habilitar un módulo en un workspace no lo habilita en otro", async () => {
    findUniqueMock.mockImplementation(
      ({ where }: { where: { workspaceId_moduleKey: { workspaceId: string; moduleKey: string } } }) => {
        const { workspaceId } = where.workspaceId_moduleKey;
        return Promise.resolve(workspaceId === "ws-a" ? { enabled: true } : { enabled: false });
      },
    );
    await expect(isModuleEnabledForWorkspace("ws-a", "courses-sales")).resolves.toBe(true);
    await expect(isModuleEnabledForWorkspace("ws-b", "courses-sales")).resolves.toBe(false);
  });
});

describe("getEnabledModuleKeysForWorkspace", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("devuelve un Set con las keys AVAILABLE habilitadas para ese workspace", async () => {
    findManyMock.mockResolvedValueOnce([{ moduleKey: "courses-sales" }]);
    const set = await getEnabledModuleKeysForWorkspace("ws-a");
    expect(set.has("courses-sales")).toBe(true);
    expect(set.has("evaluaciones")).toBe(false);
  });

  it("un módulo PLANNED nunca puede aparecer como habilitado: el filtro enviado a Prisma nunca lo incluye", async () => {
    findManyMock.mockResolvedValueOnce([]);
    const set = await getEnabledModuleKeysForWorkspace("ws-a");
    expect(set.has("cash")).toBe(false);
    expect(set.size).toBe(0);

    const callArg = findManyMock.mock.calls[0][0] as { where: { moduleKey: { in: string[] } } };
    expect(callArg.where.moduleKey.in).toContain("courses-sales");
    expect(callArg.where.moduleKey.in).toContain("evaluaciones");
    expect(callArg.where.moduleKey.in).toContain("members");
    expect(callArg.where.moduleKey.in).not.toContain("cash");
  });

  it("aislamiento: el Set de un workspace no incluye módulos habilitados de otro", async () => {
    findManyMock.mockImplementation(({ where }: { where: { workspaceId: string } }) =>
      Promise.resolve(where.workspaceId === "ws-a" ? [{ moduleKey: "courses-sales" }] : []),
    );
    const setA = await getEnabledModuleKeysForWorkspace("ws-a");
    const setB = await getEnabledModuleKeysForWorkspace("ws-b");
    expect(setA.has("courses-sales")).toBe(true);
    expect(setB.has("courses-sales")).toBe(false);
  });

  describe("caso SFPR: courses-sales=false, evaluaciones=false, members=true", () => {
    it("el set habilitado solo contiene members — Cursos y Evaluaciones deben ocultarse en el nav", async () => {
      findManyMock.mockResolvedValueOnce([{ moduleKey: "members" }]);
      const set = await getEnabledModuleKeysForWorkspace("ws-sfpr");
      expect(set.has("members")).toBe(true);
      expect(set.has("courses-sales")).toBe(false);
      expect(set.has("evaluaciones")).toBe(false);
    });

    it("con TODOS los módulos apagados, el set queda vacío (Configuración no depende de este set)", async () => {
      findManyMock.mockResolvedValueOnce([]);
      const set = await getEnabledModuleKeysForWorkspace("ws-sfpr");
      expect(set.size).toBe(0);
    });
  });

  describe("módulo website: independencia de otros módulos", () => {
    it("website=true con courses-sales/evaluaciones/members=false: solo website queda habilitado", async () => {
      findManyMock.mockResolvedValueOnce([{ moduleKey: "website" }]);
      const set = await getEnabledModuleKeysForWorkspace("ws-a");
      expect(set.has("website")).toBe(true);
      expect(set.has("courses-sales")).toBe(false);
      expect(set.has("evaluaciones")).toBe(false);
      expect(set.has("members")).toBe(false);
    });

    it("website=false con todo lo demás encendido: los demás módulos no se ven afectados", async () => {
      findManyMock.mockResolvedValueOnce([
        { moduleKey: "courses-sales" },
        { moduleKey: "evaluaciones" },
        { moduleKey: "members" },
      ]);
      const set = await getEnabledModuleKeysForWorkspace("ws-a");
      expect(set.has("website")).toBe(false);
      expect(set.has("courses-sales")).toBe(true);
      expect(set.has("evaluaciones")).toBe(true);
      expect(set.has("members")).toBe(true);
    });
  });
});
