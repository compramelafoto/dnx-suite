import { describe, expect, it } from "vitest";
import { CONFLICTOS, DUDAS, MOTIVOS, huellasDe } from "../campos";
import { COMBO, COSTO, ITEM_COMBO, PRODUCTO, crudo, mapaDe } from "../ejemplos-alboom";
import {
  TIPO_PRODUCTO,
  actualDeProducto,
  registrarCosto,
  traducirCosto,
  traducirItemCombo,
  nombresDeProductos,
  previosDe,
  registrarProducto,
  registrarItemCombo,
  traducirProducto,
  type CtxCombos,
  type CtxCostos,
  type CtxProductos,
  type ProductoExistente,
} from "./productos";

const existente = (over: Partial<ProductoExistente> = {}): ProductoExistente => ({
  id: "p1",
  name: "Cobertura Fotográfica de Evento",
  sku: null,
  description: null,
  priceArs: "120000.00",
  costArs: null,
  isActive: true,
  categoria: "Evento",
  inPriceList: false,
  isCombo: false,
  ...over,
});
const ctx = (productos: ProductoExistente[] = []): CtxProductos => ({ productos, mapa: new Map() });

describe("productos", () => {
  it("crea con precio, costo, categoría, lista de precios y combo; los de evento/sesión son servicios", () => {
    expect(traducirProducto(crudo("productos", "55", PRODUCTO), ctx())).toMatchObject({
      accion: "CREAR",
      datos: { name: PRODUCTO.name, sku: "EV-01", priceArs: "150000.00", costArs: "20000.00", categoria: "Evento", inPriceList: true, isCombo: false, isActive: true, kind: "SERVICIO" },
    });
    expect(traducirProducto(crudo("productos", "60", { ...COMBO, category_name: "Fotolibros" }), ctx())).toMatchObject({ datos: { isCombo: true, kind: "PRODUCTO" } });
  });

  it("empareja por nombre (nunca sólo por código) y sólo completa lo vacío; el precio distinto es conflicto", () => {
    const d = traducirProducto(crudo("productos", "55", PRODUCTO), ctx([existente()]));
    expect(d).toMatchObject({ accion: "ACTUALIZAR", targetId: "p1", vincula: true, datos: { sku: "EV-01", description: "Hasta 6 horas de cobertura", costArs: "20000.00" } });
    expect(d.conservados).toEqual(expect.arrayContaining(["priceArs", "inPriceList"]));
    // Por código solo, nunca: otro nombre → se crea (y el código, ocupado, queda vacío con duda).
    expect(traducirProducto(crudo("productos", "55", PRODUCTO), ctx([existente({ name: "Otro nombre", sku: "EV-01" })]))).toMatchObject({ accion: "CREAR", datos: { sku: null } });
  });

  it("código usado por otro producto → se carga sin código (duda); sin precio → 0 (duda); sin nombre → OMITIR", () => {
    expect(traducirProducto(crudo("productos", "55", PRODUCTO), ctx([existente({ id: "p9", name: "X", sku: "EV-01" }), existente({ id: "p1" })]))).toMatchObject({
      targetId: "p1",
      dudas: [DUDAS.codigoRepetido],
    });
    expect(traducirProducto(crudo("productos", "56", { ...PRODUCTO, name: "Nuevo", code: "", price: "" }), ctx())).toMatchObject({ accion: "CREAR", datos: { priceArs: "0.00", sku: null }, dudas: [DUDAS.precioFaltante] });
    expect(traducirProducto(crudo("productos", "57", { ...PRODUCTO, name: " " }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinNombre });
  });

  it("ya cargado: actualiza lo que cambió en Alboom salvo lo editado en FOTOFFICE", () => {
    const antes = crudo("productos", "55", PRODUCTO);
    const cargado = existente({ name: PRODUCTO.name, sku: "EV-01", description: "Editada en FOTOFFICE", priceArs: "150000.00", costArs: "20000.00", inPriceList: true });
    const c = ctx([cargado]);
    const nuevos = { sku: "EV-01", description: PRODUCTO.description, priceArs: "150000.00", costArs: "20000.00", isActive: true, categoria: "Evento", inPriceList: true, isCombo: false };
    c.mapa.set("55", mapaDe(antes, TIPO_PRODUCTO, "p1", huellasDe(nuevos)));
    const d = traducirProducto(crudo("productos", "55", { ...PRODUCTO, price: "175000", description: "Nueva en Alboom" }), c);
    expect(d).toMatchObject({ accion: "ACTUALIZAR", datos: { priceArs: "175000.00" }, conservados: ["description"] });
    expect(actualDeProducto(cargado).priceArs).toBe("150000.00");
  });
});

describe("combos", () => {
  const combos = (over: Partial<CtxCombos> = {}): CtxCombos => ({ productoDe: new Map([["55", "p1"], ["60", "p2"]]), items: [], mapa: new Map(), ...over });
  it("crea el ítem con su cantidad; descuento propio es duda", () => {
    expect(traducirItemCombo(crudo("combos", "60/h1", ITEM_COMBO), combos())).toMatchObject({ accion: "CREAR", datos: { comboProductId: "p2", componentProductId: "p1", quantity: 2, order: 0 } });
    expect(traducirItemCombo(crudo("combos", "60/h2", { ...ITEM_COMBO, discount: "10" }), combos()).dudas).toEqual([DUDAS.descuentoEnCombo]);
  });
  it("ítem que ya existe con otra cantidad → conflicto; productos sin cargar → OMITIR", () => {
    expect(traducirItemCombo(crudo("combos", "60/h1", ITEM_COMBO), combos({ items: [{ id: "i1", comboProductId: "p2", componentProductId: "p1", quantity: 1 }] }))).toMatchObject({ accion: "IGUAL", conservados: ["quantity"] });
    expect(traducirItemCombo(crudo("combos", "61/h1", { ...ITEM_COMBO, pack_id: "61" }), combos())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.productoSinCargar });
    expect(traducirItemCombo(crudo("combos", "60/h3", { ...ITEM_COMBO, product_id: "99" }), combos())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.componenteSinCargar });
    expect(traducirItemCombo(crudo("combos", "60/h4", { ...ITEM_COMBO, product_id: "60" }), combos())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.componenteEsCombo });
  });
});

describe("costos de producto", () => {
  const costos = (over: Partial<CtxCostos> = {}): CtxCostos => ({ productoDe: new Map([["55", "p1"]]), contactoDe: new Map([["7001", "cli1"]]), costos: [], mapa: new Map(), ...over });
  it("crea el costo fijo con proveedor (si se cargó) y días desde el evento", () => {
    expect(traducirCosto(crudo("costos_producto", "55/9", COSTO), costos())).toMatchObject({
      accion: "CREAR",
      datos: { productId: "p1", concept: "Segundo fotógrafo", amountArs: "20000.00", daysFromEvent: 0, supplierClientId: "cli1" },
    });
  });
  it("proveedor sin cargar o sin importe → dudas; producto sin cargar → OMITIR", () => {
    const d = traducirCosto(crudo("costos_producto", "55/10", { ...COSTO, id: "10", vendor_id: "8000", cost: "" }), costos());
    expect(d).toMatchObject({ accion: "CREAR", datos: { supplierClientId: null, amountArs: "0.00" } });
    expect(d.dudas).toEqual(expect.arrayContaining([DUDAS.proveedorSinCargar, DUDAS.costoSinImporte]));
    expect(traducirCosto(crudo("costos_producto", "56/9", COSTO), costos())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.productoSinCargar });
  });
  it("un costo existente del mismo producto y concepto se vincula sin pisarlo", () => {
    const d = traducirCosto(crudo("costos_producto", "55/9", COSTO), costos({ costos: [{ id: "k1", productId: "p1", concept: "segundo fotografo", amountArs: "25000.00", daysFromEvent: 0, supplierClientId: null }] }));
    expect(d).toMatchObject({ targetId: "k1", vincula: true, conservados: ["concept", "amountArs"] });
  });
});

describe("nunca se fusionan productos distintos", () => {
  const conNombres = (crudos: ReturnType<typeof crudo>[], productos: ProductoExistente[] = []): CtxProductos => ({
    productos,
    mapa: new Map(),
    previos: previosDe(productos.map((p) => p.id), []),
    nombresAlboom: nombresDeProductos(crudos),
  });

  it("mismo nombre: el inactivo se saltea si hay uno activo; dos activos se crean por separado con conflicto", () => {
    const viejo = crudo("productos", "50", { ...PRODUCTO, id: "50", code: "AL-1", name: "Álbum 30x30", price: "90000", active: "0" });
    const nuevo = crudo("productos", "51", { ...PRODUCTO, id: "51", code: "AL-2", name: "Album 30x30", price: "120000", active: "1" });
    const ctx = conNombres([viejo, nuevo]);
    expect(traducirProducto(viejo, ctx)).toEqual({ accion: "OMITIR", motivo: MOTIVOS.productoInactivoRepetido });
    expect(traducirProducto(nuevo, ctx)).toMatchObject({ accion: "CREAR", datos: { priceArs: "120000.00", isActive: true } });

    const otro = crudo("productos", "52", { ...PRODUCTO, id: "52", code: "AL-3", name: "Álbum 30x30", active: "1" });
    const dos = conNombres([nuevo, otro]);
    const d1 = traducirProducto(nuevo, dos);
    registrarProducto(dos, d1, "prod-51");
    expect(d1).toMatchObject({ accion: "CREAR", conflictos: [CONFLICTOS.nombreRepetido] });
    expect(traducirProducto(otro, dos)).toMatchObject({ accion: "CREAR", conflictos: [CONFLICTOS.nombreRepetido] });
  });

  it("todos inactivos con el mismo nombre: queda sólo el de id menor", () => {
    const a = crudo("productos", "50", { ...PRODUCTO, id: "50", active: "0" });
    const b = crudo("productos", "51", { ...PRODUCTO, id: "51", code: "X", active: "0" });
    const ctx = conNombres([a, b]);
    expect(traducirProducto(a, ctx).accion).toBe("CREAR");
    expect(traducirProducto(b, ctx).accion).toBe("OMITIR");
  });

  it("lo creado en la misma corrida no se usa para emparejar; con un previo, sólo si es el único candidato", () => {
    const a = crudo("productos", "55", PRODUCTO);
    const ctx = conNombres([a]);
    registrarProducto(ctx, traducirProducto(a, ctx), "prod-55");
    // Otro id de Alboom con el mismo nombre que lo recién creado (y nombre no repetido en Alboom por un error de datos):
    expect(traducirProducto(crudo("productos", "99", { ...PRODUCTO, id: "99", code: "Z" }), { ...ctx, nombresAlboom: new Map() }).accion).toBe("CREAR");
    const dosPrevios = conNombres([a], [existente({ id: "p1" }), existente({ id: "p2" })]);
    expect(traducirProducto(a, dosPrevios)).toMatchObject({ accion: "CREAR", conflictos: [CONFLICTOS.variosEnFotoffice] });
    const unPrevio = conNombres([a], [existente({ id: "p1" })]);
    expect(traducirProducto(a, unPrevio)).toMatchObject({ targetId: "p1", vincula: true });
  });

  it("un precio que faltó se actualiza cuando Alboom lo tiene (la huella es la del 0 escrito)", () => {
    const sinPrecio = crudo("productos", "56", { ...PRODUCTO, id: "56", name: "Nuevo", code: "", price: "" });
    const d = traducirProducto(sinPrecio, ctx());
    const c = ctx([existente({ id: "p6", name: "Nuevo", priceArs: "0.00", description: PRODUCTO.description, costArs: "20000.00", inPriceList: true })]);
    c.mapa.set("56", mapaDe(sinPrecio, TIPO_PRODUCTO, "p6", d.huellas));
    expect(traducirProducto(crudo("productos", "56", { ...PRODUCTO, id: "56", name: "Nuevo", code: "", price: "5000" }), c)).toMatchObject({ accion: "ACTUALIZAR", datos: { priceArs: "5000.00" } });
  });

  it("combos: el mismo par repetido no se fusiona; costos: mismo concepto en la misma corrida se crea dos veces", () => {
    const cb: CtxCombos = { productoDe: new Map([["55", "p1"], ["60", "p2"]]), items: [], mapa: new Map(), previos: new Set() };
    const d = traducirItemCombo(crudo("combos", "60/h1", ITEM_COMBO), cb);
    registrarItemCombo(cb, d, "item-1");
    expect(traducirItemCombo(crudo("combos", "60/h2", ITEM_COMBO), cb)).toEqual({ accion: "OMITIR", motivo: MOTIVOS.itemRepetido });
    const cs: CtxCostos = { productoDe: new Map([["55", "p1"]]), contactoDe: new Map(), costos: [], mapa: new Map(), previos: new Set() };
    const c1 = traducirCosto(crudo("costos_producto", "55/9", COSTO), cs);
    registrarCosto(cs, c1, "k1");
    expect(traducirCosto(crudo("costos_producto", "55/10", { ...COSTO, id: "10" }), cs).accion).toBe("CREAR");
  });
});
