import { describe, expect, it } from "vitest";
import type { ItemPresupuesto } from "./constantes";
import { ajustadosIniciales, armarDatosEditor, buscarEnCatalogo, costosEnVivo, itemDesdeProducto, itemLibre, itemsParaGuardar, type ProductoParaEditor } from "./editor";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { calcularItemDelPanel, trabajoVacio } from "./panel-cuanto-cobro";
import { calcularTotales } from "./totales";

const PERFIL = createBaseCompleteProfile();
const calculado = (() => {
  const r = calcularItemDelPanel(PERFIL, { ...trabajoVacio("Boda"), horasCobertura: "8", horasEdicion: "10" }, "Boda", { id: "c1", nombre: "Boda" }, new Date("2026-10-07T15:00:00Z"));
  if (!r.ok) throw new Error(r.error);
  return r.item;
})();

const PRODUCTOS: ProductoParaEditor[] = [
  { id: "p1", nombre: "Álbum 30x30", descripcion: null, precio: 150000, enLista: false, esCombo: false, sumaComponentes: null, ahorro: null },
  { id: "p2", nombre: "Combo Boda", descripcion: "Cobertura + álbum", precio: 900000, enLista: true, esCombo: true, sumaComponentes: 1000000, ahorro: 100000 },
  { id: "p3", nombre: "Impresiones", descripcion: null, precio: 2000, enLista: false, esCombo: false, sumaComponentes: null, ahorro: null },
];

function borrador(items: ItemPresupuesto[]) {
  return { id: "v1", number: 1, items, totals: { descuento: { tipo: "PORCENTAJE" as const, valor: 10 } }, terms: "Seña 30 %", paymentProposal: null };
}

describe("datos del editor (R4: costos sólo con configurar)", () => {
  const items = [calculado, itemDesdeProducto(PRODUCTOS[0]!, "l1")];
  const costosCatalogo = { p1: { plantillas: [], costoProducto: 90000 } };

  it("sin permiso: sin `internos`, ítems sin cálculo y ni un costo en el JSON", () => {
    const d = armarDatosEditor({ presupuestoId: "pre", borrador: borrador(items), catalogo: PRODUCTOS, veCostos: false, costosCatalogo, perfil: PERFIL });
    expect("internos" in d).toBe(false);
    expect(d.items.every((i) => i.calculo === null)).toBe(true);
    expect(d.items[0]).toMatchObject({ modoPrecio: "CALCULO", precioUnitario: calculado.precioUnitario });
    const json = JSON.stringify(d);
    for (const prohibido of ["costoBase", "margen", "costoProducto", "plantillas", "gastosPersonales", "perfil", "entrada", "valorHora"]) {
      expect(json).not.toContain(prohibido);
    }
  });

  it("con permiso: `internos` con los costos del catálogo y el perfil, y los ítems con su cálculo", () => {
    const d = armarDatosEditor({ presupuestoId: "pre", borrador: borrador(items), catalogo: PRODUCTOS, veCostos: true, costosCatalogo, perfil: PERFIL });
    expect(d.internos).toEqual({ costosCatalogo, perfil: PERFIL });
    expect(d.items[0]!.calculo?.costoBase).toBeGreaterThan(0);
    expect(d).toMatchObject({ descuento: { tipo: "PORCENTAJE", valor: 10 }, condiciones: "Seña 30 %", versionNumero: 1 });
  });

  it("costo y margen en vivo con la misma cuenta que el servidor", () => {
    const totales = calcularTotales(items, null);
    const c = costosEnVivo(items, totales, { costosCatalogo, perfil: null });
    expect(c.porItem.l1).toEqual({ costo: 90000, origen: "COSTO_PRODUCTO", margen: 60000 });
    expect(c.porItem.c1!.origen).toBe("CALCULO");
    expect(c.itemsSinCosto).toBe(0);
  });
});

describe("ítems del editor", () => {
  it("del catálogo: precio de lista, cantidad 1 y la sección elegida", () => {
    expect(itemDesdeProducto(PRODUCTOS[1]!, "k", "Boda")).toMatchObject({ id: "k", productId: "p2", nombre: "Combo Boda", precioUnitario: 900000, modoPrecio: "LISTA", seccion: "Boda", cantidad: 1 });
    expect(itemLibre("x")).toMatchObject({ productId: null, nombre: "", modoPrecio: "LISTA", calculo: null });
  });

  it("al guardar viaja sólo la entrada del motor, y sólo con permiso", () => {
    const [conPermiso] = itemsParaGuardar([calculado], true) as { calculo: Record<string, unknown> }[];
    expect(Object.keys(conPermiso!.calculo)).toEqual(["entrada", "precioAjustado"]);
    expect(conPermiso!.calculo.precioAjustado).toBe(false);
    const [tocado] = itemsParaGuardar([calculado], true, new Set(["c1"])) as { calculo: Record<string, unknown> }[];
    expect(tocado!.calculo.precioAjustado).toBe(true);
    expect([...ajustadosIniciales([calculado, { ...calculado, id: "c2", calculo: { ...calculado.calculo!, precioElegido: 1 } }])]).toEqual(["c2"]);
    const [sinPermiso] = itemsParaGuardar([calculado], false) as { calculo: unknown }[];
    expect(sinPermiso!.calculo).toBeNull();
    const [lista] = itemsParaGuardar([{ ...calculado, modoPrecio: "LISTA" }], true) as { calculo: unknown }[];
    expect(lista!.calculo).toBeNull();
  });

  it("el buscador ignora tildes y mayúsculas y pone primero lo que está en lista", () => {
    // "Combo Boda" lo encuentra por su descripción ("Cobertura + álbum").
    expect(buscarEnCatalogo(PRODUCTOS, "album").map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(buscarEnCatalogo(PRODUCTOS, "ÁLBUM 30").map((p) => p.id)).toEqual(["p1"]);
    expect(buscarEnCatalogo(PRODUCTOS, "").map((p) => p.id)).toEqual(["p2", "p1", "p3"]);
  });
});

describe("control de concurrencia del editor", () => {
  const items = [
    { id: "a", productId: "p1", nombre: "Álbum", descripcion: null, cantidad: 1, precioUnitario: 1000, descuento: null, modoPrecio: "LISTA" as const, calculo: null, seccion: null, opcional: false },
  ];
  const borrador = { id: "v1", number: 1, items, totals: { descuento: null }, terms: "Seña", paymentProposal: null };
  it("con la versión, el editor recibe fecha y firma; la firma es la misma con o sin costos", async () => {
    const { armarDatosEditor, firmaDelBorrador } = await import("./editor");
    const version = new Date("2026-10-12T15:00:00.123Z");
    const conCostos = armarDatosEditor({ presupuestoId: "p", borrador, catalogo: [], veCostos: true, version });
    const sinCostos = armarDatosEditor({ presupuestoId: "p", borrador, catalogo: [], veCostos: false, version });
    expect(conCostos.control).toEqual({ version: version.toISOString(), firma: firmaDelBorrador(items, "Seña", null, null) });
    expect(sinCostos.control).toEqual(conCostos.control);
    expect(armarDatosEditor({ presupuestoId: "p", borrador, catalogo: [], veCostos: true }).control).toBeUndefined();
  });
  it("la firma cambia si cambia un ítem o las condiciones", async () => {
    const { firmaDelBorrador } = await import("./editor");
    const base = firmaDelBorrador(items, "Seña", null, null);
    expect(firmaDelBorrador([...items, { ...items[0]!, id: "b" }], "Seña", null, null)).not.toBe(base);
    expect(firmaDelBorrador(items, "Otra", null, null)).not.toBe(base);
    expect(firmaDelBorrador(items, "Seña", null, null)).toBe(base);
  });
});
