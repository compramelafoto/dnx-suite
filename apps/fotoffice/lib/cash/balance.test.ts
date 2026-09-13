import { describe, expect, it } from "vitest";
import { accountBalanceMinor, periodSummary, topClients, totalsByCategory } from "./balance";

const movs = [
  { kind: "INGRESO" as const, amountMinor: 1_000_00, categoryId: "c1", categoryName: "Ventas" },
  { kind: "INGRESO" as const, amountMinor: 500_00, categoryId: "c1", categoryName: "Ventas" },
  { kind: "EGRESO" as const, amountMinor: 300_00, categoryId: "c2", categoryName: "Proveedores" },
  { kind: "INGRESO" as const, amountMinor: 200_00, categoryId: null, categoryName: null },
];

describe("accountBalanceMinor", () => {
  it("sin movimientos el saldo es cero", () => {
    expect(accountBalanceMinor([])).toBe(0);
  });

  it("los ingresos suman y los egresos restan", () => {
    expect(accountBalanceMinor(movs)).toBe(1_400_00);
  });

  it("una anulación deja el neto en cero sin excluir nada", () => {
    const conAnulacion = [
      { kind: "INGRESO" as const, amountMinor: 1_000_00 },
      { kind: "EGRESO" as const, amountMinor: 1_000_00 },
    ];
    expect(accountBalanceMinor(conAnulacion)).toBe(0);
  });
});

describe("las transferencias no son ingresos ni egresos", () => {
  const conPase = [
    { kind: "INGRESO" as const, amountMinor: 50_000_00, categoryId: "c1", categoryName: "Ventas" },
    // El pase diario a la caja fuerte: sale de esta cuenta, pero no es un gasto.
    { kind: "EGRESO" as const, amountMinor: 30_000_00, categoryId: null, categoryName: null, isTransfer: true },
  ];

  it("el saldo de la cuenta SÍ descuenta el pase: la plata ya no está ahí", () => {
    expect(accountBalanceMinor(conPase)).toBe(20_000_00);
  });

  it("el resumen del período NO cuenta el pase como egreso", () => {
    expect(periodSummary(conPase)).toEqual({
      incomeMinor: 50_000_00,
      expenseMinor: 0,
      netMinor: 50_000_00,
    });
  });

  it("los totales por categoría tampoco lo cuentan", () => {
    const r = totalsByCategory(conPase);
    expect(r).toHaveLength(1);
    expect(r[0].categoryName).toBe("Ventas");
  });

  it("treinta pases en el mes no inflan los egresos ni un peso", () => {
    const mes = [
      { kind: "INGRESO" as const, amountMinor: 100_000_00, categoryId: "c1", categoryName: "Ventas" },
      ...Array.from({ length: 30 }, () => ({
        kind: "EGRESO" as const,
        amountMinor: 3_000_00,
        categoryId: null,
        categoryName: null,
        isTransfer: true,
      })),
    ];
    expect(periodSummary(mes).expenseMinor).toBe(0);
  });
});

describe("periodSummary", () => {
  it("separa entradas, salidas y neto", () => {
    expect(periodSummary(movs)).toEqual({
      incomeMinor: 1_700_00,
      expenseMinor: 300_00,
      netMinor: 1_400_00,
    });
  });

  it("un período sin movimientos da todo en cero y no null", () => {
    expect(periodSummary([])).toEqual({ incomeMinor: 0, expenseMinor: 0, netMinor: 0 });
  });
});

describe("totalsByCategory", () => {
  it("agrupa por categoría y cuenta los movimientos", () => {
    const r = totalsByCategory(movs);
    const ventas = r.find((t) => t.categoryId === "c1");
    expect(ventas).toEqual({
      categoryId: "c1",
      categoryName: "Ventas",
      kind: "INGRESO",
      totalMinor: 1_500_00,
      count: 2,
    });
  });

  it("los movimientos sin categoría se agrupan bajo un nombre legible", () => {
    const r = totalsByCategory(movs);
    const sin = r.find((t) => t.categoryId === null);
    expect(sin?.categoryName).toBe("Sin categoría");
    expect(sin?.totalMinor).toBe(200_00);
  });

  it("ordena de mayor a menor: lo que más pesa va primero", () => {
    const r = totalsByCategory(movs);
    expect(r[0].totalMinor).toBeGreaterThanOrEqual(r[1].totalMinor);
  });

  it("una misma categoría usada de los dos lados no se mezcla", () => {
    const r = totalsByCategory([
      { kind: "INGRESO", amountMinor: 100_00, categoryId: "c9", categoryName: "Reparaciones" },
      { kind: "EGRESO", amountMinor: 40_00, categoryId: "c9", categoryName: "Reparaciones" },
    ]);
    expect(r).toHaveLength(2);
    expect(r.map((t) => t.kind).sort()).toEqual(["EGRESO", "INGRESO"]);
  });
});

describe("topClients", () => {
  it("suma sólo los ingresos por cliente y ordena de mayor a menor", () => {
    const r = topClients(
      [
        { kind: "INGRESO", amountMinor: 500_00, clientId: "a", clientName: "Ana" },
        { kind: "INGRESO", amountMinor: 900_00, clientId: "b", clientName: "Beto" },
        { kind: "INGRESO", amountMinor: 200_00, clientId: "a", clientName: "Ana" },
        { kind: "EGRESO", amountMinor: 100_00, clientId: "a", clientName: "Ana" },
      ],
      10,
    );
    expect(r.map((c) => c.clientId)).toEqual(["b", "a"]);
    expect(r[1].totalMinor).toBe(700_00);
  });

  it("los movimientos sin cliente no entran", () => {
    const r = topClients(
      [{ kind: "INGRESO", amountMinor: 500_00, clientId: null, clientName: null }],
      10,
    );
    expect(r).toEqual([]);
  });

  it("respeta el tope pedido", () => {
    const muchos = Array.from({ length: 30 }, (_, i) => ({
      kind: "INGRESO" as const,
      amountMinor: (i + 1) * 100,
      clientId: `c${i}`,
      clientName: `Cliente ${i}`,
    }));
    expect(topClients(muchos, 5)).toHaveLength(5);
  });
});
