import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  findFirst: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  catFind: vi.fn(),
  evento: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./eventos", () => ({ registrarEventoPersona: H.evento }));
vi.mock("@repo/db", () => {
  const prisma = {
    fotofficeNote: { findFirst: H.findFirst, count: H.count, updateMany: H.update, create: H.create },
    fotofficeNoteCategory: { findFirst: H.catFind },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});

const { validarNota, puedeModificarNota, borrarNota, fijarNota, crearNota } = await import("./notas");

const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "Ana", role: "STAFF", persona: { clientId: "c1", memberId: null } };

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.update.mockResolvedValue({ count: 1 });
});

describe("validarNota", () => {
  it("rechaza vacío y sólo espacios", () => {
    expect(validarNota({ body: "", categoryId: "x" }).ok).toBe(false);
    expect(validarNota({ body: "   \n ", categoryId: "x" }).ok).toBe(false);
  });
  it("recorta y acepta 4.000; rechaza 4.001", () => {
    expect(validarNota({ body: "  hola ", categoryId: "x" })).toEqual({ ok: true, body: "hola" });
    expect(validarNota({ body: "a".repeat(4000), categoryId: "x" }).ok).toBe(true);
    expect(validarNota({ body: "a".repeat(4001), categoryId: "x" }).ok).toBe(false);
  });
});

describe("puedeModificarNota", () => {
  it("el autor sí", () => expect(puedeModificarNota({ role: "STAFF", userId: 1 }, { authorUserId: 1 })).toBe(true));
  it("Equipo ajeno no", () => expect(puedeModificarNota({ role: "STAFF", userId: 2 }, { authorUserId: 1 })).toBe(false));
  it("Administrador ajeno sí", () => expect(puedeModificarNota({ role: "WORKSPACE_ADMIN", userId: 2 }, { authorUserId: 1 })).toBe(true));
  it("nota importada sin autor: sólo configurar", () => {
    expect(puedeModificarNota({ role: "STAFF", userId: 2 }, { authorUserId: null })).toBe(false);
    expect(puedeModificarNota({ role: "WORKSPACE_OWNER", userId: 2 }, { authorUserId: null })).toBe(true);
  });
});

describe("crearNota", () => {
  it("categoría de otro workspace: no escribe", async () => {
    H.catFind.mockResolvedValue(null);
    const r = await crearNota(CTX, { body: "hola", categoryId: "cat-x" });
    expect(r.ok).toBe(false);
    expect(H.catFind.mock.calls[0][0].where.workspaceId).toBe("ws-1");
    expect(H.create).not.toHaveBeenCalled();
  });
  it("guarda bajo el dueño con el autor", async () => {
    H.catFind.mockResolvedValue({ id: "cat" });
    expect((await crearNota(CTX, { body: " hola ", categoryId: "cat" })).ok).toBe(true);
    expect(H.create.mock.calls[0][0].data).toMatchObject({
      workspaceId: "ws-1", clientId: "c1", categoryId: "cat", body: "hola", authorUserId: 1, authorLabel: "Ana",
    });
  });
});

describe("borrarNota", () => {
  it("nota que no es de la persona: no encontrada, sin escribir", async () => {
    H.findFirst.mockResolvedValue(null);
    expect(await borrarNota(CTX, "n1")).toEqual({ ok: false, error: "No encontramos esa nota." });
    expect(H.update).not.toHaveBeenCalled();
  });
  it("Equipo ajeno no puede borrar", async () => {
    H.findFirst.mockResolvedValue({ id: "n1", authorUserId: 9, categoryId: null, pinned: false });
    expect((await borrarNota(CTX, "n1")).ok).toBe(false);
    expect(H.update).not.toHaveBeenCalled();
  });
  it("borra blando y anota el evento sin el texto", async () => {
    H.findFirst.mockResolvedValue({ id: "n1", authorUserId: 1, categoryId: "cat", pinned: false });
    expect((await borrarNota(CTX, "n1")).ok).toBe(true);
    expect(H.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    const ev = H.evento.mock.calls[0][1];
    expect(ev.kind).toBe("NOTA_BORRADA");
    expect(JSON.stringify(ev.detail)).not.toContain("body");
  });
});

describe("fijarNota", () => {
  it("la cuarta fijada da el mensaje exacto", async () => {
    H.findFirst.mockResolvedValue({ id: "n1", authorUserId: 1, categoryId: "c", pinned: false });
    H.count.mockResolvedValue(3);
    expect(await fijarNota(CTX, "n1", true)).toEqual({ ok: false, error: "Ya hay 3 notas fijadas: desfijá una primero." });
    expect(H.update).not.toHaveBeenCalled();
  });
  it("con menos de 3 fija", async () => {
    H.findFirst.mockResolvedValue({ id: "n1", authorUserId: 1, categoryId: "c", pinned: false });
    H.count.mockResolvedValue(2);
    expect((await fijarNota(CTX, "n1", true)).ok).toBe(true);
  });
  it("desfijar no mira el tope", async () => {
    H.findFirst.mockResolvedValue({ id: "n1", authorUserId: 1, categoryId: null, pinned: true });
    expect((await fijarNota(CTX, "n1", false)).ok).toBe(true);
    expect(H.count).not.toHaveBeenCalled();
  });
});
