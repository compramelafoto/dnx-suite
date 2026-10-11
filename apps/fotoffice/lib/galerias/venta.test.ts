import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null, DbNull: null } }));

const V = await import("./venta");
const F = await import("./venta-form");
const { MENSAJES_GALERIA: M } = await import("./acceso");
const { MENSAJES_PRECIOS } = await import("./precios");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (gallery: Nivel, workspaceId = "ws-1") => ({ workspaceId, userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { gallery } } as never });
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const OTRO_WS = ctx("MANAGE", "ws-2");

const base = (parcial: Partial<import("./venta-form").FormularioVenta> = {}): import("./venta-form").FormularioVenta => ({
  saleMode: "SELECCION_Y_VENTA", includedCount: "20", pricingMode: "POR_FOTO", unitPrice: "1.500,00", packageSize: "", packagePrice: "",
  discountMode: "NINGUNO", discountPct: "", reglas: [], incomeCategoryId: "", ...parcial,
});
const galeria = () => B.datos.fotofficeGaleria.find((g) => g.id === "g1")!;

beforeEach(() => {
  B.vaciar();
  B.agregar("fotofficeGaleria", { id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Boda", status: "PUBLICADA" });
  B.agregar("fotofficeGaleria", { id: "g-ajena", workspaceId: "ws-2", proyectoId: "pr9", number: "G-1", name: "Ajena", status: "PUBLICADA" });
  B.agregar("cashCategory", { id: "rubro-fotos", workspaceId: "ws-1", name: "Fotos extra", kind: "INGRESO" });
  B.agregar("cashCategory", { id: "rubro-viejo", workspaceId: "ws-1", name: "Viejo", kind: "INGRESO", isActive: false });
  B.agregar("cashCategory", { id: "rubro-egreso", workspaceId: "ws-1", name: "Gasto", kind: "EGRESO" });
  B.agregar("cashCategory", { id: "rubro-ajeno", workspaceId: "ws-2", name: "Ajeno", kind: "INGRESO" });
});

describe("formulario de venta (puro)", () => {
  it("entiende los importes como se escriben: 1.500,00 · 1500 · 1500.50", () => {
    for (const [texto, centavos] of [["1.500,00", 150_000], ["1500", 150_000], ["1500.50", 150_050], ["$ 1.500,00", null]] as const) {
      const r = F.aConfigVenta(base({ unitPrice: texto }));
      if (centavos === null) expect(r.ok).toBe(false);
      else expect(r.ok && r.config.unitPriceCents).toBe(centavos);
    }
  });
  it("un importe mal escrito dice cómo escribirlo", () => {
    const r = F.aConfigVenta(base({ unitPrice: "mil quinientos" }));
    expect(r).toEqual({ ok: false, errores: [F.MENSAJES_VENTA_FORM.importeInvalido] });
    expect(F.MENSAJES_VENTA_FORM.importeInvalido).toContain("1.500,00");
  });
  it("pasa los importes a centavos y vuelve a mostrarlos en formato argentino", () => {
    expect(F.centavosAFormulario(150_050)).toBe("1.500,50");
    expect(F.centavosAFormulario(null)).toBe("");
    expect(F.EJEMPLO_IMPORTE).toBe("Ej.: 1.500,00");
  });
  it("con 'Sólo selección' no se mira nada de precios; con 'Sólo venta' las incluidas valen 0", () => {
    expect(F.aConfigVenta(base({ saleMode: "SELECCION", unitPrice: "basura", discountMode: "UNICO" }))).toMatchObject({ ok: true, config: { saleMode: "SELECCION", pricingMode: null, discountMode: "NINGUNO", includedCount: 0 } });
    expect(F.aConfigVenta(base({ saleMode: "VENTA", includedCount: "20" }))).toMatchObject({ ok: true, config: { includedCount: 0 } });
  });
  it("valida con las reglas del servidor (precio faltante, paquete, porcentaje fuera de rango, reglas repetidas)", () => {
    expect(F.aConfigVenta(base({ pricingMode: "" }))).toEqual({ ok: false, errores: [MENSAJES_PRECIOS.modoPrecioInvalido] });
    expect(F.aConfigVenta(base({ unitPrice: "" }))).toEqual({ ok: false, errores: [MENSAJES_PRECIOS.precioFotoInvalido] });
    expect(F.aConfigVenta(base({ pricingMode: "PAQUETE", packageSize: "1", packagePrice: "5000" }))).toEqual({ ok: false, errores: [MENSAJES_PRECIOS.tamanoPaqueteInvalido] });
    expect(F.aConfigVenta(base({ discountMode: "UNICO", discountPct: "95" }))).toEqual({ ok: false, errores: [MENSAJES_PRECIOS.descuentoPctInvalido] });
    expect(F.aConfigVenta(base({ discountMode: "PROGRESIVO", reglas: [{ pct: "10", desde: "5" }, { pct: "20", desde: "5" }] }))).toEqual({ ok: false, errores: [MENSAJES_PRECIOS.reglasRepetidas] });
    expect(F.aConfigVenta(base({ discountMode: "PROGRESIVO", reglas: [] }))).toEqual({ ok: false, errores: [MENSAJES_PRECIOS.reglasVacias] });
    expect(F.aConfigVenta(base({ includedCount: "-3" }))).toEqual({ ok: false, errores: [MENSAJES_PRECIOS.incluidasInvalido] });
    expect(F.aConfigVenta(base({ saleMode: "OTRO" }))).toEqual({ ok: false, errores: [MENSAJES_PRECIOS.modoVentaInvalido] });
  });
  it("las reglas progresivas se ordenan solas y las filas vacías se ignoran", () => {
    const r = F.aConfigVenta(base({ discountMode: "PROGRESIVO", reglas: [{ pct: "20", desde: "10" }, { pct: "", desde: "" }, { pct: "10", desde: "5" }] }));
    expect(r.ok && r.config.discountRules).toEqual([{ pct: 10, desde: 5 }, { pct: 20, desde: 10 }]);
  });
  it("leerFormularioVenta rechaza lo que no es un formulario", () => {
    for (const malo of [null, [], "x", { ...base(), saleMode: { $ne: 1 } }, { ...base(), reglas: "x" }, { ...base(), reglas: [{ pct: {}, desde: "1" }] }, { ...base(), unitPrice: "9".repeat(60) }]) {
      expect(F.leerFormularioVenta(malo)).toBeNull();
    }
    expect(F.leerFormularioVenta({ ...base(), includedCount: 20 })?.includedCount).toBe("20");
  });
  it("la vista previa muestra 1, 5 y 20 extras con la misma cuenta que el servidor", () => {
    const r = F.aConfigVenta(base({ includedCount: "3", discountMode: "PROGRESIVO", reglas: [{ pct: "10", desde: "5" }, { pct: "20", desde: "20" }] }));
    if (!r.ok) throw new Error("config");
    const e = F.ejemplosDeCarrito(r.config);
    expect(e.map((x) => [x.extras, x.subtotalCents, x.descuentoCents, x.totalCents])).toEqual([
      [1, 150_000, 0, 150_000],
      [5, 750_000, 75_000, 675_000],
      [20, 3_000_000, 600_000, 2_400_000],
    ]);
    expect(e.map((x) => x.descuento)).toEqual([null, "10 % desde 5 fotos", "20 % desde 20 fotos"]);
  });
  it("por paquete, la vista previa avisa cuántas fotos más entran", () => {
    const r = F.aConfigVenta(base({ includedCount: "0", pricingMode: "PAQUETE", packageSize: "10", packagePrice: "12.000" }));
    if (!r.ok) throw new Error("config");
    const e = F.ejemplosDeCarrito(r.config);
    expect(e.map((x) => [x.carrito.paquetes, x.carrito.fotosQueFaltanParaPaquete, x.totalCents])).toEqual([[1, 9, 1_200_000], [1, 5, 1_200_000], [2, 0, 2_400_000]]);
  });
  it("sin venta o con una configuración incompleta no hay ejemplos", () => {
    expect(F.ejemplosDeCarrito({ saleMode: "SELECCION", includedCount: 0, pricingMode: null, unitPriceCents: null, packageSize: null, packagePriceCents: null, discountMode: "NINGUNO", discountPct: null, discountRules: null })).toEqual([]);
  });
});

describe("guardarVentaGaleria", () => {
  it("guarda la configuración normalizada en centavos y deja constancia", async () => {
    const r = await V.guardarVentaGaleria(GESTIONA, "g1", base({ discountMode: "PROGRESIVO", reglas: [{ pct: "10", desde: "5" }], incomeCategoryId: "rubro-fotos" }));
    expect(r).toEqual({ ok: true });
    expect(galeria()).toMatchObject({
      saleMode: "SELECCION_Y_VENTA", includedCount: 20, pricingMode: "POR_FOTO", unitPriceArs: "1500.00", packageSize: null, packagePriceArs: null,
      discountMode: "PROGRESIVO", discountPct: null, discountRules: [{ pct: 10, desde: 5 }], incomeCategoryId: "rubro-fotos",
    });
    expect(B.datos.fotofficeGaleriaEvento.map((e) => e.type)).toEqual(["VENTA_CONFIGURADA"]);
    expect(JSON.stringify(B.datos.fotofficeGaleriaEvento)).not.toMatch(/1500|Ana/);
  });
  it("pasar a 'Sólo selección' deja la galería sin precios ni descuentos (coherente con los CHECK)", async () => {
    await V.guardarVentaGaleria(GESTIONA, "g1", base({ discountMode: "UNICO", discountPct: "10" }));
    expect(await V.guardarVentaGaleria(GESTIONA, "g1", base({ saleMode: "SELECCION" }))).toEqual({ ok: true });
    expect(galeria()).toMatchObject({ saleMode: "SELECCION", includedCount: 0, pricingMode: null, unitPriceArs: null, discountMode: "NINGUNO", discountPct: null, discountRules: null });
  });
  it("cambiar de paquete a por foto vacía los datos del otro modo", async () => {
    await V.guardarVentaGaleria(GESTIONA, "g1", base({ includedCount: "0", pricingMode: "PAQUETE", packageSize: "10", packagePrice: "12.000" }));
    expect(galeria()).toMatchObject({ pricingMode: "PAQUETE", packageSize: 10, packagePriceArs: "12000.00", unitPriceArs: null });
    await V.guardarVentaGaleria(GESTIONA, "g1", base({ includedCount: "0" }));
    expect(galeria()).toMatchObject({ pricingMode: "POR_FOTO", unitPriceArs: "1500.00", packageSize: null, packagePriceArs: null });
  });
  it("rechaza una configuración inválida con todos los motivos y no toca nada", async () => {
    const r = await V.guardarVentaGaleria(GESTIONA, "g1", base({ pricingMode: "PAQUETE", packageSize: "1", packagePrice: "" }));
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.errores).toEqual([MENSAJES_PRECIOS.tamanoPaqueteInvalido, MENSAJES_PRECIOS.precioPaqueteInvalido]);
    expect(galeria().saleMode).toBe("SELECCION");
    expect(B.datos.fotofficeGaleriaEvento).toHaveLength(0);
  });
  it("el rubro tiene que ser de ingreso, activo y del workspace", async () => {
    for (const rubro of ["rubro-viejo", "rubro-egreso", "rubro-ajeno", "no-existe"]) {
      expect(await V.guardarVentaGaleria(GESTIONA, "g1", base({ incomeCategoryId: rubro }))).toEqual({ ok: false, error: F.MENSAJES_VENTA_FORM.rubroInvalido });
    }
    expect(galeria().saleMode).toBe("SELECCION");
    expect(await V.guardarVentaGaleria(GESTIONA, "g1", base({ incomeCategoryId: "rubro-fotos" }))).toEqual({ ok: true });
  });
  it("exige Gestionar y no cruza workspaces", async () => {
    expect(await V.guardarVentaGaleria(SOLO_VER, "g1", base())).toEqual({ ok: false, error: M.sinPermiso });
    expect(await V.guardarVentaGaleria(OTRO_WS, "g1", base())).toEqual({ ok: false, error: M.noExiste });
    expect(await V.guardarVentaGaleria(GESTIONA, "g-ajena", base())).toEqual({ ok: false, error: M.noExiste });
    expect(await V.guardarVentaGaleria(GESTIONA, "../x", base())).toEqual({ ok: false, error: M.datosInvalidos });
    expect(await V.guardarVentaGaleria(GESTIONA, "g1", { saleMode: { $ne: 1 } })).toEqual({ ok: false, error: F.MENSAJES_VENTA_FORM.datosInvalidos });
    expect(galeria().saleMode).toBe("SELECCION");
  });
  it("editar el precio no toca las compras que ya existen", async () => {
    B.agregar("fotofficeGaleriaCompra", {
      id: "c1", workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", status: "PAGADA", extraCount: 2, subtotalArs: "3000.00", totalArs: "3000.00",
      pricingSnapshot: { unitPriceCents: 150_000 },
    });
    await V.guardarVentaGaleria(GESTIONA, "g1", base({ unitPrice: "9.999,00" }));
    expect(B.datos.fotofficeGaleriaCompra[0]).toMatchObject({ status: "PAGADA", totalArs: "3000.00", pricingSnapshot: { unitPriceCents: 150_000 } });
  });
});

describe("cargarVentaGaleria", () => {
  it("devuelve el formulario con los importes en formato argentino y los rubros disponibles", async () => {
    await V.guardarVentaGaleria(GESTIONA, "g1", base({ discountMode: "PROGRESIVO", reglas: [{ pct: "10", desde: "5" }], incomeCategoryId: "rubro-fotos" }));
    const v = (await V.cargarVentaGaleria(SOLO_VER, "g1"))!;
    expect(v.formulario).toMatchObject({ saleMode: "SELECCION_Y_VENTA", includedCount: "20", pricingMode: "POR_FOTO", unitPrice: "1.500,00", discountMode: "PROGRESIVO", reglas: [{ pct: "10", desde: "5" }], incomeCategoryId: "rubro-fotos" });
    expect(v.rubros.map((r) => r.id)).toEqual(["rubro-fotos"]);
    expect(v.puedeGestionar).toBe(false);
  });
  it("incluye el rubro por omisión de Configuración y no filtra a otros workspaces", async () => {
    B.agregar("fotofficeGaleriaAjustes", { workspaceId: "ws-1", defaultIncomeCategoryId: "rubro-viejo" });
    const v = (await V.cargarVentaGaleria(GESTIONA, "g1"))!;
    expect(v.rubroPorOmision).toBe("Viejo");
    expect(v.rubros.map((r) => r.id).sort()).toEqual(["rubro-fotos", "rubro-viejo"]);
    expect(await V.cargarVentaGaleria(OTRO_WS, "g1")).toBeNull();
    expect(await V.cargarVentaGaleria(ctx("NONE"), "g1")).toBeNull();
    expect(await V.cargarVentaGaleria(GESTIONA, { $ne: 1 })).toBeNull();
  });
});
