import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  movFindMany: vi.fn(),
  movCount: vi.fn(),
  movUpdateMany: vi.fn(),
  catFindMany: vi.fn(),
  catFindFirst: vi.fn(),
  cuentaFindMany: vi.fn(),
  cuentaFindFirst: vi.fn(),
  clienteFindMany: vi.fn(),
  clienteFindFirst: vi.fn(),
  txOpciones: vi.fn(),
}));

vi.mock("@repo/db", () => {
  const prisma = {
    cashMovement: {
      findMany: (...a: unknown[]) => H.movFindMany(...a),
      count: (...a: unknown[]) => H.movCount(...a),
      updateMany: (...a: unknown[]) => H.movUpdateMany(...a),
    },
    cashCategory: { findMany: (...a: unknown[]) => H.catFindMany(...a), findFirst: (...a: unknown[]) => H.catFindFirst(...a) },
    cashAccount: { findMany: (...a: unknown[]) => H.cuentaFindMany(...a), findFirst: (...a: unknown[]) => H.cuentaFindFirst(...a) },
    client: { findMany: (...a: unknown[]) => H.clienteFindMany(...a), findFirst: (...a: unknown[]) => H.clienteFindFirst(...a) },
    $transaction: (fn: (tx: unknown) => unknown, opciones?: unknown) => {
      H.txOpciones(opciones);
      return fn(prisma);
    },
  };
  return { prisma };
});

// El botón de anular de cada fila es una Server Action: acá no se ejecuta.
vi.mock("@/app/(shell)/caja/actions", () => ({ reverseMovementAction: vi.fn() }));

import { listadoMovimientos, separarElegiblesRubro, whereMovimientos } from "./listado-movimientos";
import { PARAMETROS_RESERVADOS, type ConsultaResuelta, type ContextoListado } from "@/lib/listado/tipos";

const mov = (o: Partial<{ id: string; kind: string; sourceModule: string; transferId: string | null; isReversed: boolean; reversesMovementId: string | null; categoryId: string | null }>) => ({
  id: "m", kind: "INGRESO", sourceModule: "manual", transferId: null, isReversed: false, reversesMovementId: null, categoryId: null, ...o,
});

const base = { q: "", filtros: {}, periodos: {}, etiquetasRelacion: {}, orden: { campo: "fecha", desc: true }, pagina: 1, filas: 25, ver: null } as ConsultaResuelta;
const ctx: ContextoListado = { workspaceId: "w1", workspaceName: "W", userId: 7, userLabel: "Ana", role: "OWNER" };
const def = listadoMovimientos;
const rubro = () => def.acciones.find((a) => a.clave === "rubro")!;

describe("separarElegiblesRubro", () => {
  const rubroIngreso = { id: "r1", kind: "INGRESO" };
  it("sólo manuales, sin pase, sin anular, del mismo tipo y con otro rubro", () => {
    const r = separarElegiblesRubro(
      [
        mov({ id: "ok" }),
        mov({ id: "cuota", sourceModule: "membership" }),
        mov({ id: "pase", transferId: "t" }),
        mov({ id: "anulado", isReversed: true }),
        mov({ id: "anulacion", reversesMovementId: "x" }),
        mov({ id: "egreso", kind: "EGRESO" }),
        mov({ id: "igual", categoryId: "r1" }),
      ],
      rubroIngreso,
    );
    expect(r.elegibles).toEqual(["ok"]);
    expect(r.excluidos.map((e) => e.id)).toEqual(["cuota", "pase", "anulado", "anulacion", "egreso", "igual"]);
    expect(r.excluidos[0].motivo).toBe("viene de Cuotas: se corrige en su módulo");
    expect(r.excluidos.map((e) => e.motivo).slice(1)).toEqual([
      "es un pase entre cuentas",
      "está anulado",
      "es una anulación",
      "es un egreso y el rubro es de ingresos",
      "ya tiene ese rubro",
    ]);
  });

  it("el motivo de tipo se da vuelta con un rubro de egresos", () => {
    const r = separarElegiblesRubro([mov({ id: "i" })], { id: "r2", kind: "EGRESO" });
    expect(r.excluidos).toEqual([{ id: "i", motivo: "es un ingreso y el rubro es de egresos" }]);
  });
});

describe("whereMovimientos", () => {
  it("siempre workspace; período sobre occurredAt; cliente por id", () => {
    const desde = new Date("2026-09-01T03:00:00Z"), hasta = new Date("2026-10-01T02:59:59.999Z");
    const w = whereMovimientos("w1", {
      q: "", filtros: { periodo: "este-mes", cliente: "c1", tipo: "EGRESO" }, periodos: { periodo: { desde, hasta } },
      etiquetasRelacion: {}, orden: { campo: "fecha", desc: true }, pagina: 1, filas: 25, ver: null,
    });
    expect(w).toEqual({ workspaceId: "w1", clientId: "c1", kind: "EGRESO", occurredAt: { gte: desde, lte: hasta } });
  });

  it("sin nada, sólo el workspace", () => expect(whereMovimientos("w1", base)).toEqual({ workspaceId: "w1" }));

  it("cuenta, rubro, medio y origen", () => {
    expect(whereMovimientos("w1", { ...base, filtros: { cuenta: "a1", rubro: "r1", medio: "TARJETA", origen: "sales" } })).toEqual({
      workspaceId: "w1", accountId: "a1", categoryId: "r1", paymentMethod: "TARJETA", sourceModule: "sales",
    });
  });

  it("ignora valores que no existen", () => {
    expect(whereMovimientos("w1", { ...base, filtros: { tipo: "OTRO", medio: "BITCOIN", origen: "x" } })).toEqual({ workspaceId: "w1" });
  });

  it("busca en descripción, comprobante y nombre del cliente", () => {
    const w = whereMovimientos("w1", { ...base, q: " luz " });
    expect(w.workspaceId).toBe("w1");
    expect(w.OR).toEqual([
      { description: { contains: "luz", mode: "insensitive" } },
      { receiptRef: { contains: "luz", mode: "insensitive" } },
      {
        client: {
          OR: [
            { firstName: { contains: "luz", mode: "insensitive" } },
            { lastName: { contains: "luz", mode: "insensitive" } },
            { businessName: { contains: "luz", mode: "insensitive" } },
          ],
        },
      },
    ]);
  });
});

describe("definición", () => {
  it("clave, sustantivo y orden por defecto", () => {
    expect(def.clave).toBe("caja-movimientos");
    expect(def.sustantivo).toEqual({ singular: "movimiento", plural: "movimientos" });
    expect(def.ordenPorDefecto).toEqual({ campo: "fecha", desc: true });
  });
  it("ninguna clave de filtro está reservada", () => {
    for (const f of def.filtros) expect(PARAMETROS_RESERVADOS as readonly string[]).not.toContain(f.clave);
  });
  it("los órdenes incluyen el de por defecto y los de las columnas", () => {
    expect(def.ordenes).toContain(def.ordenPorDefecto.campo);
    for (const c of def.columnas) if (c.orden) expect(def.ordenes).toContain(c.orden);
  });
  it("el filtro de cliente es un buscador", () => {
    expect(def.filtros.find((f) => f.clave === "cliente")).toMatchObject({ tipo: "relacion", conBuscador: true });
  });
  it("cambiar rubro: operar, 5.000", () => {
    expect(rubro().capacidad).toBe("operar");
    expect(rubro().maximo).toBe(5000);
    expect(rubro().confirmacion).toBe("Vas a cambiar el rubro de {n} movimientos a {parametro}.");
  });
});

describe("acceso a filas", () => {
  beforeEach(() => {
    H.movFindMany.mockReset();
    H.movCount.mockReset();
  });

  it("traerPorIds devuelve en el orden pedido, filtra por workspace e ignora ids mal formados", async () => {
    const fila = (id: string) => ({
      id, kind: "INGRESO", amountArs: "10.00", occurredAt: new Date(), accountId: "a", account: { name: "Caja" }, shiftId: null,
      categoryId: null, category: null, paymentMethod: "EFECTIVO", clientId: null, client: null, description: "d", receiptRef: null,
      sourceModule: "manual", sourceRef: null, reversesMovementId: null, reverseReason: null, reversedBy: null, transferId: null,
    });
    H.movFindMany.mockResolvedValue([fila("a"), fila("b")]);
    const filas = await def.traerPorIds(ctx, ["b", "../x", "a"]);
    expect(filas.map((f) => f.id)).toEqual(["b", "a"]);
    expect(filas[0].amountMinor).toBe(1000);
    expect(H.movFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1", id: { in: ["b", "a"] } });
  });

  it("traerPorIds sin ids válidos no consulta", async () => {
    expect(await def.traerPorIds(ctx, ["!!"])).toEqual([]);
    expect(H.movFindMany).not.toHaveBeenCalled();
  });

  it("contar, traer y traerIds filtran por workspace y desempatan por id", async () => {
    H.movFindMany.mockResolvedValue([]);
    H.movCount.mockResolvedValue(0);
    await def.contar(ctx, base);
    await def.traer(ctx, base, { skip: 0, take: 25 });
    await def.traerIds(ctx, { ...base, orden: { campo: "importe", desc: false } }, 100);
    expect(H.movCount.mock.calls[0][0].where.workspaceId).toBe("w1");
    for (const call of H.movFindMany.mock.calls) expect(call[0].where.workspaceId).toBe("w1");
    expect(H.movFindMany.mock.calls[0][0].orderBy).toEqual([{ occurredAt: "desc" }, { id: "desc" }]);
    expect(H.movFindMany.mock.calls[1][0].orderBy).toEqual([{ amountArs: "asc" }, { id: "asc" }]);
  });
});

describe("relaciones", () => {
  beforeEach(() => {
    H.clienteFindMany.mockReset();
    H.clienteFindFirst.mockReset();
    H.cuentaFindFirst.mockReset();
    H.catFindFirst.mockReset();
  });

  it("buscarRelacion busca clientes del workspace, hasta 20", async () => {
    H.clienteFindMany.mockResolvedValue([{ id: "c1", kind: "PERSONA", firstName: "Ana", lastName: "Paz", businessName: null }]);
    expect(await def.buscarRelacion!(ctx, "cliente", "paz")).toEqual([{ valor: "c1", etiqueta: "Paz, Ana" }]);
    const args = H.clienteFindMany.mock.calls[0][0];
    expect(args.where.workspaceId).toBe("w1");
    expect(args.take).toBe(20);
    expect(await def.buscarRelacion!(ctx, "cuenta", "paz")).toEqual([]);
  });

  it("validarRelacion mira el workspace y rechaza ids mal formados", async () => {
    H.clienteFindFirst.mockResolvedValue({ kind: "EMPRESA", firstName: null, lastName: null, businessName: "Foto SA" });
    expect(await def.validarRelacion!(ctx, "cliente", "c1")).toBe("Foto SA");
    expect(H.clienteFindFirst.mock.calls[0][0].where).toEqual({ id: "c1", workspaceId: "w1" });
    H.cuentaFindFirst.mockResolvedValue({ name: "Caja diaria" });
    expect(await def.validarRelacion!(ctx, "cuenta", "a1")).toBe("Caja diaria");
    expect(H.cuentaFindFirst.mock.calls[0][0].where).toEqual({ id: "a1", workspaceId: "w1" });
    H.catFindFirst.mockResolvedValue({ name: "Luz", kind: "EGRESO" });
    expect(await def.validarRelacion!(ctx, "rubro", "r1")).toBe("Luz (egreso)");
    expect(H.catFindFirst.mock.calls[0][0].where).toEqual({ id: "r1", workspaceId: "w1" });
    expect(await def.validarRelacion!(ctx, "cliente", "../x")).toBeNull();
  });
});

describe("cambiar rubro", () => {
  beforeEach(() => {
    H.movFindMany.mockReset();
    H.movUpdateMany.mockReset();
    H.catFindMany.mockReset();
    H.catFindFirst.mockReset();
  });

  it("las opciones son los rubros activos de este workspace, con su tipo", async () => {
    H.catFindMany.mockResolvedValue([{ id: "r1", name: "Luz", kind: "EGRESO" }]);
    expect(await rubro().parametro!.opciones!(ctx)).toEqual([{ valor: "r1", etiqueta: "Luz (egreso)" }]);
    expect(H.catFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1", isActive: true });
  });

  it("elegibles lee del workspace y separa con motivos", async () => {
    H.catFindFirst.mockResolvedValue({ id: "r1", kind: "INGRESO" });
    H.movFindMany.mockResolvedValue([
      { ...mov({ id: "a" }), reversedBy: null },
      { ...mov({ id: "b", sourceModule: "bookings" }), reversedBy: null },
      { ...mov({ id: "c" }), reversedBy: { id: "z" } },
    ]);
    const r = await rubro().elegibles!(ctx, ["a", "b", "c", "d"], "r1");
    expect(r.elegibles).toEqual(["a"]);
    expect(r.excluidos).toEqual([
      { id: "b", motivo: "viene de Reservas: se corrige en su módulo" },
      { id: "c", motivo: "está anulado" },
      { id: "d", motivo: "no encontrado" },
    ]);
    expect(H.movFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1", id: { in: ["a", "b", "c", "d"] } });
    expect(H.catFindFirst.mock.calls[0][0].where).toEqual({ id: "r1", workspaceId: "w1", isActive: true });
  });

  it("aplicar sólo escribe categoryId, con la guarda completa, y cuenta lo que cambió mientras tanto", async () => {
    H.catFindFirst.mockResolvedValue({ id: "r1", kind: "INGRESO" });
    H.movFindMany.mockResolvedValue([
      { id: "a", categoryId: "r0" },
      { id: "b", categoryId: null },
    ]);
    H.movUpdateMany.mockResolvedValue({ count: 1 });
    // Tras escribir, se relee para saber cuál quedó sin cambiar.
    H.movFindMany.mockResolvedValueOnce([
      { id: "a", categoryId: "r0" },
      { id: "b", categoryId: null },
    ]).mockResolvedValueOnce([{ id: "a", categoryId: "r1" }, { id: "b", categoryId: null }]);
    const r = await rubro().aplicar(ctx, ["a", "b"], "r1");
    expect(H.movUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["a", "b"] },
        workspaceId: "w1",
        sourceModule: "manual",
        transferId: null,
        reversesMovementId: null,
        reversedBy: { is: null },
        kind: "INGRESO",
      },
      data: { categoryId: "r1" },
    });
    expect(r.aplicados).toBe(1);
    expect(r.fallidos).toEqual([{ id: "b", error: "cambió mientras tanto" }]);
    expect(r.detalle).toEqual([{ id: "a", antes: "r0", despues: "r1" }]);
    for (const call of H.movFindMany.mock.calls) expect(call[0].where.workspaceId).toBe("w1");
    expect(H.catFindFirst.mock.calls[0][0].where).toEqual({ id: "r1", workspaceId: "w1", isActive: true });
    // El lote entero va en una transacción: con el plazo por defecto (5 s) no alcanza.
    expect(H.txOpciones).toHaveBeenCalledWith({ timeout: 30_000 });
  });

  it("aplicar no toca nada si el rubro no es de este workspace o está inactivo", async () => {
    H.catFindFirst.mockResolvedValue(null);
    const r = await rubro().aplicar(ctx, ["a"], "ajeno");
    expect(r).toEqual({ aplicados: 0, fallidos: [{ id: "a", error: "rubro no válido" }], detalle: [] });
    expect(H.movUpdateMany).not.toHaveBeenCalled();
  });

  it("aplicar rechaza un parámetro mal formado sin consultar", async () => {
    const r = await rubro().aplicar(ctx, ["a"], "../x");
    expect(r.aplicados).toBe(0);
    expect(H.catFindFirst).not.toHaveBeenCalled();
  });
});
