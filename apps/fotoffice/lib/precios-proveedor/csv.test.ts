import { describe, expect, it } from "vitest";
import { analizarCsvLista, ENCABEZADO_CSV } from "./csv";

const enc = ENCABEZADO_CSV.join(",");

describe("analizarCsvLista", () => {
  it("lee un renglón y limpia el precio", () => {
    const r = analizarCsvLista(`${enc}\nLa Isla,2026-10,PRODUCTO,Laboratorio,Foto,,30 X 90,,,unidad,$10 .200,,`);
    expect(r.errores).toEqual([]);
    expect(r.vigencia).toBe("2026-10");
    expect(r.renglones).toHaveLength(1);
    expect(r.renglones[0]).toMatchObject({ fila: 1, tipo: "PRODUCTO", medida: "30x90", costoMinor: 1_020_000, unidad: "unidad", modelo: null });
  });

  it("acepta el CSV dentro de un bloque de código y encabezados con mayúsculas y tildes", () => {
    const texto = "Acá está:\n```csv\nProveedor, Vigencia,TIPO,Categoría,Producto,Modelo,Medida,Variante,Cantidad mínima,Unidad,Precio,Código proveedor,Notas\nRomán,2026-10,HOJA,Fotolibros,Hoja,,15x30,,,hoja,4300,,\n```";
    const r = analizarCsvLista(texto);
    expect(r.errores).toEqual([]);
    expect(r.renglones[0]).toMatchObject({ tipo: "HOJA", costoMinor: 430_000, medida: "15x30" });
  });

  it("marca el error con su número de fila", () => {
    const r = analizarCsvLista(`${enc}\nX,2026-10,FOO,C,P,,,,,unidad,100,,\nX,2026-10,PRODUCTO,C,P2,,,,,unidad,consultar,,`);
    expect(r.renglones).toHaveLength(0);
    expect(r.errores.map((e) => e.fila)).toEqual([1, 2]);
  });

  it("un renglón repetido cuenta una vez y gana el último", () => {
    const fila = (p: number) => `X,2026-10,PRODUCTO,Lab,Foto,,10x15,,,unidad,${p},,`;
    const r = analizarCsvLista(`${enc}\n${fila(600)}\n${fila(650)}`);
    expect(r.duplicadas).toBe(1);
    expect(r.renglones).toHaveLength(1);
    expect(r.renglones[0]!.costoMinor).toBe(65_000);
  });

  it("sin encabezado reconocible devuelve un error general", () => {
    expect(analizarCsvLista("a,b\n1,2").errorGeneral).toBeTruthy();
  });
});
