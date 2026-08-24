import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, findManyMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    prisma: {
      workspaceModuleFee: { findUnique: findUniqueMock, findMany: findManyMock },
    },
  };
});

const { getPlatformFeeBps, getPlatformFeeBpsByModule } = await import("./store");

beforeEach(() => {
  findUniqueMock.mockReset();
  findManyMock.mockReset();
});

describe("getPlatformFeeBps", () => {
  it("sin fila devuelve el 5% por defecto", async () => {
    findUniqueMock.mockResolvedValue(null);
    await expect(getPlatformFeeBps("ws-1", "courses-sales")).resolves.toBe(500);
  });

  it("con fila devuelve el valor configurado", async () => {
    findUniqueMock.mockResolvedValue({ feeBps: 1200 });
    await expect(getPlatformFeeBps("ws-1", "courses-sales")).resolves.toBe(1200);
  });

  it("respeta una comisión de cero", async () => {
    findUniqueMock.mockResolvedValue({ feeBps: 0 });
    await expect(getPlatformFeeBps("ws-1", "courses-sales")).resolves.toBe(0);
  });

  it("un valor corrupto en la base cae al default", async () => {
    findUniqueMock.mockResolvedValue({ feeBps: -3 });
    await expect(getPlatformFeeBps("ws-1", "courses-sales")).resolves.toBe(500);
  });

  /**
   * Si la base no responde, cobrar con el default es preferible a romper el checkout:
   * el peor caso es una comisión de 5% en vez de la pactada, no una venta perdida.
   */
  it("si la consulta falla devuelve el default en vez de propagar el error", async () => {
    findUniqueMock.mockRejectedValue(new Error("db caida"));
    await expect(getPlatformFeeBps("ws-1", "courses-sales")).resolves.toBe(500);
  });

  it("busca por la clave compuesta correcta", async () => {
    findUniqueMock.mockResolvedValue(null);
    await getPlatformFeeBps("ws-9", "members");
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { workspaceId_moduleKey: { workspaceId: "ws-9", moduleKey: "members" } },
      select: { feeBps: true },
    });
  });
});

describe("getPlatformFeeBpsByModule", () => {
  it("completa con el default los módulos sin fila", async () => {
    findManyMock.mockResolvedValue([{ moduleKey: "courses-sales", feeBps: 700 }]);
    const map = await getPlatformFeeBpsByModule("ws-1", ["courses-sales", "members"]);
    expect(map.get("courses-sales")).toBe(700);
    expect(map.get("members")).toBe(500);
  });

  it("con lista vacía no consulta la base", async () => {
    const map = await getPlatformFeeBpsByModule("ws-1", []);
    expect(map.size).toBe(0);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("si la consulta falla devuelve todos en default", async () => {
    findManyMock.mockRejectedValue(new Error("db caida"));
    const map = await getPlatformFeeBpsByModule("ws-1", ["courses-sales", "members"]);
    expect(map.get("courses-sales")).toBe(500);
    expect(map.get("members")).toBe(500);
  });
});
