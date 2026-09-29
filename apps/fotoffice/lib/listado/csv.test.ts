import { describe, expect, it } from "vitest";
import { armarCsvExcel, nombreArchivoExport } from "./csv";
import type { ColumnaExport } from "./tipos";

type F = { n: string; m: number; f: Date | null };
const cols: ColumnaExport<F>[] = [
  { titulo: "Nombre", tipo: "texto", valor: (x) => x.n },
  { titulo: "Importe", tipo: "importe", valor: (x) => x.m },
  { titulo: "Fecha", tipo: "fechaHora", valor: (x) => x.f },
];

describe("armarCsvExcel", () => {
  it("BOM, punto y coma, coma decimal y fecha argentina", () => {
    const csv = armarCsvExcel(cols, [{ n: "Pérez; Ana", m: 123456, f: new Date("2026-09-30T02:30:00Z") }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿Nombre;Importe;Fecha\r\n"Pérez; Ana";1234,56;29/09/2026 23:30\r\n');
  });
  it("neutraliza fórmulas y deja vacío lo nulo", () => {
    const csv = armarCsvExcel(cols, [{ n: "=HYPERLINK(1)", m: -500, f: null }]);
    expect(csv.split("\r\n")[1]).toBe("'=HYPERLINK(1);-5,00;");
  });
});

it("nombreArchivoExport usa la fecha de Buenos Aires", () => {
  expect(nombreArchivoExport("DNX Estudio", "clientes", new Date("2026-10-01T01:00:00Z"))).toBe("dnx-estudio-clientes-2026-09-30.csv");
});
