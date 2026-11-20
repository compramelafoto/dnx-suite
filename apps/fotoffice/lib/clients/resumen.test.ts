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
    expect(c.map((x) => [x.entidad, x.valor, x.detalle, x.panel, x.vacio])).toEqual([
      ["consulta", "5+", null, "consultas", false],
      ["cotizacion", "2", "1 aceptada", "cotizaciones", false],
      ["pedido", "2", "1 en curso", "pedidos", false],
      ["contrato", "1", "1 firmado", "contratos", false],
      ["proyecto", "1", null, "proyectos", false],
      ["cobrado", "$600", "de $1000 vendido", "pedidos", false],
      ["porCobrar", "$400", "$100 vencido", "pedidos", false],
    ]);
  });

  it("saldo en cero: no dice «al día»", () => {
    const c = cuadrosDelResumen({ ...NADA, pedidos: [{ estado: "COMPLETADO", total: 500, aCobrar: 0, vencido: 0 }] }, pesos);
    expect(c.find((x) => x.entidad === "porCobrar")).toMatchObject({ valor: "$0", detalle: null, vacio: true });
    expect(c.find((x) => x.entidad === "cobrado")).toMatchObject({ valor: "$500", vacio: false });
  });

  it("sin nada, todos los cuadros quedan en tono suave", () => {
    const c = cuadrosDelResumen({ consultas: { cantidad: 0, hayMas: false }, cotizaciones: [], pedidos: [], contratos: [], proyectos: [] }, pesos);
    expect(c.every((x) => x.vacio)).toBe(true);
  });
});
