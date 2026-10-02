import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  tagFind: vi.fn(), tagFindMany: vi.fn(), tagCreate: vi.fn(), tagUpdateMany: vi.fn(), tagDeleteMany: vi.fn(),
  asgFind: vi.fn(), asgFindMany: vi.fn(), asgCreate: vi.fn(), asgUpdateMany: vi.fn(), asgDeleteMany: vi.fn(),
  evCreateMany: vi.fn(), evento: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./eventos", () => ({ registrarEventoPersona: H.evento }));
vi.mock("@repo/db", () => {
  const prisma = {
    fotofficeTag: {
      findFirst: H.tagFind, findMany: H.tagFindMany, create: H.tagCreate, updateMany: H.tagUpdateMany, deleteMany: H.tagDeleteMany,
    },
    fotofficeTagAssignment: {
      findFirst: H.asgFind, findMany: H.asgFindMany, create: H.asgCreate, updateMany: H.asgUpdateMany, deleteMany: H.asgDeleteMany,
    },
    fotofficePersonEvent: { createMany: H.evCreateMany },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});

const E = await import("./etiquetas");

const ADMIN = { workspaceId: "ws-1", userId: 1, userLabel: "Ana", role: "WORKSPACE_ADMIN" };
const EQUIPO = { ...ADMIN, role: "STAFF" };
const PERSONA = { clientId: "c1", memberId: null };

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
});

describe("claveDeEtiqueta / validarNombreEtiqueta", () => {
  it("colapsa espacios y baja a minúsculas", () => expect(E.claveDeEtiqueta("  Egresado  2025 ")).toBe("egresado 2025"));
  it("saca acentos", () => expect(E.claveDeEtiqueta("VÍP")).toBe("vip"));
  it("Vip y VIP chocan", () => expect(E.claveDeEtiqueta("Vip")).toBe(E.claveDeEtiqueta("VIP")));
  it("nombre de 1 a 40", () => {
    expect(E.validarNombreEtiqueta("  ")).toBeNull();
    expect(E.validarNombreEtiqueta("a".repeat(41))).toBeNull();
    expect(E.validarNombreEtiqueta(" Ex  alumno ")).toBe("Ex alumno");
    expect(E.validarNombreEtiqueta(5)).toBeNull();
  });
  it("paleta de 8", () => expect(E.COLORES_ETIQUETA).toHaveLength(8));
});

describe("ponerEtiqueta", () => {
  it("la primera vez crea la asignación y un evento", async () => {
    H.tagFind.mockResolvedValue({ id: "t1", name: "VIP" });
    H.asgFind.mockResolvedValue(null);
    expect(await E.ponerEtiqueta(EQUIPO, PERSONA, { tagId: "t1" })).toEqual({ ok: true });
    expect(H.asgCreate).toHaveBeenCalledTimes(1);
    expect(H.evento).toHaveBeenCalledTimes(1);
    expect(H.evento.mock.calls[0][1]).toMatchObject({ kind: "ETIQUETA_PUESTA", detail: { tagId: "t1", nombre: "VIP" } });
  });
  it("si ya la tiene no duplica ni genera otro evento", async () => {
    H.tagFind.mockResolvedValue({ id: "t1", name: "VIP" });
    H.asgFind.mockResolvedValue({ id: "a1" });
    expect(await E.ponerEtiqueta(EQUIPO, PERSONA, { tagId: "t1" })).toEqual({ ok: true });
    expect(H.asgCreate).not.toHaveBeenCalled();
    expect(H.evento).not.toHaveBeenCalled();
  });
  it("carrera contra el índice único: no falla y no deja evento", async () => {
    H.tagFind.mockResolvedValue({ id: "t1", name: "VIP" });
    H.asgFind.mockResolvedValue(null);
    H.asgCreate.mockRejectedValue({ code: "P2002" });
    expect((await E.ponerEtiqueta(EQUIPO, PERSONA, { tagId: "t1" })).ok).toBe(true);
    expect(H.evento).not.toHaveBeenCalled();
  });
  it("etiqueta de otro workspace: no encontrada", async () => {
    H.tagFind.mockResolvedValue(null);
    expect((await E.ponerEtiqueta(EQUIPO, PERSONA, { tagId: "ajena" })).ok).toBe(false);
    expect(H.tagFind.mock.calls[0][0].where.workspaceId).toBe("ws-1");
    expect(H.asgCreate).not.toHaveBeenCalled();
  });
  it("por nombre crea si no existe, con su clave", async () => {
    H.tagFind.mockResolvedValue(null);
    H.tagCreate.mockResolvedValue({ id: "t9", name: "Vip" });
    H.asgFind.mockResolvedValue(null);
    await E.ponerEtiqueta(EQUIPO, PERSONA, { nombre: " Vip " });
    expect(H.tagCreate.mock.calls[0][0].data).toMatchObject({ workspaceId: "ws-1", name: "Vip", nameKey: "vip" });
  });
  it("por nombre, 'VIP' encuentra la existente 'Vip'", async () => {
    H.tagFind.mockResolvedValue({ id: "t1", name: "Vip" });
    H.asgFind.mockResolvedValue({ id: "a" });
    await E.ponerEtiqueta(EQUIPO, PERSONA, { nombre: "VIP" });
    expect(H.tagFind.mock.calls[0][0].where).toEqual({ workspaceId: "ws-1", nameKey: "vip" });
    expect(H.tagCreate).not.toHaveBeenCalled();
  });
});

describe("quitarEtiqueta", () => {
  it("con asignación deja un evento; sin ella, ninguno", async () => {
    H.tagFind.mockResolvedValue({ id: "t1", name: "VIP" });
    H.asgDeleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await E.quitarEtiqueta(EQUIPO, PERSONA, "t1");
    await E.quitarEtiqueta(EQUIPO, PERSONA, "t1");
    expect(H.evento).toHaveBeenCalledTimes(1);
    expect(H.evento.mock.calls[0][1].kind).toBe("ETIQUETA_QUITADA");
  });
});

describe("catálogo", () => {
  it("Equipo no puede tocar el catálogo", async () => {
    expect((await E.renombrarEtiqueta(EQUIPO, "t1", "x")).ok).toBe(false);
    expect((await E.cambiarColor(EQUIPO, "t1", "rojo")).ok).toBe(false);
    expect((await E.unirEtiquetas(EQUIPO, "a", "b")).ok).toBe(false);
    expect((await E.borrarEtiqueta(EQUIPO, "t1")).ok).toBe(false);
    expect(H.tagUpdateMany).not.toHaveBeenCalled();
    expect(H.tagDeleteMany).not.toHaveBeenCalled();
  });
  it("renombrar a un nombre que choca con otra: error", async () => {
    H.tagFind.mockResolvedValueOnce({ id: "t1" }).mockResolvedValueOnce({ id: "t2" });
    expect(await E.renombrarEtiqueta(ADMIN, "t1", "VÍP")).toEqual({ ok: false, error: "Ya existe una etiqueta con ese nombre." });
    expect(H.tagUpdateMany).not.toHaveBeenCalled();
  });
  it("color fuera de la paleta se rechaza", async () => {
    expect((await E.cambiarColor(ADMIN, "t1", "fucsia")).ok).toBe(false);
    expect(H.tagUpdateMany).not.toHaveBeenCalled();
  });
  it("unir mueve sin duplicar y borra el origen", async () => {
    H.tagFindMany.mockResolvedValue([{ id: "o" }, { id: "d" }]);
    H.asgFindMany
      .mockResolvedValueOnce([{ clientId: "c1", memberId: null }]) // destino
      .mockResolvedValueOnce([
        { id: "a1", clientId: "c1", memberId: null }, // repetida
        { id: "a2", clientId: "c2", memberId: null },
        { id: "a3", clientId: null, memberId: "m1" },
      ]);
    expect((await E.unirEtiquetas(ADMIN, "o", "d")).ok).toBe(true);
    expect(H.asgUpdateMany.mock.calls[0][0]).toMatchObject({ where: { id: { in: ["a2", "a3"] } }, data: { tagId: "d" } });
    expect(H.tagDeleteMany.mock.calls[0][0].where).toEqual({ id: "o", workspaceId: "ws-1" });
  });
  it("unir con una etiqueta ajena: no toca nada", async () => {
    H.tagFindMany.mockResolvedValue([{ id: "o" }]);
    expect((await E.unirEtiquetas(ADMIN, "o", "ajena")).ok).toBe(false);
    expect(H.tagDeleteMany).not.toHaveBeenCalled();
  });
  it("borrar deja un evento por persona, en la misma transacción", async () => {
    H.tagFind.mockResolvedValue({ id: "t1", name: "VIP" });
    H.asgFindMany.mockResolvedValue([
      { clientId: "c1", memberId: null },
      { clientId: null, memberId: "m1" },
    ]);
    expect((await E.borrarEtiqueta(ADMIN, "t1")).ok).toBe(true);
    const data = H.evCreateMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data.every((e: { kind: string }) => e.kind === "ETIQUETA_QUITADA")).toBe(true);
    expect(data[1]).toMatchObject({ clientId: null, memberId: "m1" });
    expect(H.tagDeleteMany).toHaveBeenCalled();
  });
});

describe("listarCatalogoDeEtiquetas", () => {
  it("del workspace, con cuántas personas la tienen", async () => {
    H.tagFindMany.mockResolvedValue([{ id: "t1", name: "VIP", color: "rojo", _count: { assignments: 3 } }]);
    expect(await E.listarCatalogoDeEtiquetas("ws-1")).toEqual([{ id: "t1", name: "VIP", color: "rojo", personas: 3 }]);
    expect(H.tagFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws-1" });
  });
});
