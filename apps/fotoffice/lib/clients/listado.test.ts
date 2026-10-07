import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const tagFindFirst = vi.fn();
const tagFindMany = vi.fn();
const poner = vi.fn();
const quitar = vi.fn();
vi.mock("@repo/db", () => ({
  prisma: {
    client: { findMany: (...a: unknown[]) => findMany(...a) },
    fotofficeTag: { findFirst: (...a: unknown[]) => tagFindFirst(...a), findMany: (...a: unknown[]) => tagFindMany(...a) },
  },
}));
vi.mock("@/lib/ficha/etiquetas", () => ({
  ponerEtiqueta: (...a: unknown[]) => poner(...a),
  quitarEtiqueta: (...a: unknown[]) => quitar(...a),
  buscarEtiquetas: vi.fn(async () => []),
}));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: vi.fn(async () => false) }));

import { listadoClientes, whereClientes } from "./listado";
import { PARAMETROS_RESERVADOS, type ConsultaResuelta, type ContextoListado } from "@/lib/listado/tipos";

const base = { q: "", filtros: {}, periodos: {}, etiquetasRelacion: {}, orden: { campo: "numero", desc: true }, pagina: 1, filas: 25, ver: null } as ConsultaResuelta;
const ctx: ContextoListado = { workspaceId: "w1", workspaceName: "W", userId: 1, userLabel: "u", role: "OWNER" };

describe("whereClientes", () => {
  it("siempre filtra por workspace", () => expect(whereClientes("w1", base)).toEqual({ workspaceId: "w1" }));
  it("traduce tipo, estado y movimientos", () => {
    expect(whereClientes("w1", { ...base, filtros: { tipo: "EMPRESA", estado: "ACTIVO", movimientos: "no" } })).toEqual({
      workspaceId: "w1", kind: "EMPRESA", status: "ACTIVO", movements: { none: {} },
    });
    expect(whereClientes("w1", { ...base, filtros: { movimientos: "si" } }).movements).toEqual({ some: {} });
  });
  it("busca por número y documento sin puntos", () => {
    const w = whereClientes("w1", { ...base, q: "20.123" });
    expect(w.OR).toContainEqual({ docNumber: { contains: "20123" } });
    expect(w.OR).not.toContainEqual(expect.objectContaining({ clientNumber: expect.anything() }));
    const n = whereClientes("w1", { ...base, q: "42" });
    expect(n.OR).toContainEqual({ clientNumber: 42 });
  });
  it("período de alta", () => {
    const desde = new Date("2026-09-01T03:00:00Z"), hasta = new Date("2026-10-01T02:59:59.999Z");
    expect(whereClientes("w1", { ...base, filtros: { alta: "este-mes" }, periodos: { alta: { desde, hasta } } }).createdAt).toEqual({ gte: desde, lte: hasta });
  });
});

describe("campos personalizados en el where", () => {
  it("la búsqueda suma los ids de los campos al OR y los filtros acotan con AND", () => {
    const w = whereClientes("w1", { ...base, q: "boda", campos: { soloIds: ["c1", "c2"], buscarIds: ["c1", "c3"] } });
    expect(w.workspaceId).toBe("w1");
    // c3 no cumple los filtros: igual quedaría afuera y no viaja.
    expect(w.OR).toContainEqual({ id: { in: ["c1"] } });
    expect(w.AND).toEqual([{ id: { in: ["c1", "c2"] } }]);
  });
  it("si filtros y búsqueda juntos pasan el presupuesto de ids, la lista queda vacía", () => {
    const rango = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);
    const w = whereClientes("w1", { ...base, q: "boda", campos: { soloIds: rango(15_000), buscarIds: rango(18_000) } });
    expect(w.AND).toEqual([{ id: { in: [] } }]);
    expect(w.OR).not.toContainEqual(expect.objectContaining({ id: expect.anything() }));
  });
  it("una restricción vacía (tope superado) deja la lista vacía", () => {
    expect(whereClientes("w1", { ...base, campos: { soloIds: [], buscarIds: [] } }).AND).toEqual([{ id: { in: [] } }]);
  });
});

describe("definición", () => {
  it("ninguna clave de filtro está reservada", () => {
    for (const f of listadoClientes.filtros) expect(PARAMETROS_RESERVADOS as readonly string[]).not.toContain(f.clave);
  });
  it("ninguna clave propia usa el prefijo de los campos personalizados", () => {
    for (const f of listadoClientes.filtros) expect(f.clave.startsWith("cf_")).toBe(false);
    for (const c of listadoClientes.columnas) expect(c.clave.startsWith("cf_")).toBe(false);
  });
  it("los órdenes incluyen el de por defecto y los de las columnas", () => {
    expect(listadoClientes.ordenes).toContain(listadoClientes.ordenPorDefecto.campo);
    for (const c of listadoClientes.columnas) if (c.orden) expect(listadoClientes.ordenes).toContain(c.orden);
  });
});

describe("acceso a filas", () => {
  beforeEach(() => findMany.mockReset());

  it("traerPorIds devuelve en el orden pedido, filtra por workspace e ignora ids mal formados", async () => {
    findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const filas = await listadoClientes.traerPorIds(ctx, ["c", "no valido!", "a", "b", "../x"]);
    expect(filas.map((f) => f.id)).toEqual(["c", "a", "b"]);
    const where = findMany.mock.calls[0][0].where;
    expect(where.workspaceId).toBe("w1");
    expect(where.id.in).toEqual(["c", "a", "b"]);
  });

  it("traerPorIds sin ids válidos no consulta", async () => {
    expect(await listadoClientes.traerPorIds(ctx, ["!!"])).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("traer y traerIds filtran por workspace", async () => {
    findMany.mockResolvedValue([]);
    await listadoClientes.traer(ctx, base, { skip: 0, take: 25 });
    await listadoClientes.traerIds(ctx, base, 100);
    for (const call of findMany.mock.calls) expect(call[0].where.workspaceId).toBe("w1");
  });
});

describe("etiquetas", () => {
  const accion = listadoClientes.acciones.find((a) => a.clave === "etiqueta")!;
  beforeEach(() => {
    findMany.mockReset(); tagFindFirst.mockReset(); tagFindMany.mockReset(); poner.mockReset(); quitar.mockReset();
  });

  it("filtra por etiqueta", () => {
    expect(whereClientes("w1", { ...base, filtros: { etiqueta: "t1" } }).fotofficeTags).toEqual({ some: { tagId: "t1" } });
  });
  it("el filtro es una relación con buscador y validarRelacion rechaza etiquetas de otro workspace", async () => {
    expect(listadoClientes.filtros.find((f) => f.clave === "etiqueta")).toMatchObject({ tipo: "relacion", conBuscador: true });
    tagFindFirst.mockResolvedValue(null);
    expect(await listadoClientes.validarRelacion!(ctx, "etiqueta", "ajena")).toBeNull();
    expect(tagFindFirst.mock.calls[0][0].where).toEqual({ id: "ajena", workspaceId: "w1" });
    expect(await listadoClientes.validarRelacion!(ctx, "etiqueta", "no valido!")).toBeNull();
  });
  it("las opciones son + y - por cada etiqueta del workspace", async () => {
    tagFindMany.mockResolvedValue([{ id: "t1", name: "VIP" }]);
    expect(await accion.parametro!.opciones!(ctx)).toEqual([
      { valor: "+t1", etiqueta: "Agregar VIP" },
      { valor: "-t1", etiqueta: "Quitar VIP" },
    ]);
    expect(tagFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1" });
  });
  it("aplicar agrega y quita, y cuenta fallidos sin cortar el lote", async () => {
    tagFindFirst.mockResolvedValue({ id: "t1" });
    findMany.mockResolvedValue([{ id: "a", memberId: "m1" }, { id: "b", memberId: null }]);
    poner.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "x" });
    const r = await accion.aplicar(ctx, ["a", "b", "zz"], "+t1");
    expect(r.aplicados).toBe(1);
    expect(r.fallidos).toEqual([{ id: "b", error: "x" }, { id: "zz", error: "no encontrado" }]);
    expect(poner.mock.calls[0][1]).toEqual({ clientId: "a", memberId: "m1" });
    expect(poner.mock.calls[0][2]).toEqual({ tagId: "t1" });
    quitar.mockResolvedValue({ ok: true });
    await accion.aplicar(ctx, ["a"], "-t1");
    expect(quitar.mock.calls[0][2]).toBe("t1");
  });
  it("aplicar no toca nada con una etiqueta ajena o un parámetro mal formado", async () => {
    tagFindFirst.mockResolvedValue(null);
    const r = await accion.aplicar(ctx, ["a"], "+ajena");
    expect(r.aplicados).toBe(0);
    expect(r.fallidos).toHaveLength(1);
    expect((await accion.aplicar(ctx, ["a"], "t1")).aplicados).toBe(0);
    expect(poner).not.toHaveBeenCalled();
  });
});
