import { describe, expect, it } from "vitest";
import { armarEscenarios } from "./escenarios";

const beneficiarios = [
  { id: "sfpr", nombre: "SFPR", bps: 3000, absorbeMp: false },
  { id: "doc", nombre: "Docente", bps: 7000, absorbeMp: true },
];

describe("los tres escenarios del simulador", () => {
  const e = armarEscenarios({ listaCentavos: 10_000_000, comisionPlataformaBps: 500, beneficiarios, vendedorId: "sfpr", reventaBps: 2500, tasaMpBps: 761 });

  it("son venta directa, revendido y socio con descuento máximo", () => {
    expect(e.map((x) => x.clave)).toEqual(["directa", "reventa", "socio"]);
  });

  it("la comisión estimada de MP se resta sólo a quien la absorbe", () => {
    const directa = e[0];
    if (!directa.ok) throw new Error();
    const doc = directa.filas.find((f) => f.id === "doc")!;
    expect(doc.bruto).toBe(7_000_000);
    expect(doc.mp).toBe(799_050); // 7,61% de $105.000
    expect(doc.neto).toBe(7_000_000 - 799_050);
    expect(directa.filas.find((f) => f.id === "sfpr")!.mp).toBe(0);
  });

  it("el socio paga la lista menos la parte del que vende, más el 5%", () => {
    const socio = e[2];
    expect(socio.ok && socio.pagaElAlumno).toBe(7_500_000);
  });

  it("un error del motor se muestra en cada escenario", () => {
    const malos = armarEscenarios({ listaCentavos: 0, comisionPlataformaBps: 500, beneficiarios, vendedorId: "sfpr", reventaBps: 2500 });
    expect(malos.every((x) => !x.ok)).toBe(true);
  });
});
