import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ count: vi.fn(), createMany: vi.fn(), findMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: { fotofficeNoteCategory: { count: H.count, createMany: H.createMany, findMany: H.findMany } },
}));

const { CATEGORIAS_DNX, categoriasIniciales, asegurarCategorias, listarCategorias } = await import("./categorias");

beforeEach(() => {
  H.count.mockReset();
  H.createMany.mockReset().mockResolvedValue({ count: 1 });
  H.findMany.mockReset().mockResolvedValue([]);
});

describe("categoriasIniciales", () => {
  it("dnx-estudio devuelve las 13 en orden", () => {
    const r = categoriasIniciales("dnx-estudio");
    expect(r).toBe(CATEGORIAS_DNX);
    expect(r).toHaveLength(13);
    expect(r[0]).toBe("URGENTE");
    expect(r[12]).toBe("Otro");
  });
  it("otros workspaces tienen sólo General", () => {
    expect(categoriasIniciales("sfpr")).toEqual(["General"]);
    expect(categoriasIniciales("")).toEqual(["General"]);
  });
});

describe("asegurarCategorias", () => {
  it("no crea nada si ya hay", async () => {
    H.count.mockResolvedValue(2);
    await asegurarCategorias("ws-1", "sfpr");
    expect(H.createMany).not.toHaveBeenCalled();
  });
  it("crea las iniciales con orden y tolera duplicados por la carrera", async () => {
    H.count.mockResolvedValue(0);
    await asegurarCategorias("ws-1", "sfpr");
    expect(H.createMany).toHaveBeenCalledWith({
      data: [{ workspaceId: "ws-1", name: "General", order: 0 }],
      skipDuplicates: true,
    });
  });
});

describe("listarCategorias", () => {
  it("sólo activas del workspace, por orden", async () => {
    await listarCategorias("ws-1");
    expect(H.findMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws-1", isActive: true });
  });
});
