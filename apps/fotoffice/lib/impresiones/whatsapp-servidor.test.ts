import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { crearPedidoDesdeWhatsapp } = await import("./whatsapp-servidor");

const FOTOLAG = "prov-fotolag";
const CATALOGO = [
  { id: "p1", name: "Copia instantánea 13x18", priceArs: 7000, costArs: null, preferredProveedorId: null },
  { id: "p2", name: "Copia para mañana 13x18 · más de 10", priceArs: 4500, costArs: 600, preferredProveedorId: FOTOLAG },
];
const foto = (id: string, extra: Record<string, unknown> = {}) => ({
  id, tipo: "IMAGEN",
  media: { id: `meta-${id}`, mimeType: "image/jpeg", descarga: "LISTO", clave: `bandeja/w1/c1/${id}.jpg`, ancho: 4000, alto: 3000, ...extra },
});

type Pedido = Record<string, unknown> & { items: { create: Record<string, unknown>[] } };

function base() {
  const pedidos: Pedido[] = [];
  const cancelados: unknown[] = [];
  const mensajes = [foto("m1"), foto("m2"), foto("m3", { descarga: "FALLO", clave: undefined }), foto("m4", { ancho: 600, alto: 400 })];
  const db = {
    $executeRaw: vi.fn(async () => 0),
    fotofficeWaMensaje: { findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => mensajes.filter((m) => where.id.in.includes(m.id))) },
    fotofficePrintOrder: {
      aggregate: vi.fn(async () => ({ _max: { number: pedidos.length } })),
      updateMany: vi.fn(async (a: unknown) => {
        cancelados.push(a);
        return { count: 1 };
      }),
      create: vi.fn(async ({ data }: { data: Pedido }) => {
        pedidos.push(data);
        return { id: `ord${pedidos.length}`, number: data.number, trackingToken: "tok" };
      }),
      update: vi.fn(async () => ({})),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  const deps = {
    db: db as never,
    ahora: () => new Date("2026-10-28T13:00:00.000Z"),
    moduloEncendido: async () => true,
    collector: async () => "token-mp",
    ajustes: async () => ({ depositPct: 50, porKmArs: 3000, maxKm: 30 }),
    productos: async (): Promise<{ id: string; name: string; priceArs: number; costArs: number | null; preferredProveedorId: string | null }[]> => CATALOGO,
    estudio: async () => ({ lat: -32.917, lon: -60.81 }),
    geocodificar: vi.fn(async () => ({ lat: -32.917, lon: -60.7275 })),
    abrir: vi.fn(async (d: { montoCents: number }) => `https://mp.test/pagar/${d.montoCents}`),
    origen: "https://fotoffice.test",
    slug: "dnx-estudio",
  };
  return { db, deps, pedidos, cancelados };
}

const chat = { id: "c1", waId: "5493410000000", clientId: "cli-1", nombre: "Ana" };
const renglon = (fotos: string[], extra: Record<string, unknown> = {}) => ({ fotos: fotos.map((mensajeId) => ({ mensajeId })), medida: "13x18", cantidad: 2, plazo: "MANANA" as const, papel: "BRILLO" as const, ...extra });

let B: ReturnType<typeof base>;
beforeEach(() => {
  B = base();
});

describe("crear un pedido de impresión desde WhatsApp", () => {
  it("2 fotos × 2 copias 13x18 para mañana: precio de la instantánea, seña del 50 % y dos links", async () => {
    const r = await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m1", "m2"])], envio: null, nombre: "Ana Pérez" }, B.deps);
    expect(r).toMatchObject({ ok: true, numero: 1, subtotal: 28000, envio: 0, total: 28000, sena: 14000, depositPct: 50 });
    if (!r.ok) return;
    expect(r.linkSena).toBe("https://mp.test/pagar/1400000");
    expect(r.linkTotal).toBe("https://mp.test/pagar/2800000");
    const p = B.pedidos[0]!;
    expect(p).toMatchObject({ source: "WHATSAPP", email: null, telefono: "+5493410000000", waChatId: "c1", waId: "5493410000000", clientId: "cli-1", depositArs: "14000.00", delivery: "RETIRO", totalArs: "28000.00" });
    expect(p.items.create).toHaveLength(2);
    expect(p.items.create[0]).toMatchObject({ sourceKey: "bandeja/w1/c1/m1.jpg", quantity: 2, widthCm: 13, heightCm: 18, plazo: "MANANA", paper: "BRILLO", sinRecorte: true, calidadBaja: false, proveedorId: FOTOLAG, cropX: 0, cropY: 0, cropW: 1, cropH: 1, unitPriceArs: "7000.00", unitCostArs: "600.00" });
  });

  it("una foto que no se pudo bajar frena el pedido y dice cuál", async () => {
    const r = await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m1", "m3"])], envio: null, nombre: "Ana" }, B.deps);
    expect(r).toEqual({ ok: false, motivo: "FOTO_NO_LISTA", detalle: "m3" });
    expect(B.pedidos).toHaveLength(0);
  });

  it("una foto chica queda marcada de calidad baja", async () => {
    await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m4"])], envio: null, nombre: "Ana" }, B.deps);
    expect(B.pedidos[0]!.items.create[0]).toMatchObject({ calidadBaja: true });
  });

  it("un pedido nuevo del mismo chat cancela el pendiente anterior", async () => {
    await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m1"])], envio: null, nombre: "Ana" }, B.deps);
    expect(B.cancelados[0]).toEqual({ where: { workspaceId: "w1", waChatId: "c1", status: "PENDIENTE_PAGO" }, data: { status: "CANCELADO", lastError: "REEMPLAZADO" } });
  });

  it("envío a ~10 km suma $30.000; a más de 30 km no se vende", async () => {
    const r = await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m1"])], envio: { direccion: "Mitre 100, Funes" }, nombre: "Ana" }, B.deps);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.envio).toBeGreaterThanOrEqual(29000);
    expect(r.envio).toBeLessThanOrEqual(31000);
    expect(r.envio % 100).toBe(0);
    expect(r.total).toBe(14000 + r.envio);
    expect(B.pedidos[0]).toMatchObject({ delivery: "ENVIO", shippingArs: `${r.envio}.00`, shippingAddress: "Mitre 100, Funes" });
    B.deps.geocodificar.mockResolvedValueOnce({ lat: -33.3, lon: -60.81 });
    expect(await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m1"])], envio: { direccion: "lejos" }, nombre: "Ana" }, B.deps)).toMatchObject({ ok: false, motivo: "ENVIO_LEJOS" });
  });

  it("una medida que no está en el catálogo no se inventa", async () => {
    const r = await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m1"], { medida: "13x13" })], envio: null, nombre: "Ana" }, B.deps);
    expect(r).toEqual({ ok: false, motivo: "PRECIO", detalle: "13x13 para mañana" });
  });

  it("una copia de laboratorio cuyo producto no tiene laboratorio no se cobra: pasa a persona", async () => {
    B.deps.productos = async () => [
      { id: "p1", name: "Copia instantánea 13x18", priceArs: 7000, costArs: null, preferredProveedorId: null },
      { id: "p2", name: "Copia para mañana 13x18 · más de 10", priceArs: 4500, costArs: 600, preferredProveedorId: null },
    ];
    const r = await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m1"])], envio: null, nombre: "Ana" }, B.deps);
    expect(r).toEqual({ ok: false, motivo: "SIN_LABORATORIO", detalle: "13x18 para mañana" });
    expect(B.pedidos).toHaveLength(0);
  });

  it("precios con centavos: los cobros van en centavos enteros", async () => {
    B.deps.productos = async () => [
      { id: "p1", name: "Copia instantánea 13x18", priceArs: 7000.55, costArs: null, preferredProveedorId: null },
      { id: "p2", name: "Copia para mañana 13x18 · más de 10", priceArs: 4500, costArs: 600, preferredProveedorId: FOTOLAG },
    ];
    await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m1"], { cantidad: 3 })], envio: null, nombre: "Ana" }, B.deps);
    for (const c of B.deps.abrir.mock.calls) expect(Number.isInteger((c[0] as { montoCents: number }).montoCents)).toBe(true);
  });

  it("módulo apagado o sin Mercado Pago: no arma", async () => {
    expect(await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m1"])], envio: null, nombre: "Ana" }, { ...B.deps, moduloEncendido: async () => false })).toMatchObject({ ok: false, motivo: "MODULO" });
    expect(await crearPedidoDesdeWhatsapp("w1", chat, { renglones: [renglon(["m1"])], envio: null, nombre: "Ana" }, { ...B.deps, collector: async () => null })).toMatchObject({ ok: false, motivo: "SIN_MP" });
  });
});
