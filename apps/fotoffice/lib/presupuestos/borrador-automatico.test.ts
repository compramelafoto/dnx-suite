import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const BA = await import("./borrador-automatico");

const niveles = { quotes: "MANAGE", "service-leads": "MANAGE", clients: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };
const EQUIPO = { workspaceId: "ws-1", userId: 2, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: niveles } as never };

beforeEach(() => {
  B.vaciar();
  B.agregar("fotofficeConsultaCategoria", { id: "cat-boda", workspaceId: "ws-1", name: "Boda", group: "Social", order: 1 });
  B.agregar("fotofficeConsultaCategoria", { id: "cat-15", workspaceId: "ws-1", name: "15 años", group: "Social", order: 2 });
  B.agregar("fotofficeConsultaCategoria", { id: "cat-vieja", workspaceId: "ws-1", name: "Vieja", group: "Social", archivedAt: new Date() });
  B.agregar("fotofficeConsultaCategoria", { id: "cat-ajena", workspaceId: "ws-2", name: "Boda", group: "Social" });
});

describe("guardarBorradorAuto", () => {
  it("encender crea la fila y apagar la borra", async () => {
    expect(await BA.guardarBorradorAuto(DUENO, "cat-boda", true)).toEqual({ ok: true });
    expect(await BA.armaBorradorAuto("ws-1", "cat-boda")).toBe(true);
    expect(await BA.armaBorradorAuto("ws-1", "cat-15")).toBe(false);
    expect(await BA.guardarBorradorAuto(DUENO, "cat-boda", false)).toEqual({ ok: true });
    expect(await BA.armaBorradorAuto("ws-1", "cat-boda")).toBe(false);
  });

  it("encender dos veces no duplica ni falla", async () => {
    await BA.guardarBorradorAuto(DUENO, "cat-boda", true);
    expect(await BA.guardarBorradorAuto(DUENO, "cat-boda", true)).toEqual({ ok: true });
    expect(await BA.categoriasConBorradorAuto("ws-1")).toEqual(new Set(["cat-boda"]));
  });

  it("exige configurar", async () => {
    const r = await BA.guardarBorradorAuto({ ...EQUIPO, acceso: { role: "STAFF", levels: {} } as never }, "cat-boda", true);
    expect(r.ok).toBe(false);
    expect(await BA.armaBorradorAuto("ws-1", "cat-boda")).toBe(false);
  });

  it("rechaza categorías ajenas, archivadas o inexistentes y datos inválidos", async () => {
    for (const c of ["cat-ajena", "cat-vieja", "nada"]) {
      expect((await BA.guardarBorradorAuto(DUENO, c, true)).ok).toBe(false);
    }
    expect((await BA.guardarBorradorAuto(DUENO, 5, true)).ok).toBe(false);
    expect((await BA.guardarBorradorAuto(DUENO, "cat-boda", "si")).ok).toBe(false);
    expect(await BA.categoriasConBorradorAuto("ws-1")).toEqual(new Set());
  });

  it("apagar sólo toca el workspace propio", async () => {
    B.agregar("fotofficePropuestaBorradorAuto", { workspaceId: "ws-2", categoryId: "cat-ajena" });
    await BA.guardarBorradorAuto(DUENO, "cat-boda", false);
    expect(await BA.categoriasConBorradorAuto("ws-2")).toEqual(new Set(["cat-ajena"]));
  });

  it("si la tabla falta devuelve el aviso de aplicar el SQL", async () => {
    B.tablas.fotofficePropuestaBorradorAuto.upsert = async () => { throw new Error("relation does not exist"); };
    B.tablas.fotofficePropuestaBorradorAuto.create = async () => { throw new Error("relation does not exist"); };
    expect(await BA.guardarBorradorAuto(DUENO, "cat-boda", true)).toEqual({ ok: false, error: BA.MENSAJES_BORRADOR_AUTO.fallo });
    B.tablas.fotofficePropuestaBorradorAuto.deleteMany = async () => { throw new Error("relation does not exist"); };
    expect(await BA.guardarBorradorAuto(DUENO, "cat-boda", false)).toEqual({ ok: false, error: BA.MENSAJES_BORRADOR_AUTO.fallo });
    expect(BA.MENSAJES_BORRADOR_AUTO.fallo).toBe("No se pudo guardar. ¿Ya se aplicó el SQL del borrador automático?");
  });
});

describe("lectura tolerante a la tabla faltante", () => {
  it("armaBorradorAuto devuelve false y categoriasConBorradorAuto null ante un error", async () => {
    B.tablas.fotofficePropuestaBorradorAuto.findFirst = async () => { throw new Error("relation does not exist"); };
    B.tablas.fotofficePropuestaBorradorAuto.findMany = async () => { throw new Error("relation does not exist"); };
    expect(await BA.armaBorradorAuto("ws-1", "cat-boda")).toBe(false);
    expect(await BA.categoriasConBorradorAuto("ws-1")).toBeNull();
  });
});
