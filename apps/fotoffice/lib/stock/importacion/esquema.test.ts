import { describe, expect, it } from "vitest";
import {
  SCHEMA_FACTURA,
  cuadre,
  normalizarNumero,
  validarDocumento,
  type DocumentoImportado,
} from "./esquema";

const fila = (o: Partial<DocumentoImportado["filas"][number]> = {}) => ({
  codigo_barras: null,
  codigo_proveedor: null,
  descripcion: "Papel 10x15",
  cantidad: 2,
  unidad: null,
  unidades_por_paquete: null,
  costo_unitario: 1000,
  alicuota_iva: 21,
  subtotal: null,
  ...o,
});
const doc = (o: Partial<DocumentoImportado> = {}): DocumentoImportado => ({
  proveedor: "Foto SA",
  cuit: null,
  fecha: "2026-10-01",
  comprobante: "0001-00001234",
  precios_con_iva: true,
  total: null,
  filas: [fila()],
  ...o,
});

describe("normalizarNumero", () => {
  it.each([
    ["1.234,50", 1234.5],
    ["1234.50", 1234.5],
    ["$ 1.234,50", 1234.5],
    ["$ 2.000", 2000],
    ["21 %", 21],
    ["10,5", 10.5],
    ["1.5", 1.5],
    ["1.234.567", 1234567],
    ["1,234.50", 1234.5],
    ["-3", -3],
    ["0.500", 0.5],
    ["7", 7],
    ["1.234", 1234],
    ["1,234", 1.234],
  ])("%s ⇒ %s", (t, n) => expect(normalizarNumero(t)).toBe(n));
  it.each(["", "  ", "abc", "1,2,x", "$", "1.2.3", "1,5,5", "1234.567.890"])("%j ⇒ null", (t) =>
    expect(normalizarNumero(t)).toBeNull(),
  );
});

describe("validarDocumento", () => {
  it("acepta un documento completo", () => {
    expect(validarDocumento(doc()).ok).toBe(true);
  });
  it("rechaza si falta un campo o hay tipo incorrecto", () => {
    expect(validarDocumento({ ...doc(), filas: undefined }).ok).toBe(false);
    expect(validarDocumento(doc({ filas: [fila({ cantidad: "2" as unknown as number })] })).ok).toBe(false);
    expect(validarDocumento(null).ok).toBe(false);
  });
  it("rechaza unidades_por_paquete no entero", () => {
    expect(validarDocumento(doc({ filas: [fila({ unidades_por_paquete: 2.5 })] })).ok).toBe(false);
  });
});

describe("cuadre", () => {
  it("sin total, cuadra", () => {
    expect(cuadre(doc()).cuadra).toBe(true);
    expect(cuadre(doc()).sumaPesos).toBe(2000);
  });
  it("usa subtotal si está, si no cantidad×costo", () => {
    const d = doc({ filas: [fila({ subtotal: 500 }), fila()], total: 2500 });
    expect(cuadre(d)).toEqual({ cuadra: true, sumaPesos: 2500 });
  });
  it("tolera 1 % o 100 pesos", () => {
    expect(cuadre(doc({ total: 2090 })).cuadra).toBe(true);
    expect(cuadre(doc({ total: 2200 })).cuadra).toBe(false);
    expect(cuadre(doc({ total: 1_000_000, filas: [fila({ cantidad: 1, costo_unitario: 990_500 })] })).cuadra).toBe(true);
    expect(cuadre(doc({ total: 1_000_000, filas: [fila({ cantidad: 1, costo_unitario: 980_000 })] })).cuadra).toBe(false);
  });
});

describe("SCHEMA_FACTURA", () => {
  type Obj = { type?: unknown; additionalProperties?: unknown; properties?: Record<string, Obj>; required?: string[]; items?: Obj };
  const objetos = (s: Obj): Obj[] => {
    const out: Obj[] = [];
    if (s.type === "object") out.push(s);
    for (const p of Object.values(s.properties ?? {})) out.push(...objetos(p));
    if (s.items) out.push(...objetos(s.items));
    return out;
  };
  it("los nulos se expresan con anyOf, no con arreglos de type", () => {
    const texto = JSON.stringify(SCHEMA_FACTURA);
    expect(texto).not.toMatch(/"type":\[/);
    expect(texto).toContain('"anyOf":[{"type":"string"},{"type":"null"}]');
    expect(texto).toContain('"anyOf":[{"type":"integer"},{"type":"null"}]');
  });
  it("cada objeto cierra propiedades y exige todas", () => {
    const todos = objetos(SCHEMA_FACTURA as unknown as Obj);
    expect(todos.length).toBe(2);
    for (const o of todos) {
      expect(o.additionalProperties).toBe(false);
      expect([...(o.required ?? [])].sort()).toEqual(Object.keys(o.properties ?? {}).sort());
    }
  });
});
