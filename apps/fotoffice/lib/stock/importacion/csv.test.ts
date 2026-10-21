import { describe, expect, it } from "vitest";
import { ENCABEZADO_CSV } from "./constantes";
import { PLANTILLA_CSV, PROMPT_EXTERNO, escribirCsv, leerCsv } from "./csv";
import type { FilaImportada } from "./esquema";

const H = ENCABEZADO_CSV;
const ok = (t: string) => {
  const r = leerCsv(t);
  if (!r.ok) throw new Error(r.error);
  return r.filas;
};

describe("leerCsv", () => {
  it("lee la plantilla", () => {
    const f = ok(PLANTILLA_CSV);
    expect(f).toEqual([
      {
        codigo_barras: "7790000000001",
        codigo_proveedor: "K305",
        descripcion: "Kit Kodak 305 6R",
        cantidad: 2,
        unidad: "kit",
        unidades_por_paquete: 640,
        costo_unitario: 120000,
        alicuota_iva: 21,
        subtotal: null,
        tipo: "INSUMO",
      },
    ]);
  });
  it("detecta la coma como separador por el encabezado", () => {
    const f = ok(`${H.replace(/;/g, ",")}\n,,Papel,3,,,"1.234,50",21,\n`);
    expect(f[0].cantidad).toBe(3);
    expect(f[0].costo_unitario).toBe(1234.5);
    expect(f[0].tipo).toBeNull();
  });
  it("tolera BOM, CRLF y encabezado con mayúsculas/espacios", () => {
    const f = ok(`﻿ ${H.toUpperCase()}\r\n;;Papel;1;;;;;\r\n`);
    expect(f).toHaveLength(1);
  });
  it("decimales con coma o punto y números argentinos con $ y %", () => {
    const f = ok(`${H}\n;;A;2,5;;;$ 1.234,50;21 %;\n;;B;3;;;1234.5;10.5;\n`);
    expect(f[0].cantidad).toBe(2.5);
    expect(f[0].costo_unitario).toBe(1234.5);
    expect(f[0].alicuota_iva).toBe(21);
    expect(f[1].costo_unitario).toBe(1234.5);
    expect(f[1].alicuota_iva).toBe(10.5);
  });
  it("comillas con separador y comillas escapadas adentro", () => {
    const f = ok(`${H}\n;;"Papel; brillante ""A4"""; 1;;;;;\n`);
    expect(f[0].descripcion).toBe('Papel; brillante "A4"');
  });
  it("ignora filas vacías", () => {
    const f = ok(`${H}\n\n;;A;1;;;;;\n;;;;;;;;\n   \n;;B;2;;;;;\n`);
    expect(f.map((x) => x.descripcion)).toEqual(["A", "B"]);
  });
  it("encabezado incorrecto o archivo vacío", () => {
    const e = "El archivo no tiene el encabezado de la plantilla.";
    expect(leerCsv("a;b;c\n1;2;3")).toEqual({ ok: false, error: e });
    expect(leerCsv("")).toEqual({ ok: false, error: e });
  });
  it("más de 500 filas", () => {
    const filas = Array.from({ length: 501 }, () => ";;A;1;;;;;").join("\n");
    expect(leerCsv(`${H}\n${filas}`)).toEqual({ ok: false, error: "El archivo tiene más de 500 filas." });
    expect(leerCsv(`${H}\n${filas.split("\n").slice(1).join("\n")}`).ok).toBe(true);
  });
  it("cantidad que no se entiende indica la fila", () => {
    expect(leerCsv(`${H}\n;;A;1;;;;;\n;;B;muchas;;;;;\n`)).toEqual({
      ok: false,
      error: "La fila 3 tiene una cantidad que no se entiende.",
    });
    expect(leerCsv(`${H}\n;;A;;;;;;\n`)).toEqual({
      ok: false,
      error: "La fila 2 tiene una cantidad que no se entiende.",
    });
  });
});

describe("endurecimiento de leerCsv", () => {
  it("saca cercos de código Markdown", () => {
    expect(ok("```csv\n" + H + "\n;;A;1;;;;;\n```\n")).toHaveLength(1);
    expect(ok("```\n" + H + "\n;;A;1;;;;;\n```")).toHaveLength(1);
  });
  it("tolera celdas vacías de más en el encabezado", () => {
    expect(ok(`${H};;\n;;A;1;;;;;;\n`)).toHaveLength(1);
  });
  it("comillas sin cerrar", () => {
    expect(leerCsv(`${H}\n;;"A;1;;;;;\n`)).toEqual({ ok: false, error: "El archivo tiene comillas sin cerrar." });
  });
  it("más columnas que la plantilla", () => {
    expect(leerCsv(`${H}\n;;A;1;;;;;;sobra\n`)).toEqual({
      ok: false,
      error: "La fila 2 tiene más columnas que la plantilla.",
    });
  });
  it("tipo sólo INSUMO o PRODUCTO", () => {
    const f = ok(`${H}\n;;A;1;;;;;insumo\n;;B;1;;;;;Producto\n;;C;1;;;;;otra\n`);
    expect(f.map((x) => x.tipo)).toEqual(["INSUMO", "PRODUCTO", null]);
  });
});

describe("topes numéricos en el CSV", () => {
  it("valores enormes no llegan a la base: cantidad 0 (inválida), bultos y costo nulos", () => {
    const f = ok(`${H}\n;;Papel;99999999999;;5000000000;123456789012345;;\n;;Tinta;3;;10;-50;;\n`);
    expect(f.map((x) => [x.cantidad, x.unidades_por_paquete, x.costo_unitario])).toEqual([
      [0, null, null],
      [3, 10, null],
    ]);
  });
});

describe("escribirCsv", () => {
  it("neutraliza fórmulas", () => {
    const t = escribirCsv([
      { codigo_barras: "=1+1", codigo_proveedor: "@x", descripcion: "-cmd", cantidad: 1, unidad: "+a", unidades_por_paquete: null, costo_unitario: null, alicuota_iva: null, subtotal: null, tipo: null },
    ]);
    expect(t.split("\n")[1]).toBe("'=1+1;'@x;'-cmd;1;'+a;;;;");
  });
  it("ida y vuelta con fórmulas neutralizadas: leer saca el apóstrofo", () => {
    const fila: FilaImportada = { codigo_barras: "=1+1", codigo_proveedor: "@x", descripcion: "-cmd", cantidad: 1, unidad: "+a", unidades_por_paquete: null, costo_unitario: null, alicuota_iva: null, subtotal: null, tipo: null };
    expect(ok(escribirCsv([fila]))).toEqual([fila]);
  });
  it("un apóstrofo que no precede a = + - @ queda", () => {
    expect(ok(`${H}\n;;'Kodak;1;;;;;\n`)[0].descripcion).toBe("'Kodak");
  });
  const filas: FilaImportada[] = [
    {
      codigo_barras: "779",
      codigo_proveedor: null,
      descripcion: 'Papel; "brillante"',
      cantidad: 2,
      unidad: "caja",
      unidades_por_paquete: 100,
      costo_unitario: 1234.5,
      alicuota_iva: 10.5,
      subtotal: null,
      tipo: "INSUMO",
    },
    {
      codigo_barras: null,
      codigo_proveedor: "X1",
      descripcion: "Marco",
      cantidad: 1,
      unidad: null,
      unidades_por_paquete: null,
      costo_unitario: null,
      alicuota_iva: null,
      subtotal: null,
      tipo: null,
    },
  ];
  it("empieza con el encabezado exacto y usa coma decimal", () => {
    const t = escribirCsv(filas);
    expect(t.startsWith(`${H}\n`)).toBe(true);
    expect(t).toContain("1234,5");
  });
  it("ida y vuelta", () => {
    expect(ok(escribirCsv(filas))).toEqual(filas);
  });
});

describe("plantilla y prompt", () => {
  it("la plantilla es encabezado + ejemplo", () => {
    expect(PLANTILLA_CSV.split("\n")[0]).toBe(H);
    expect(PLANTILLA_CSV).toContain("7790000000001;K305;Kit Kodak 305 6R;2;kit;640;120000;21;INSUMO");
  });
  it("el prompt incluye el encabezado y pide sólo CSV con ;", () => {
    expect(PROMPT_EXTERNO).toContain(H);
    expect(PROMPT_EXTERNO).toMatch(/SOLAMENTE un CSV/);
    expect(PROMPT_EXTERNO).toMatch(/punto y coma/);
    expect(PROMPT_EXTERNO).toMatch(/coma/);
  });
});
