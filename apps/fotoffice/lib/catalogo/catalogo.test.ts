import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const P = await import("./perfil");
const C = await import("./combos");
const K = await import("./costos");
const S = await import("./semillas");
const { SLUG_DNX } = await import("@/lib/consultas/constantes");

function producto(id: string, datos: Record<string, unknown> = {}) {
  return B.agregar("product", { id, workspaceId: "ws-1", name: `Producto ${id}`, priceArs: "1000.00", ...datos });
}

function contacto(id: string, ws = "ws-1", categoria: string | null = "PROVEEDOR") {
  B.agregar("client", { id, workspaceId: ws, kind: "EMPRESA", firstName: null, lastName: null, businessName: `Proveedor ${id}` });
  if (categoria) B.agregar("fotofficeContactoPerfil", { workspaceId: ws, clientId: id, category: categoria });
}

beforeEach(() => B.vaciar());

describe("perfil para presupuestos", () => {
  it("sin fila: fuera de la lista, sin rubro, no es combo", async () => {
    producto("p1");
    expect(await P.leerPerfil("ws-1", "p1")).toEqual({ inPriceList: false, incomeLabel: null, incomeCategoryId: null, isCombo: false });
  });

  it("guarda y vuelve a guardar sobre la misma fila (1:1)", async () => {
    producto("p1");
    expect(await P.guardarPerfil("ws-1", "p1", { inPriceList: true, incomeLabel: " Coberturas " })).toEqual({ ok: true });
    expect(await P.guardarPerfil("ws-1", "p1", { inPriceList: false, incomeLabel: "Coberturas" })).toEqual({ ok: true });
    expect(B.datos.fotofficeProductoCatalogo).toHaveLength(1);
    expect(await P.leerPerfil("ws-1", "p1")).toMatchObject({ inPriceList: false, incomeLabel: "Coberturas" });
  });

  it("rubro de Caja: sólo una categoría de INGRESO de este workspace", async () => {
    producto("p1");
    B.agregar("cashCategory", { id: "bodas", workspaceId: "ws-1", name: "Bodas", kind: "INGRESO" });
    B.agregar("cashCategory", { id: "baja", workspaceId: "ws-1", name: "Vieja", kind: "INGRESO", isActive: false });
    B.agregar("cashCategory", { id: "costo", workspaceId: "ws-1", name: "Viajes", kind: "EGRESO" });
    B.agregar("cashCategory", { id: "ajena", workspaceId: "ws-2", name: "Bodas", kind: "INGRESO" });

    expect(await P.guardarPerfil("ws-1", "p1", { inPriceList: false, incomeCategoryId: "costo" })).toEqual(P.RUBRO_INVALIDO);
    expect(await P.guardarPerfil("ws-1", "p1", { inPriceList: false, incomeCategoryId: "ajena" })).toEqual(P.RUBRO_INVALIDO);
    expect(await P.guardarPerfil("ws-1", "p1", { inPriceList: false, incomeCategoryId: 7 })).toEqual(P.RUBRO_INVALIDO);
    expect(B.datos.fotofficeProductoCatalogo).toHaveLength(0);

    expect(await P.guardarPerfil("ws-1", "p1", { inPriceList: true, incomeCategoryId: "bodas" })).toEqual({ ok: true });
    expect(await P.leerPerfil("ws-1", "p1")).toMatchObject({ incomeCategoryId: "bodas" });
    // Un rubro dado de baja que el producto ya tenía se puede volver a guardar.
    expect(await P.guardarPerfil("ws-1", "p1", { inPriceList: true, incomeCategoryId: "baja" })).toEqual({ ok: true });
    expect(await P.guardarPerfil("ws-1", "p1", { inPriceList: true, incomeCategoryId: "" })).toEqual({ ok: true });
    expect(await P.leerPerfil("ws-1", "p1")).toMatchObject({ incomeCategoryId: null });
  });

  it("guardar sin mandar el texto viejo no lo borra (queda como sugerencia)", async () => {
    producto("p1");
    await P.guardarPerfil("ws-1", "p1", { inPriceList: false, incomeLabel: "Bodas" });
    await P.guardarPerfil("ws-1", "p1", { inPriceList: true, incomeCategoryId: null });
    expect(await P.leerPerfil("ws-1", "p1")).toMatchObject({ inPriceList: true, incomeLabel: "Bodas", incomeCategoryId: null });
  });

  it("opciones del selector: activas de ingreso agrupadas por padre, más la actual aunque esté de baja", async () => {
    B.agregar("cashCategory", { id: "estudio", workspaceId: "ws-1", name: "Estudio Fotográfico", kind: "INGRESO", order: 5 });
    B.agregar("cashCategory", { id: "bodas", workspaceId: "ws-1", name: "Bodas", kind: "INGRESO", order: 1 });
    B.agregar("cashCategory", { id: "ventas", workspaceId: "ws-1", name: "Ventas", kind: "INGRESO", order: 0 });
    B.agregar("cashCategory", { id: "baja", workspaceId: "ws-1", name: "Vieja", kind: "INGRESO", isActive: false });
    B.agregar("cashCategory", { id: "otra-baja", workspaceId: "ws-1", name: "Otra", kind: "INGRESO", isActive: false });
    B.agregar("cashCategory", { id: "costo", workspaceId: "ws-1", name: "Viajes", kind: "EGRESO" });
    B.agregar("fotofficeRubro", { workspaceId: "ws-1", categoryId: "estudio", code: "3.1" });
    B.agregar("fotofficeRubro", { workspaceId: "ws-1", categoryId: "bodas", code: "3.1.1", parentCategoryId: "estudio" });

    producto("p1");
    B.agregar("fotofficeProductoCatalogo", { workspaceId: "ws-1", productId: "p1", incomeCategoryId: "baja" });
    const opciones = await P.rubrosDeIngreso("ws-1", "p1");
    expect(opciones.map((o) => [o.id, o.esHijo])).toEqual([
      ["estudio", false],
      ["bodas", true],
      ["ventas", false],
      ["baja", false],
    ]);
  });

  it("un producto de otro workspace no existe", async () => {
    producto("p1", { workspaceId: "ws-2" });
    expect(await P.guardarPerfil("ws-1", "p1", { inPriceList: true, incomeLabel: null })).toEqual(P.NO_EXISTE);
    expect(B.datos.fotofficeProductoCatalogo).toHaveLength(0);
  });
});

describe("combos", () => {
  beforeEach(() => {
    producto("A", { priceArs: "80000.00" });
    producto("B", { priceArs: "50000.00" });
    producto("C", { priceArs: "25000.00" });
  });

  it("guarda componentes, marca el combo y muestra suma y ahorro", async () => {
    expect(await C.guardarComponentes("ws-1", "A", [{ productId: "B", quantity: 1 }, { productId: "C", quantity: 2 }])).toEqual({ ok: true });
    const d = await C.leerCombo("ws-1", "A", 80_000_00);
    expect(d.componentes.map((c) => [c.productId, c.quantity])).toEqual([["B", 1], ["C", 2]]);
    expect(d.resumen).toEqual({ sumaComponentesMinor: 100_000_00, ahorroMinor: 20_000_00, ahorroPorcentaje: 20 });
    expect(await P.leerPerfil("ws-1", "A")).toMatchObject({ isCombo: true });
    // Toma el candado del workspace antes de mirar ciclos.
    expect(B.sql.some((q) => q.texto.includes("pg_advisory_xact_lock") && q.valores[0] === "fotoffice-combos:ws-1")).toBe(true);
  });

  it("vaciar la lista deja de ser combo", async () => {
    await C.guardarComponentes("ws-1", "A", [{ productId: "B", quantity: 1 }]);
    expect(await C.guardarComponentes("ws-1", "A", [])).toEqual({ ok: true });
    expect(B.datos.fotofficeComboItem).toHaveLength(0);
    expect(await P.leerPerfil("ws-1", "A")).toMatchObject({ isCombo: false });
  });

  it("frena el ciclo A contiene B contiene A, y el indirecto", async () => {
    await C.guardarComponentes("ws-1", "B", [{ productId: "A", quantity: 1 }]);
    const r = await C.guardarComponentes("ws-1", "A", [{ productId: "B", quantity: 1 }]);
    expect(r.ok).toBe(false);
    await C.guardarComponentes("ws-1", "B", [{ productId: "C", quantity: 1 }]);
    await C.guardarComponentes("ws-1", "C", [{ productId: "A", quantity: 1 }]);
    expect((await C.guardarComponentes("ws-1", "A", [{ productId: "B", quantity: 1 }])).ok).toBe(false);
    // Lo que había no se tocó.
    expect(B.datos.fotofficeComboItem.filter((x) => x.comboProductId === "A")).toHaveLength(0);
  });

  it("un combo no se contiene a sí mismo", async () => {
    expect((await C.guardarComponentes("ws-1", "A", [{ productId: "A", quantity: 1 }])).ok).toBe(false);
  });

  it("los componentes tienen que ser del mismo workspace", async () => {
    producto("Z", { workspaceId: "ws-2" });
    const r = await C.guardarComponentes("ws-1", "A", [{ productId: "Z", quantity: 1 }]);
    expect(r).toEqual({ ok: false, error: "Uno de los componentes no es un producto de tu catálogo." });
    expect(B.datos.fotofficeComboItem).toHaveLength(0);
  });

  it("no se arma un combo de otro workspace", async () => {
    expect(await C.guardarComponentes("ws-2", "A", [{ productId: "B", quantity: 1 }])).toEqual(P.NO_EXISTE);
  });

  it("para agregar se ofrecen los activos del workspace, menos el combo", async () => {
    producto("I", { isActive: false });
    producto("Z", { workspaceId: "ws-2" });
    expect((await C.productosParaCombo("ws-1", "A")).map((p) => p.id).sort()).toEqual(["B", "C"]);
  });
});

describe("costos-plantilla", () => {
  beforeEach(() => producto("p1"));

  it("guarda con proveedor opcional y los lee con su nombre", async () => {
    contacto("prov1");
    const r = await K.guardarCostos("ws-1", "p1", [
      { supplierClientId: "prov1", concept: "Laboratorio", amountMinor: 12_500_50, perUnit: true, daysFromEvent: 7 },
      { supplierClientId: null, concept: "Viáticos", amountMinor: 3_000_00, perUnit: false, daysFromEvent: -1 },
    ]);
    expect(r).toEqual({ ok: true });
    // Toma el candado del producto antes de borrar y crear.
    expect(B.sql.some((q) => q.texto.includes("pg_advisory_xact_lock") && q.valores[0] === "fotoffice-costos:ws-1:p1")).toBe(true);
    expect(B.datos.fotofficeCostoPlantilla[0]).toMatchObject({ amountArs: "12500.50", order: 0 });
    const costos = await K.leerCostos("ws-1", "p1");
    expect(costos.map((c) => [c.concept, c.supplierName, c.amountMinor, c.perUnit, c.daysFromEvent])).toEqual([
      ["Laboratorio", "Proveedor prov1", 12_500_50, true, 7],
      ["Viáticos", null, 3_000_00, false, -1],
    ]);
  });

  it("el proveedor tiene que ser un contacto del workspace", async () => {
    contacto("ajeno", "ws-2");
    const r = await K.guardarCostos("ws-1", "p1", [{ supplierClientId: "ajeno", concept: "X", amountMinor: 1, perUnit: false, daysFromEvent: 0 }]);
    expect(r).toEqual({ ok: false, error: "Uno de los proveedores no es un contacto tuyo." });
    expect(B.datos.fotofficeCostoPlantilla).toHaveLength(0);
  });

  it("cualquier contacto propio vale, aunque no sea de categoría Proveedor", async () => {
    contacto("cli", "ws-1", "CLIENTE");
    expect((await K.guardarCostos("ws-1", "p1", [{ supplierClientId: "cli", concept: "X", amountMinor: 1, perUnit: false, daysFromEvent: 0 }])).ok).toBe(true);
  });

  it("guardar reemplaza la lista entera", async () => {
    await K.guardarCostos("ws-1", "p1", [{ concept: "A", amountMinor: 1, perUnit: false, daysFromEvent: 0 }]);
    await K.guardarCostos("ws-1", "p1", [{ concept: "B", amountMinor: 2, perUnit: false, daysFromEvent: 0 }]);
    expect(B.datos.fotofficeCostoPlantilla.map((c) => c.concept)).toEqual(["B"]);
  });

  it("producto de otro workspace: no existe", async () => {
    expect(await K.guardarCostos("ws-2", "p1", [])).toEqual(P.NO_EXISTE);
  });

  it("se ofrecen como proveedores sólo los de categoría Proveedor del workspace", async () => {
    contacto("p-b");
    contacto("p-a");
    contacto("cli", "ws-1", "CLIENTE");
    contacto("ajeno", "ws-2");
    expect((await K.proveedoresDelWorkspace("ws-1")).map((p) => p.id)).toEqual(["p-a", "p-b"]);
  });
});

describe("semilla de categorías de DNX", () => {
  it("DNX recibe las 11, en orden, después de las que ya tenía", async () => {
    B.agregar("productCategory", { workspaceId: "ws-1", name: "Insumos", order: 4 });
    expect(await S.asegurarCategoriasProductoDnx("ws-1", SLUG_DNX)).toBe(11);
    const nombres = B.datos.productCategory.map((c) => c.name);
    expect(nombres).toHaveLength(12);
    expect(B.datos.productCategory.find((c) => c.name === "Evento")).toMatchObject({ order: 5 });
  });

  it("sólo crea las que faltan (sin mirar mayúsculas) y una segunda vez no hace nada", async () => {
    B.agregar("productCategory", { workspaceId: "ws-1", name: "evento", isActive: false });
    B.agregar("productCategory", { workspaceId: "ws-1", name: "ÁLBUM" });
    expect(await S.asegurarCategoriasProductoDnx("ws-1", SLUG_DNX)).toBe(9);
    expect(await S.asegurarCategoriasProductoDnx("ws-1", SLUG_DNX)).toBe(0);
    expect(B.datos.productCategory).toHaveLength(11);
  });

  it("otra organización no recibe nada", async () => {
    expect(await S.asegurarCategoriasProductoDnx("ws-1", "otra-org")).toBe(0);
    expect(await S.asegurarCategoriasProductoDnx("ws-1", null)).toBe(0);
    expect(B.datos.productCategory).toHaveLength(0);
  });
});

describe("fuente de la ficha", () => {
  const dir = join(__dirname, "..", "..", "app", "(shell)", "ventas", "catalogo", "[productId]");
  const acciones = readFileSync(join(dir, "presupuesto-actions.ts"), "utf8");
  const secciones = readFileSync(join(dir, "presupuesto-sections.tsx"), "utf8");
  const pagina = readFileSync(join(dir, "page.tsx"), "utf8");

  it("cada acción exige sales.catalog (requireSalesAdmin) y toma el workspace de la sesión", () => {
    const exportadas = acciones.match(/export async function \w+/g) ?? [];
    expect(exportadas).toHaveLength(3);
    expect(acciones.match(/await requireSalesAdmin\(\)/g)).toHaveLength(3);
    expect(acciones).not.toMatch(/workspaceId\s*[:,]\s*(formData|c\.|costos|componentes)/);
  });

  it("la ficha exige sales.catalog antes de leer costos", () => {
    expect(pagina).toContain("await requireSalesAdmin()");
    expect(pagina.indexOf("requireSalesAdmin()")).toBeLessThan(pagina.indexOf("leerCostos("));
  });

  it("combo, costos y datos para presupuestos sólo con el módulo Presupuestos encendido", () => {
    expect(pagina).toContain("isModuleEnabledForWorkspace(workspace.id, QUOTES_MODULE_KEY)");
    expect(pagina).toMatch(/const etapa2 = presupuestosEnabled\s*\?/);
    expect(pagina.indexOf("presupuestosEnabled\n")).toBeLessThan(pagina.indexOf("leerCostos("));
    expect(pagina).toMatch(/\{etapa2 \? \(\s*<PresupuestoSections/);
  });

  it("el componente del navegador no importa la base ni módulos de servidor (salvo tipos)", () => {
    expect(secciones).not.toMatch(/from "@repo\/db"/);
    for (const m of secciones.matchAll(/^import (?!type )[^;]*from "@\/lib\/catalogo\/(\w+)"/gm)) expect(m[1]).toBe("reglas");
  });
});
