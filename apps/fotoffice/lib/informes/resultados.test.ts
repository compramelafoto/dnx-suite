import { describe, expect, it } from "vitest";
import {
  armarResultados,
  asientosDeCaja,
  asientosDevengados,
  type Asiento,
  type MovimientoCajaFila,
  type RubroInfo,
} from "./resultados";

const MESES = ["2026-01", "2026-02", "2026-03"];
const rubro = (id: string, codigo: string | null, parentId: string | null = null, extra: Partial<RubroInfo> = {}): RubroInfo => ({
  id,
  nombre: `R-${id}`,
  codigo,
  parentId,
  activo: true,
  ...extra,
});
const RUBROS: RubroInfo[] = [
  rubro("ing", "3.1"),
  rubro("cos", "4.1"),
  rubro("gas", "5.1"),
  rubro("padre", "5.2"),
  rubro("hijo", null, "padre"),
  rubro("otro", "9.9"),
];
const a = (mes: string, categoryId: string | null, kind: "INGRESO" | "EGRESO", centavos: number, signo: 1 | -1 = 1): Asiento => ({ mes, categoryId, kind, centavos, signo });
const bloque = (m: ReturnType<typeof armarResultados>, c: string) => m.bloques.find((b) => b.clave === c)!;

describe("armarResultados", () => {
  it("separa ingresos, costos y gastos por código y calcula el resultado", () => {
    const m = armarResultados({
      meses: MESES,
      rubros: RUBROS,
      asientos: [a("2026-01", "ing", "INGRESO", 100_00), a("2026-01", "cos", "EGRESO", 30_00), a("2026-02", "gas", "EGRESO", 20_00)],
    });
    expect(bloque(m, "INGRESOS").porMes).toEqual([100_00, 0, 0]);
    expect(bloque(m, "COSTOS").porMes).toEqual([30_00, 0, 0]);
    expect(bloque(m, "GASTOS").porMes).toEqual([0, 20_00, 0]);
    expect(m.resultado.porMes).toEqual([70_00, -20_00, 0]);
    expect(m.resultado.total).toBe(50_00);
    expect(m.haySinClasificar).toBe(false);
  });

  it("un hijo sin código hereda el bloque del padre y suma al subtotal", () => {
    const m = armarResultados({ meses: MESES, rubros: RUBROS, asientos: [a("2026-01", "hijo", "EGRESO", 10_00), a("2026-01", "padre", "EGRESO", 5_00)] });
    const gastos = bloque(m, "GASTOS");
    const padre = gastos.filas.find((f) => f.categoryId === "padre")!;
    expect(padre.porMes).toEqual([15_00, 0, 0]);
    expect(padre.total).toBe(15_00);
    expect(padre.hijos.map((h) => [h.categoryId, h.total])).toEqual([["hijo", 10_00]]);
    expect(gastos.total).toBe(15_00);
    expect(bloque(m, "SIN_CLASIFICAR_EGRESO").total).toBe(0);
  });

  it("sin código, otro primer dígito o sin rubro van a Sin clasificar, separado por lado", () => {
    const m = armarResultados({
      meses: MESES,
      rubros: [...RUBROS, rubro("sc", null)],
      asientos: [
        a("2026-01", "otro", "EGRESO", 4_00),
        a("2026-01", "sc", "INGRESO", 9_00),
        a("2026-02", null, "EGRESO", 1_00),
        a("2026-02", "inexistente", "INGRESO", 2_00),
      ],
    });
    expect(bloque(m, "SIN_CLASIFICAR_EGRESO").total).toBe(5_00);
    expect(bloque(m, "SIN_CLASIFICAR_INGRESO").total).toBe(11_00);
    expect(bloque(m, "SIN_CLASIFICAR_EGRESO").filas.map((f) => f.nombre).sort()).toEqual(["R-otro", "Sin rubro"]);
    expect(bloque(m, "SIN_CLASIFICAR_INGRESO").filas.map((f) => f.nombre).sort()).toEqual(["R-sc", "Rubro no encontrado"]);
    expect(m.haySinClasificar).toBe(true);
    // Resultado = ing − cos − gas + sc ingreso − sc egreso
    expect(m.resultado.total).toBe(11_00 - 5_00);
  });

  it("un lado que no corresponde al bloque (egreso en rubro de ingresos) no infla el otro lado", () => {
    const m = armarResultados({ meses: MESES, rubros: RUBROS, asientos: [a("2026-01", "ing", "EGRESO", 7_00)] });
    expect(bloque(m, "INGRESOS").total).toBe(0);
    expect(bloque(m, "SIN_CLASIFICAR_EGRESO").total).toBe(7_00);
    expect(m.resultado.total).toBe(-7_00);
  });

  it("el signo -1 resta en el rubro y el mes del asiento", () => {
    const m = armarResultados({ meses: MESES, rubros: RUBROS, asientos: [a("2026-01", "ing", "INGRESO", 100_00), a("2026-02", "ing", "INGRESO", 100_00, -1)] });
    expect(bloque(m, "INGRESOS").porMes).toEqual([100_00, -100_00, 0]);
    expect(bloque(m, "INGRESOS").total).toBe(0);
  });

  it("ignora los meses fuera de la matriz", () => {
    const m = armarResultados({ meses: MESES, rubros: RUBROS, asientos: [a("2025-12", "ing", "INGRESO", 1_00), a("2026-04", "ing", "INGRESO", 1_00)] });
    expect(m.resultado.total).toBe(0);
  });

  it("los rubros activos del bloque aparecen en cero; los inactivos sólo con movimientos y marcados", () => {
    const rubros = [...RUBROS, rubro("viejo", "3.9", null, { activo: false })];
    const vacio = armarResultados({ meses: MESES, rubros, asientos: [] });
    expect(bloque(vacio, "INGRESOS").filas.map((f) => f.categoryId)).toEqual(["ing"]);
    const con = armarResultados({ meses: MESES, rubros, asientos: [a("2026-01", "viejo", "INGRESO", 3_00)] });
    const viejo = bloque(con, "INGRESOS").filas.find((f) => f.categoryId === "viejo")!;
    expect(viejo.inactivo).toBe(true);
  });

  it("ordena por código como números (3.1.2 antes que 3.1.10)", () => {
    const rubros = [rubro("a", "3.1.10"), rubro("b", "3.1.2")];
    const m = armarResultados({ meses: MESES, rubros, asientos: [] });
    expect(bloque(m, "INGRESOS").filas.map((f) => f.categoryId)).toEqual(["b", "a"]);
  });

  it("centavos exactos: nada de coma flotante", () => {
    const asientos = Array.from({ length: 10 }, () => a("2026-01", "ing", "INGRESO", 10)); // 10 × $0,10
    const m = armarResultados({ meses: MESES, rubros: RUBROS, asientos: [...asientos, a("2026-01", "ing", "INGRESO", 20)] });
    expect(bloque(m, "INGRESOS").total).toBe(120);
  });
});

const mov = (id: string, over: Partial<MovimientoCajaFila> = {}): MovimientoCajaFila => ({
  id,
  occurredAt: new Date("2026-02-10T15:00:00Z"),
  kind: "INGRESO",
  centavos: 100_00,
  categoryId: "ing",
  transferId: null,
  reversesMovementId: null,
  sourceModule: "manual",
  ...over,
});

describe("asientosDeCaja", () => {
  it("excluye las patas de transferencia", () => {
    expect(asientosDeCaja([mov("1", { transferId: "t" }), mov("2")], [])).toHaveLength(1);
  });

  it("mes en hora argentina: 01/03 01:00 UTC es febrero", () => {
    const [x] = asientosDeCaja([mov("1", { occurredAt: new Date("2026-03-01T01:00:00Z") })], []);
    expect(x.mes).toBe("2026-02");
  });

  it("la anulación resta en el rubro y lado del original, en el mes en que se anuló", () => {
    // Original: ingreso en enero, rubro ing. Anulación en marzo: egreso, otra categoría.
    const original = mov("o", { occurredAt: new Date("2026-01-10T15:00:00Z") });
    const anulacion = mov("r", { occurredAt: new Date("2026-03-05T15:00:00Z"), kind: "EGRESO", categoryId: "otra", reversesMovementId: "o" });
    const asientos = asientosDeCaja([original, anulacion], []);
    expect(asientos).toEqual([
      { mes: "2026-01", categoryId: "ing", kind: "INGRESO", centavos: 100_00, signo: 1 },
      { mes: "2026-03", categoryId: "ing", kind: "INGRESO", centavos: 100_00, signo: -1 },
    ]);
    const m = armarResultados({ meses: MESES, rubros: RUBROS, asientos });
    expect(bloque(m, "INGRESOS").porMes).toEqual([100_00, 0, -100_00]);
    expect(m.resultado.total).toBe(0);
  });

  it("el original puede venir fuera del lote", () => {
    const anulacion = mov("r", { kind: "EGRESO", categoryId: null, reversesMovementId: "fuera" });
    const [x] = asientosDeCaja([anulacion], [{ id: "fuera", kind: "INGRESO", categoryId: "ing" }]);
    expect(x).toMatchObject({ categoryId: "ing", kind: "INGRESO", signo: -1 });
  });

  it("anulación de una pata de transferencia se excluye", () => {
    const r = mov("r", { reversesMovementId: "t1", kind: "EGRESO" });
    expect(asientosDeCaja([r], [{ id: "t1", kind: "INGRESO", categoryId: null, transferId: "t" }])).toEqual([]);
  });

  it("sin el original, resta del lado contrario en la categoría del contramovimiento", () => {
    const [x] = asientosDeCaja([mov("r", { kind: "EGRESO", reversesMovementId: "no-esta" })], []);
    expect(x).toMatchObject({ kind: "INGRESO", signo: -1 });
  });
});

describe("asientosDevengados", () => {
  const pedido = (over = {}) => ({ status: "CONFIRMADO", eventDate: "2026-02-20", createdAt: new Date("2026-01-05T12:00:00Z"), centavos: 500_00, incomeCategoryId: "ing", ...over });
  const cuenta = (over = {}) => ({ dueDate: "2026-03-10", createdAt: new Date("2026-01-05T12:00:00Z"), centavos: 80_00, costCategoryId: "cos", ...over });

  it("pedidos por fecha del evento (o creación en hora argentina) y sin cancelados", () => {
    const r = asientosDevengados({
      pedidos: [pedido(), pedido({ eventDate: null, createdAt: new Date("2026-03-01T01:00:00Z") }), pedido({ status: "CANCELADO" })],
      cuentas: [],
      movs: [],
    });
    expect(r.map((x) => [x.mes, x.kind])).toEqual([["2026-02", "INGRESO"], ["2026-02", "INGRESO"]]);
  });

  it("cuentas a pagar por vencimiento (o creación), todas, aunque estén pagadas", () => {
    const r = asientosDevengados({ pedidos: [], cuentas: [cuenta(), cuenta({ dueDate: null })], movs: [] });
    expect(r.map((x) => [x.mes, x.kind, x.categoryId])).toEqual([["2026-03", "EGRESO", "cos"], ["2026-01", "EGRESO", "cos"]]);
  });

  it("no duplica: los movimientos de pedidos y de pagos de pedidos (y sus anulaciones) quedan afuera", () => {
    const movs = [
      mov("cobro", { sourceModule: "pedidos" }),
      mov("anula-cobro", { sourceModule: "pedidos", kind: "EGRESO", reversesMovementId: "cobro" }),
      mov("pago", { sourceModule: "pedidos-pagos", kind: "EGRESO" }),
      mov("anula-pago", { sourceModule: "pedidos-pagos", reversesMovementId: "pago" }),
      mov("mostrador", { sourceModule: "sales", centavos: 7_00 }),
      mov("manual", { centavos: 3_00, categoryId: null }),
    ];
    const r = asientosDevengados({ pedidos: [pedido()], cuentas: [], movs });
    expect(r).toHaveLength(3);
    expect(r.filter((x) => x.centavos === 7_00 || x.centavos === 3_00)).toHaveLength(2);
    expect(r.reduce((s, x) => s + x.centavos * x.signo, 0)).toBe(500_00 + 7_00 + 3_00);
  });

  it("la anulación de un movimiento manual sí resta, aunque el original esté fuera del lote", () => {
    const r = asientosDevengados({
      pedidos: [],
      cuentas: [],
      movs: [mov("r", { kind: "EGRESO", reversesMovementId: "fuera", sourceModule: "manual" })],
      originales: [{ id: "fuera", kind: "INGRESO", categoryId: "ing", sourceModule: "manual" }],
    });
    expect(r).toEqual([{ mes: "2026-02", categoryId: "ing", kind: "INGRESO", centavos: 100_00, signo: -1 }]);
  });
});
