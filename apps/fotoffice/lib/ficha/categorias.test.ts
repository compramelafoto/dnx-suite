import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  count: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => {
  const prisma = {
    fotofficeNoteCategory: {
      count: H.count, createMany: H.createMany, findMany: H.findMany, findFirst: H.findFirst, create: H.create, updateMany: H.updateMany,
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});

const {
  CATEGORIAS_DNX, categoriasIniciales, asegurarCategorias, listarCategorias,
  crearCategoria, renombrarCategoria, moverCategoria, desactivarCategoria, activarCategoria, validarNombreCategoria,
} = await import("./categorias");

const ADMIN = { workspaceId: "ws-1", role: "WORKSPACE_ADMIN" };
const EQUIPO = { workspaceId: "ws-1", role: "STAFF" };

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.createMany.mockResolvedValue({ count: 1 });
  H.findMany.mockResolvedValue([]);
  H.findFirst.mockResolvedValue(null);
  H.updateMany.mockResolvedValue({ count: 1 });
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

describe("catálogo de categorías", () => {
  it("sin `configurar` no toca nada", async () => {
    expect((await crearCategoria(EQUIPO, "Nueva")).ok).toBe(false);
    expect((await renombrarCategoria(EQUIPO, "k1", "X")).ok).toBe(false);
    expect((await moverCategoria(EQUIPO, "k1", "subir")).ok).toBe(false);
    expect((await desactivarCategoria(EQUIPO, "k1")).ok).toBe(false);
    expect((await activarCategoria(EQUIPO, "k1")).ok).toBe(false);
    expect(H.create).not.toHaveBeenCalled();
    expect(H.updateMany).not.toHaveBeenCalled();
    expect(H.findFirst).not.toHaveBeenCalled();
  });
  it("nombre de 1 a 40, con los espacios colapsados", () => {
    expect(validarNombreCategoria("  Envío   de material ")).toBe("Envío de material");
    expect(validarNombreCategoria(" ")).toBeNull();
    expect(validarNombreCategoria("x".repeat(41))).toBeNull();
  });
  it("crear: al final de la lista y dentro del workspace", async () => {
    H.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ order: 4 });
    expect(await crearCategoria(ADMIN, " Visita ")).toEqual({ ok: true });
    expect(H.create).toHaveBeenCalledWith({ data: { workspaceId: "ws-1", name: "Visita", order: 5 } });
    expect(H.findFirst.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws-1", name: { equals: "Visita", mode: "insensitive" } });
  });
  it("crear: repetida (sin distinguir mayúsculas) da error; desactivada vuelve a activarse", async () => {
    H.findFirst.mockResolvedValueOnce({ id: "k1", isActive: true }).mockResolvedValueOnce({ order: 1 });
    expect(await crearCategoria(ADMIN, "visita")).toEqual({ ok: false, error: "Ya existe una categoría con ese nombre." });
    H.findFirst.mockResolvedValueOnce({ id: "k2", isActive: false }).mockResolvedValueOnce({ order: 1 });
    expect(await crearCategoria(ADMIN, "Correo")).toEqual({ ok: true });
    expect(H.updateMany).toHaveBeenCalledWith({ where: { id: "k2", workspaceId: "ws-1" }, data: { isActive: true, order: 2 } });
    expect(H.create).not.toHaveBeenCalled();
  });
  it("renombrar: id ajeno no encontrado; el where lleva el workspace", async () => {
    H.updateMany.mockResolvedValue({ count: 0 });
    expect(await renombrarCategoria(ADMIN, "ajena", "Nuevo")).toEqual({ ok: false, error: "No encontramos esa categoría." });
    expect(H.updateMany.mock.calls[0][0].where).toEqual({ id: "ajena", workspaceId: "ws-1" });
  });
  it("mover: intercambia con la vecina y renumera las activas", async () => {
    H.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(await moverCategoria(ADMIN, "c", "subir")).toEqual({ ok: true });
    expect(H.findMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws-1", isActive: true });
    expect(H.updateMany.mock.calls.map((c) => [c[0].where.id, c[0].data.order])).toEqual([["a", 0], ["c", 1], ["b", 2]]);
  });
  it("mover: la primera no sube (no hace nada)", async () => {
    H.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    expect(await moverCategoria(ADMIN, "a", "subir")).toEqual({ ok: true });
    expect(H.updateMany).not.toHaveBeenCalled();
  });
  it("desactivar: no deja sin ninguna activa", async () => {
    H.findFirst.mockResolvedValue({ id: "k1", isActive: true });
    H.count.mockResolvedValue(1);
    expect(await desactivarCategoria(ADMIN, "k1")).toEqual({
      ok: false, error: "Tiene que quedar al menos una categoría activa para poder escribir notas.",
    });
    expect(H.updateMany).not.toHaveBeenCalled();
    H.count.mockResolvedValue(2);
    expect(await desactivarCategoria(ADMIN, "k1")).toEqual({ ok: true });
    expect(H.updateMany).toHaveBeenCalledWith({ where: { id: "k1", workspaceId: "ws-1" }, data: { isActive: false } });
    expect(H.count.mock.calls[0][0].where).toEqual({ workspaceId: "ws-1", isActive: true });
  });
  it("activar: sólo una desactivada del workspace", async () => {
    await activarCategoria(ADMIN, "k1");
    expect(H.updateMany.mock.calls[0][0].where).toEqual({ id: "k1", workspaceId: "ws-1", isActive: false });
  });
});
