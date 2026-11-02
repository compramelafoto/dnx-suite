import { describe, expect, it } from "vitest";
import { armarCatalogo } from "./catalogo";
import { armarMarcos, bordesCm, colorDeVariante, esProductoMarco, medidaConMarco, medidasDeMarco, type ModeloMarco } from "./marcos";

// Una foto de frente de 1000×1250 px de un marco de 40×50 cm con 5 cm de perfil parejo.
const MODELO: ModeloMarco = {
  id: "m1", productId: "p1", color: "Negro", imagenUrl: "https://x/m.png", imagenAncho: 1000, imagenAlto: 1250,
  ventana: { x: 125, y: 125, w: 750, h: 1000 }, exteriorAnchoCm: 40, exteriorAltoCm: 50,
};

describe("las medidas de un marco", () => {
  it("con dos medidas, la chica es la foto y la grande el exterior", () => {
    expect(medidasDeMarco("Cuadro portarretratos de madera y vidrio 13x18 / 28x35 cm", "Negro")).toEqual({ foto: { corto: 13, largo: 18 }, exterior: { corto: 28, largo: 35 } });
    expect(medidasDeMarco("Marco de plástico metalizado con paspartú y acrílico", "Dorado · 20x30 o 30x40cm")).toEqual({ foto: { corto: 20, largo: 30 }, exterior: { corto: 30, largo: 40 } });
  });

  it("con una sola medida en la variante, es la foto", () => {
    expect(medidasDeMarco("Marco box de madera de 3 cm de profundidad", "Negro · 20x30cm")).toEqual({ foto: { corto: 20, largo: 30 }, exterior: null });
  });

  it("reconoce el color de la variante", () => {
    expect(colorDeVariante("Negro · 20x30cm")).toBe("Negro");
    expect(colorDeVariante("Marrón claro")).toBe("Marrón claro");
  });

  it("sabe qué productos son marcos para fotos", () => {
    expect(esProductoMarco("Marco box de madera de 3 cm de profundidad")).toBe(true);
    expect(esProductoMarco("Cuadro portarretratos de madera y vidrio 15x20 / 30x40 cm")).toBe(true);
    expect(esProductoMarco("Cuadro canvas 30x40")).toBe(false);
  });
});

describe("el marco dibujado a cada medida", () => {
  it("mide el perfil en la foto del modelo", () => {
    expect(bordesCm(MODELO)).toEqual({ izq: 5, der: 5, arr: 5, aba: 5 });
  });

  it("sin exterior conocido, el exterior es la foto más el perfil", () => {
    const r = medidaConMarco(MODELO, { corto: 20, largo: 30 }, null, true);
    expect(r.exterior).toEqual({ w: 30, h: 40 });
    expect(r.foto).toEqual({ x: 5, y: 5, w: 20, h: 30 });
  });

  it("con exterior, lo que sobra entre la ventana y la foto es paspartú, centrado", () => {
    const r = medidaConMarco(MODELO, { corto: 20, largo: 30 }, { corto: 40, largo: 50 }, true);
    expect(r.ventana).toEqual({ x: 5, y: 5, w: 30, h: 40 });
    expect(r.foto).toEqual({ x: 10, y: 10, w: 20, h: 30 });
  });

  it("acostado, gira los bordes del modelo", () => {
    const asimetrico = { ...MODELO, ventana: { x: 125, y: 250, w: 750, h: 875 } }; // arriba 10 cm
    const r = medidaConMarco(asimetrico, { corto: 20, largo: 30 }, null, false);
    expect(r.giro).toBe(90);
    expect(r.ventana.x).toBeCloseTo(5, 9); // abajo (5) pasa a la izquierda
    expect(r.ventana.y).toBeCloseTo(5, 9); // izquierda (5) pasa arriba
  });
});

describe("el precio de un cuadro con marco", () => {
  const catalogo = armarCatalogo([{ id: "a", name: "Ampliación 20x30", priceArs: 4500, supplierName: null }]);
  const producto = { id: "p1", name: "Marco box de madera", priceArs: 0, costArs: null, variantes: [
    { id: "v1", name: "Negro · 20x30cm", priceArs: 25000 },
    { id: "v2", name: "Negro · 30x40cm", priceArs: 32000 },
    { id: "v3", name: "Blanco · 20x30cm", priceArs: 25000 },
  ] };

  it("suma el marco y la ampliación de la foto, y avisa lo que falta", () => {
    const [m] = armarMarcos([producto], [MODELO], catalogo);
    expect(m.medidas).toHaveLength(2);
    expect(m.medidas[0].precioArs).toBe(29500);
    expect(m.medidas[1].precioArs).toBeNull();
    expect(m.medidas[1].motivo).toBe("Falta la ampliación 30x40 en Ventas");
  });

  it("un marco sin precio no se puede pedir", () => {
    const [m] = armarMarcos([{ ...producto, variantes: [{ id: "v1", name: "Negro · 20x30cm", priceArs: 0 }] }], [MODELO], catalogo);
    expect(m.medidas[0].motivo).toBe("El marco todavía no tiene precio");
  });
});
