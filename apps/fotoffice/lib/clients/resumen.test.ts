import { describe, expect, it } from "vitest";
import { cuadrosDelResumen } from "./resumen";

const pesos = (n: number) => `$${n}`;
const NADA = { consultas: null, cotizaciones: null, pedidos: null, contratos: null, proyectos: null };

describe("resumen de la ficha del cliente", () => {
  it("sin permisos no hay cuadros", () => {
    expect(cuadrosDelResumen(NADA, pesos)).toEqual([]);
  });

  it("cuenta, resume estados y suma el dinero sin los cancelados", () => {
    const c = cuadrosDelResumen(
      {
        consultas: { cantidad: 5, hayMas: true },
        cotizaciones: [{ estado: "ACEPTADO" }, { estado: "ENVIADO" }],
        pedidos: [
          { estado: "EN_CURSO", total: 1000, aCobrar: 400, vencido: 100 },
          { estado: "CANCELADO", total: 9999, aCobrar: 9999, vencido: 9999 },
        ],
        contratos: [{ estado: "FIRMADO" }],
        proyectos: [{ estado: "CERRADO" }],
      },
      pesos,
    );
    expect(c.map((x) => [x.entidad, x.valor, x.detalle])).toEqual([
      ["consulta", "5+", null],
      ["cotizacion", "2", "1 aceptada"],
      ["pedido", "2", "1 en curso"],
      ["contrato", "1", "1 firmado"],
      ["proyecto", "1", null],
      ["cobrado", "$600", "de $1000 vendido"],
      ["porCobrar", "$400", "$100 vencido"],
    ]);
  });

  it("saldo en cero: no dice «al día»", () => {
    const c = cuadrosDelResumen({ ...NADA, pedidos: [{ estado: "COMPLETADO", total: 500, aCobrar: 0, vencido: 0 }] }, pesos);
    expect(c.find((x) => x.entidad === "porCobrar")).toMatchObject({ valor: "$0", detalle: null });
  });
});
