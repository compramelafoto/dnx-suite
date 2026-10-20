/* eslint-disable @typescript-eslint/no-unused-vars -- los mocks reciben argumentos */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficePrintSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  fotofficePrintSize: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  fotofficeProveedor: { findMany: vi.fn() },
  workspaceFeatureModule: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: vi.fn(async () => true) }));
const cobra = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => true));
vi.mock("@/lib/payments/connect/collector", () => ({ puedeCobrarConMercadoPago: cobra }));
const extras = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => null as unknown));
vi.mock("@/lib/presupuestos/perfil-cobro", () => ({ extrasDelWorkspace: extras }));
const C = await import("./configuracion-servidor");

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  cobra.mockResolvedValue(true);
  extras.mockResolvedValue(null);
});

const UBICADO = { studioLatitude: "-32,9476", studioLongitude: "-60.6305", travelPerKm: "1.200" };
const TAMANO = { id: "a", widthCm: 10, heightCm: 15, proveedorId: "f", priceArs: "500", costArs: "200", active: true };

describe("ofertaPublica · envío", () => {
  it("con envío encendido y el estudio ubicado ofrece envío en centavos", async () => {
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: true, shippingEnabled: true, shippingBaseArs: "1500", shippingPerKmArs: { toString: () => "300.5" }, shippingMaxKm: 30 });
    db.fotofficePrintSize.findMany.mockResolvedValue([TAMANO]);
    extras.mockResolvedValue(UBICADO);
    const o = await C.ofertaPublica("ws");
    expect(o?.envio).toEqual({ baseCents: 150000, porKmCents: 30050, maxKm: 30, estudio: { lat: -32.9476, lon: -60.6305 } });
    expect(extras).toHaveBeenCalledWith("ws");
  });
  it("envío apagado: null", async () => {
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: true, shippingEnabled: false, shippingBaseArs: "1500", shippingPerKmArs: "300", shippingMaxKm: null });
    db.fotofficePrintSize.findMany.mockResolvedValue([TAMANO]);
    extras.mockResolvedValue(UBICADO);
    expect((await C.ofertaPublica("ws"))?.envio).toBeNull();
  });
  it("encendido pero el estudio sin ubicación: null (sólo retiro)", async () => {
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: true, shippingEnabled: true, shippingBaseArs: "1500", shippingPerKmArs: "300", shippingMaxKm: null });
    db.fotofficePrintSize.findMany.mockResolvedValue([TAMANO]);
    extras.mockResolvedValue({ studioLatitude: "", studioLongitude: "", travelPerKm: "" });
    expect((await C.ofertaPublica("ws"))?.envio).toBeNull();
  });
});

describe("guardarAjustes · envío", () => {
  const ok = { paperGlossy: true, paperMatte: false, testMode: false, circuitId: "" };
  it("guarda base, precio por km y máximo leídos a la argentina", async () => {
    extras.mockResolvedValue(UBICADO);
    const r = await C.guardarAjustes("ws", { ...ok, shippingEnabled: true, shippingBaseArs: "1.500", shippingPerKmArs: "300,50", shippingMaxKm: "25" });
    expect(r).toEqual({ ok: true });
    expect(db.fotofficePrintSettings.upsert.mock.calls[0][0].update).toMatchObject({ shippingEnabled: true, shippingBaseArs: 1500, shippingPerKmArs: 300.5, shippingMaxKm: 25 });
  });
  it("sin máximo queda sin tope", async () => {
    extras.mockResolvedValue(UBICADO);
    await C.guardarAjustes("ws", { ...ok, shippingEnabled: true, shippingBaseArs: "", shippingPerKmArs: "300", shippingMaxKm: "" });
    expect(db.fotofficePrintSettings.upsert.mock.calls[0][0].update).toMatchObject({ shippingBaseArs: null, shippingMaxKm: null });
  });
  it("no deja encender el envío sin la ubicación del estudio", async () => {
    extras.mockResolvedValue({ studioLatitude: "", studioLongitude: "", travelPerKm: "" });
    const r = await C.guardarAjustes("ws", { ...ok, shippingEnabled: true, shippingPerKmArs: "300" });
    expect(r).toEqual({ ok: false, error: "Cargá la ubicación de tu estudio en Configuración → Precios para ofrecer envíos." });
    expect(db.fotofficePrintSettings.upsert).not.toHaveBeenCalled();
  });
  it("apagado se guarda aunque no haya ubicación", async () => {
    const r = await C.guardarAjustes("ws", { ...ok, shippingEnabled: false });
    expect(r).toEqual({ ok: true });
    expect(db.fotofficePrintSettings.upsert.mock.calls[0][0].update).toMatchObject({ shippingEnabled: false });
  });
  it("rechaza montos o máximos inválidos", async () => {
    extras.mockResolvedValue(UBICADO);
    expect((await C.guardarAjustes("ws", { ...ok, shippingEnabled: true, shippingPerKmArs: "-3" })).ok).toBe(false);
    expect((await C.guardarAjustes("ws", { ...ok, shippingEnabled: true, shippingPerKmArs: "300", shippingMaxKm: "2,5" })).ok).toBe(false);
    expect(db.fotofficePrintSettings.upsert).not.toHaveBeenCalled();
  });
});

describe("ofertaPublica", () => {
  it("sólo ofrece tamaños activos con precio", async () => {
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: false });
    db.fotofficePrintSize.findMany.mockResolvedValue([
      { id: "a", widthCm: 10, heightCm: 15, proveedorId: "f", priceArs: "500", costArs: "200", active: true },
      { id: "b", widthCm: 13, heightCm: 18, proveedorId: "f", priceArs: null, costArs: "300", active: true },
    ]);
    const o = await C.ofertaPublica("ws");
    expect(o?.papeles).toEqual(["BRILLO"]);
    expect(o?.tamanos.map((t) => t.id)).toEqual(["a"]);
    expect(o?.tamanos[0].priceCents).toBe(50000);
  });
  it("sólo busca tamaños con un laboratorio activo asignado", async () => {
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: true });
    db.fotofficePrintSize.findMany.mockResolvedValue([]);
    await C.ofertaPublica("ws");
    expect(db.fotofficePrintSize.findMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws", active: true, proveedorId: { not: null }, proveedor: { active: true } });
  });
  it("si el estudio no puede cobrar con Mercado Pago no hay oferta (no se muestra el botón)", async () => {
    cobra.mockResolvedValue(false);
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: true });
    db.fotofficePrintSize.findMany.mockResolvedValue([{ id: "a", widthCm: 10, heightCm: 15, proveedorId: "f", priceArs: "500", costArs: "200", active: true }]);
    expect(await C.ofertaPublica("ws")).toBeNull();
    expect(cobra).toHaveBeenCalledWith("ws");
  });
  it("sin tamaños con precio no hay oferta", async () => {
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: true });
    db.fotofficePrintSize.findMany.mockResolvedValue([]);
    expect(await C.ofertaPublica("ws")).toBeNull();
  });
});

describe("sembrarTamanos", () => {
  it("no siembra dos veces", async () => {
    db.fotofficePrintSize.count.mockResolvedValue(3);
    await C.sembrarTamanos("ws");
    expect(db.fotofficePrintSize.createMany).not.toHaveBeenCalled();
  });
  it("asigna Fotolag y La Isla por nombre", async () => {
    db.fotofficePrintSize.count.mockResolvedValue(0);
    db.fotofficeProveedor.findMany.mockResolvedValue([{ id: "f", name: "Fotolag" }, { id: "i", name: "La Isla" }]);
    await C.sembrarTamanos("ws");
    const data = db.fotofficePrintSize.createMany.mock.calls[0][0].data;
    expect(data.find((d: { widthCm: number }) => d.widthCm === 20)?.proveedorId).toBe("f");
    expect(data.find((d: { widthCm: number }) => d.widthCm === 50)?.proveedorId).toBe("i");
  });
});

describe("guardarTamanos", () => {
  const fila = (o: object = {}) => ({ id: "a", costArs: "100", priceArs: "1.500,50", proveedorId: null, active: true, ...o });
  it("rechaza precios negativos", async () => {
    expect((await C.guardarTamanos("ws", [fila({ costArs: "-1" })])).ok).toBe(false);
  });
  it("rechaza un tamaño con precio y sin laboratorio", async () => {
    const r = await C.guardarTamanos("ws", [fila({ proveedorId: null })]);
    expect(r).toEqual({ ok: false, error: "Elegí un laboratorio para cada tamaño con precio." });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("un tamaño sin precio puede quedar sin laboratorio", async () => {
    db.fotofficePrintSize.updateMany.mockResolvedValue({ count: 1 });
    expect(await C.guardarTamanos("ws", [fila({ priceArs: "", proveedorId: null })])).toEqual({ ok: true });
  });
  it("rechaza un laboratorio de otro estudio", async () => {
    db.fotofficeProveedor.findMany.mockResolvedValue([]);
    const r = await C.guardarTamanos("ws", [fila({ proveedorId: "ajeno" })]);
    expect(r).toEqual({ ok: false, error: "Uno de los laboratorios no es de tu estudio." });
    expect(db.fotofficeProveedor.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["ajeno"] }, workspaceId: "ws" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("guarda todo dentro de una transacción, acotado al estudio", async () => {
    db.fotofficeProveedor.findMany.mockResolvedValue([{ id: "p" }]);
    db.fotofficePrintSize.updateMany.mockResolvedValue({ count: 1 });
    const r = await C.guardarTamanos("ws", [fila({ proveedorId: "p" }), fila({ id: "b", priceArs: "" })]);
    expect(r).toEqual({ ok: true });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.fotofficePrintSize.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "a", workspaceId: "ws" }, data: { priceArs: 1500.5, costArs: 100, proveedorId: "p" } });
  });
  it("si un tamaño no existe o es ajeno, falla todo", async () => {
    db.fotofficeProveedor.findMany.mockResolvedValue([{ id: "p" }]);
    db.fotofficePrintSize.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const r = await C.guardarTamanos("ws", [fila({ proveedorId: "p" }), fila({ id: "ajeno", proveedorId: "p" })]);
    expect(r).toEqual({ ok: false, error: "Uno de los tamaños ya no existe. Recargá la página." });
  });
});

describe("leerAjustes", () => {
  it("devuelve los montos en formato es-AR que el guardado entiende", async () => {
    db.fotofficePrintSize.count.mockResolvedValue(1);
    db.fotofficePrintSettings.findUnique.mockResolvedValue(null);
    db.fotofficePrintSize.findMany.mockResolvedValue([
      { id: "a", widthCm: 10, heightCm: 15, proveedorId: null, proveedor: null, costArs: { toString: () => "1500.5" }, priceArs: null, active: true },
    ]);
    const a = await C.leerAjustes("ws");
    expect(a.tamanos[0].costArs).toBe("1500,50");
    expect(a.tamanos[0].priceArs).toBe("");
  });
  it("propone el precio por km del perfil cuando el de envío está vacío", async () => {
    db.fotofficePrintSize.count.mockResolvedValue(1);
    db.fotofficePrintSettings.findUnique.mockResolvedValue(null);
    db.fotofficePrintSize.findMany.mockResolvedValue([]);
    extras.mockResolvedValue(UBICADO);
    const a = await C.leerAjustes("ws");
    expect(a.envio).toEqual({ encendido: false, baseArs: "", porKmArs: "1200", maxKm: "", estudioUbicado: true });
  });
  it("el precio por km guardado gana sobre el del perfil", async () => {
    db.fotofficePrintSize.count.mockResolvedValue(1);
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ shippingEnabled: true, shippingBaseArs: "1000", shippingPerKmArs: "250", shippingMaxKm: 20 });
    db.fotofficePrintSize.findMany.mockResolvedValue([]);
    extras.mockResolvedValue(null);
    const a = await C.leerAjustes("ws");
    expect(a.envio).toEqual({ encendido: true, baseArs: "1000", porKmArs: "250", maxKm: "20", estudioUbicado: false });
  });
});
