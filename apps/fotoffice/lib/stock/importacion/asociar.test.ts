import { describe, expect, it } from "vitest";
import { asociarFilas, normalizarTexto, type IndiceAsociacion } from "./asociar";
import type { FilaImportada } from "./esquema";

const fila = (o: Partial<FilaImportada>): FilaImportada => ({
  codigo_barras: null,
  codigo_proveedor: null,
  descripcion: "x",
  cantidad: 1,
  unidad: null,
  unidades_por_paquete: null,
  costo_unitario: null,
  alicuota_iva: null,
  subtotal: null,
  ...o,
});

const indice = (o: Partial<IndiceAsociacion> = {}): IndiceAsociacion => ({
  porBarcode: new Map(),
  porSku: new Map(),
  porAlias: new Map(),
  catalogo: [],
  ...o,
});

describe("normalizarTexto", () => {
  it("minúsculas, sin tildes ni puntuación, espacios colapsados", () => {
    expect(normalizarTexto("  PAPEL Fotográfico, 10x15 (Brillo)!  ")).toBe("papel fotografico 10x15 brillo");
  });
  it("vacío", () => expect(normalizarTexto(" .,- ")).toBe(""));
});

describe("asociarFilas", () => {
  it("prioriza barcode sobre sku y alias", () => {
    const r = asociarFilas(
      [fila({ codigo_barras: "779 123-4", codigo_proveedor: "S1", descripcion: "Tinta" })],
      indice({
        porBarcode: new Map([["7791234", "pb"]]),
        porSku: new Map([["s1", "ps"]]),
        porAlias: new Map([["tinta", "pa"]]),
      }),
    );
    expect(r[0]).toMatchObject({ productId: "pb", via: "barcode", sugerencias: [] });
  });
  it("sku si no hay barcode", () => {
    const r = asociarFilas([fila({ codigo_proveedor: " S1 " })], indice({ porSku: new Map([["s1", "ps"]]) }));
    expect(r[0]).toMatchObject({ productId: "ps", via: "sku" });
  });
  it("alias: mismo proveedor y misma descripción la segunda vez", () => {
    const r = asociarFilas(
      [fila({ descripcion: "Papel Fotográfico 10x15" })],
      indice({ porAlias: new Map([["papel fotografico 10x15", "pa"]]) }),
    );
    expect(r[0]).toMatchObject({ productId: "pa", via: "alias" });
  });
  it("sugiere hasta 3 por palabras compartidas, ordenadas, sólo sin coincidencia", () => {
    const catalogo = [
      { id: "1", nombre: "Papel brillo 10x15" },
      { id: "2", nombre: "Papel mate" },
      { id: "3", nombre: "Tinta negra" },
      { id: "4", nombre: "Papel brillo 13x18 premium" },
      { id: "5", nombre: "Papel brillo" },
    ];
    const r = asociarFilas([fila({ descripcion: "PAPEL BRILLO premium" })], indice({ catalogo }));
    expect(r[0].productId).toBeNull();
    expect(r[0].via).toBeNull();
    expect(r[0].sugerencias.map((s) => s.id)).toEqual(["4", "5", "1"]);
  });
  it("sin palabras en común no sugiere", () => {
    const r = asociarFilas([fila({ descripcion: "zzz" })], indice({ catalogo: [{ id: "1", nombre: "Papel" }] }));
    expect(r[0].sugerencias).toEqual([]);
  });
});
