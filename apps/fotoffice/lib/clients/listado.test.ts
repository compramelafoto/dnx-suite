import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@repo/db", () => ({ prisma: { client: { findMany: (...a: unknown[]) => findMany(...a) } } }));
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

describe("definición", () => {
  it("ninguna clave de filtro está reservada", () => {
    for (const f of listadoClientes.filtros) expect(PARAMETROS_RESERVADOS as readonly string[]).not.toContain(f.clave);
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
