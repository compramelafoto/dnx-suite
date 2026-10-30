import { describe, expect, it } from "vitest";
import {
  calcularEmbalaje,
  piezasDeLineas,
  sugerirEntrega,
  type EmbalajeCalculado,
  type EntregaProducto,
  type Envoltorio,
  type PiezaEntrega,
} from "./embalaje";

const DNX: Envoltorio[] = [
  { insumoId: "sobre", nombre: "Sobre 19x24", tipo: "SOBRE", admiteAnchoCm: 15, admiteAltoCm: 21, piezasPorUnidad: 100, orden: 0 },
  { insumoId: "bolsa2030", nombre: "Bolsa 20x30", tipo: "BOLSA", admiteAnchoCm: 20, admiteAltoCm: 30, piezasPorUnidad: null, orden: 1 },
  { insumoId: "bolsa3045", nombre: "Bolsa 30x45", tipo: "BOLSA", admiteAnchoCm: 30, admiteAltoCm: 45, piezasPorUnidad: null, orden: 2 },
  { insumoId: "bolsa3545", nombre: "Bolsa 35x45", tipo: "BOLSA", admiteAnchoCm: 35, admiteAltoCm: 45, piezasPorUnidad: null, orden: 3 },
];

const base = { embalajeSiguiente: false, embalajeFijoId: null };
const suelta = (a: number | null, b: number | null, qty: number): PiezaEntrega => ({ ...base, forma: "PIEZA_SUELTA", anchoCm: a, altoCm: b, qty });
const marco = (a: number, b: number, qty: number): PiezaEntrega => ({ forma: "ENMARCADO", anchoCm: a, altoCm: b, embalajeSiguiente: true, embalajeFijoId: null, qty });
const fotolibro = (qty: number): PiezaEntrega => ({ forma: "VOLUMEN", anchoCm: 30, altoCm: 30, embalajeSiguiente: false, embalajeFijoId: "bolsa3545", qty });

function ids(r: EmbalajeCalculado[]): Record<string, number> {
  return Object.fromEntries(r.map((e) => [e.insumoId, e.qty]));
}

describe("calcularEmbalaje — tabla §12 del diseño", () => {
  it("30 fotos 10x15 → 1 sobre", () => expect(ids(calcularEmbalaje([suelta(10, 15, 30)], DNX))).toEqual({ sobre: 1 }));
  it("99 fotos 10x15 → 1 sobre", () => expect(ids(calcularEmbalaje([suelta(10, 15, 99)], DNX))).toEqual({ sobre: 1 }));
  it("100 fotos 10x15 → 2 sobres", () => {
    expect(calcularEmbalaje([suelta(10, 15, 100)], DNX)).toEqual([{ insumoId: "sobre", qty: 2, motivo: expect.any(String) }]);
  });
  it("200 fotos 10x15 → 3 sobres", () => expect(ids(calcularEmbalaje([suelta(10, 15, 200)], DNX))).toEqual({ sobre: 3 }));
  it("10 fotos 10x15 + 5 fotos 15x21 → 1 sobre", () =>
    expect(ids(calcularEmbalaje([suelta(10, 15, 10), suelta(15, 21, 5)], DNX))).toEqual({ sobre: 1 }));
  it("1 foto 20x30 → bolsa 20x30", () => expect(ids(calcularEmbalaje([suelta(20, 30, 1)], DNX))).toEqual({ bolsa2030: 1 }));
  it("20x30 + 30x45 → una bolsa 30x45", () =>
    expect(ids(calcularEmbalaje([suelta(20, 30, 1), suelta(30, 45, 1)], DNX))).toEqual({ bolsa3045: 1 }));
  it("20 fotos 10x15 + 1 foto 30x45 → sobre y bolsa 30x45", () =>
    expect(ids(calcularEmbalaje([suelta(10, 15, 20), suelta(30, 45, 1)], DNX))).toEqual({ sobre: 1, bolsa3045: 1 }));
  it("portarretratos 20x25 con su foto → bolsa 30x45, sin sobre", () =>
    expect(ids(calcularEmbalaje([marco(20, 25, 1), suelta(20, 25, 1)], DNX))).toEqual({ bolsa3045: 1 }));
  it("portarretratos 13x18 con foto + 10 fotos 10x15 → sobre y bolsa 20x30", () =>
    expect(ids(calcularEmbalaje([marco(13, 18, 1), suelta(13, 18, 1), suelta(10, 15, 10)], DNX))).toEqual({ sobre: 1, bolsa2030: 1 }));
  it("3 portarretratos 13x18 con sus fotos → una bolsa 20x30", () =>
    expect(ids(calcularEmbalaje([marco(13, 18, 3), suelta(13, 18, 3)], DNX))).toEqual({ bolsa2030: 1 }));
  it("portarretratos 35x45 → la bolsa más grande", () => expect(ids(calcularEmbalaje([marco(35, 45, 1)], DNX))).toEqual({ bolsa3545: 1 }));
  it("portarretratos sin foto → su bolsa", () => expect(ids(calcularEmbalaje([marco(13, 18, 1)], DNX))).toEqual({ bolsa2030: 1 }));
  it("pendrive (sin medida) → 1 sobre", () => expect(ids(calcularEmbalaje([suelta(null, null, 1)], DNX))).toEqual({ sobre: 1 }));
  it("fotolibro + 10 fotos 10x15 → sobre y bolsa 35x45", () =>
    expect(ids(calcularEmbalaje([fotolibro(1), suelta(10, 15, 10)], DNX))).toEqual({ sobre: 1, bolsa3545: 1 }));
  it("solo un servicio (sin piezas) → nada", () => expect(calcularEmbalaje([], DNX)).toEqual([]));
});

describe("calcularEmbalaje — bordes", () => {
  it("la orientación no importa: 21x15 entra en el sobre", () => expect(ids(calcularEmbalaje([suelta(21, 15, 1)], DNX))).toEqual({ sobre: 1 }));
  it("sin envoltorios configurados → nada", () => expect(calcularEmbalaje([suelta(10, 15, 5)], [])).toEqual([]));
  it("solo bolsas: una 10x15 va en la bolsa 20x30", () =>
    expect(ids(calcularEmbalaje([suelta(10, 15, 1)], DNX.filter((e) => e.tipo === "BOLSA")))).toEqual({ bolsa2030: 1 }));
  it("50x70 → la bolsa más grande", () => expect(ids(calcularEmbalaje([suelta(50, 70, 1)], DNX))).toEqual({ bolsa3545: 1 }));
  it("un envoltorio fijo que no está entre los activos se ignora", () => {
    const pieza: PiezaEntrega = { ...fotolibro(1), embalajeFijoId: "inexistente" };
    expect(ids(calcularEmbalaje([pieza], DNX))).toEqual({ bolsa3045: 1 });
  });
  it("con 0 unidades no se cuenta la pieza", () => expect(calcularEmbalaje([suelta(10, 15, 0)], DNX)).toEqual([]));
  it("el sobre va primero en la salida", () => {
    const r = calcularEmbalaje([suelta(30, 45, 1), suelta(10, 15, 1)], DNX);
    expect(r.map((e) => e.insumoId)).toEqual(["sobre", "bolsa3045"]);
  });
  it("una foto más chica que el marco va adentro si no hay de la misma medida", () =>
    expect(ids(calcularEmbalaje([marco(20, 25, 1), suelta(13, 18, 1)], DNX))).toEqual({ bolsa3045: 1 }));
});

describe("piezasDeLineas", () => {
  const entregas = new Map<string, EntregaProducto>([
    ["copia13x18", { forma: "PIEZA_SUELTA", anchoCm: 13, altoCm: 18, embalajeSiguiente: false, embalajeFijoId: null }],
    ["marco13x18", { forma: "ENMARCADO", anchoCm: 13, altoCm: 18, embalajeSiguiente: true, embalajeFijoId: null }],
    ["sesion", { forma: "SIN_EMBALAJE", anchoCm: null, altoCm: null, embalajeSiguiente: false, embalajeFijoId: null }],
  ]);
  const combos = [
    { comboProductId: "marcoConFoto", componentProductId: "marco13x18", quantity: 1 },
    { comboProductId: "marcoConFoto", componentProductId: "copia13x18", quantity: 1 },
  ];

  it("un combo «portarretratos con foto» se desarma: bolsa 20x30 y ningún sobre", () => {
    const piezas = piezasDeLineas([{ productId: "marcoConFoto", qty: 2 }], entregas, combos);
    expect(piezas.map((p) => [p.forma, p.qty])).toEqual([
      ["ENMARCADO", 2],
      ["PIEZA_SUELTA", 2],
    ]);
    expect(ids(calcularEmbalaje(piezas, DNX))).toEqual({ bolsa2030: 1 });
  });
  it("sin embalaje, sin entrega o renglón suelto no aportan", () => {
    expect(piezasDeLineas([{ productId: "sesion", qty: 1 }, { productId: "otro", qty: 3 }, { productId: null, qty: 1 }], entregas, [])).toEqual([]);
  });
  it("un combo con entrega propia no se desarma", () => {
    const conPropia = new Map(entregas).set("marcoConFoto", { forma: "VOLUMEN", anchoCm: 20, altoCm: 30, embalajeSiguiente: false, embalajeFijoId: null });
    expect(piezasDeLineas([{ productId: "marcoConFoto", qty: 1 }], conPropia, combos).map((p) => p.forma)).toEqual(["VOLUMEN"]);
  });
});

describe("sugerirEntrega", () => {
  it("portarretratos con medida en el nombre", () =>
    expect(sugerirEntrega({ nombre: "Portarretratos 20x25 madera", categoria: null, kind: "PRODUCTO", hojaMm: null })).toEqual({
      forma: "ENMARCADO",
      anchoCm: 20,
      altoCm: 25,
      embalajeSiguiente: true,
      embalajeFijoId: null,
    }));
  it("impresión con tamaño de hoja", () =>
    expect(sugerirEntrega({ nombre: "Copia", categoria: null, kind: "PRODUCTO", hojaMm: { ancho: 102, alto: 152 } })).toEqual({
      forma: "PIEZA_SUELTA",
      anchoCm: 10,
      altoCm: 15,
      embalajeSiguiente: false,
      embalajeFijoId: null,
    }));
  it("fotolibro → volumen", () => expect(sugerirEntrega({ nombre: "Fotolibro 20x20", categoria: null, kind: "PRODUCTO", hojaMm: null })?.forma).toBe("VOLUMEN"));
  it("pendrive → pieza suelta sin medida", () =>
    expect(sugerirEntrega({ nombre: "Pendrive 32 GB", categoria: null, kind: "PRODUCTO", hojaMm: null })).toMatchObject({ forma: "PIEZA_SUELTA", anchoCm: null }));
  it("servicio → sin embalaje", () => expect(sugerirEntrega({ nombre: "Sesión de fotos", categoria: null, kind: "SERVICIO", hojaMm: null })?.forma).toBe("SIN_EMBALAJE"));
  it("algo desconocido → null", () => expect(sugerirEntrega({ nombre: "Llavero", categoria: null, kind: "PRODUCTO", hojaMm: null })).toBeNull());
  it("la categoría también cuenta", () =>
    expect(sugerirEntrega({ nombre: "Modelo Roma 13x18", categoria: "Portarretratos", kind: "PRODUCTO", hojaMm: null })?.forma).toBe("ENMARCADO"));
});
