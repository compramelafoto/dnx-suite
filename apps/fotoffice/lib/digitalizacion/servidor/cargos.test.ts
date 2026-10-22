import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({
  extras: vi.fn(async (..._a: unknown[]) => ({ studioLatitude: "-32.9468", studioLongitude: "-60.6393" }) as unknown),
  lugar: vi.fn(async (e: { direccion: string; detalles: string }) => ({
    direccion: e.direccion,
    lugar: { address: "Av. Real 100", city: "Funes" } as unknown,
  })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/pedidos/enlace", () => ({
  enlaceDelPedidoDelSistema: vi.fn(async () => ({ ok: true, url: "https://fotoffice.com/w/fp/pedido/TOKEN" })),
}));
vi.mock("@/lib/presupuestos/perfil-cobro", () => ({ extrasDelWorkspace: H.extras }));
vi.mock("@/lib/impresiones/direccion-servidor", () => ({
  lugarDelPunto: H.lugar,
  MAX_DIRECCION: 300,
  textoLimpio: (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : ""),
}));

const C = await import("./cargos");
const { hashDeToken } = await import("@/lib/presupuestos/enlace");

const AHORA = new Date("2026-10-22T15:00:00.000Z");
const deps = { ahora: () => AHORA };
const TOKEN = "a".repeat(43);
const VENCE = new Date("2026-11-21T02:59:59.999Z");
const FUNES = { lat: -32.9167, lon: -60.8167, direccion: "Av. Real 100, Funes", detalles: "" };

const pedido = () => B.datos.fotofficePedido.find((p) => p.id === "ped-1")!;
const entrega = () => B.datos.digitalizacionEntrega.find((e) => e.id === "ent-1")!;
const cargos = () => B.datos.digitalizacionCargo;

/** Paga una cuota entera (un cobro vigente imputado a ella). */
function pagar(cuotaId: string) {
  const c = B.datos.fotofficePedidoCuota.find((x) => x.id === cuotaId)!;
  B.agregar("fotofficeCobro", { id: `cob-${cuotaId}`, workspaceId: "ws-1", pedidoId: "ped-1", amountArs: c.amountArs, voidedAt: null, receiptNumber: `R-${cuotaId}`, receiptTokenHash: `h-${cuotaId}` });
  B.agregar("fotofficeCobroImputacion", { workspaceId: "ws-1", cobroId: `cob-${cuotaId}`, cuotaId, amountArs: c.amountArs });
}

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.extras.mockClear();
  H.lugar.mockClear();
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", firstName: "Ana", lastName: "Paz", address: null, city: null });
  B.agregar("fotofficePedido", {
    id: "ped-1", workspaceId: "ws-1", number: "2026-0001", clientId: "cli-1", status: "EN_CURSO", totalArs: "30000.00",
    items: [{ id: "it-1", productId: null, nombre: "Digitalización VHS", descripcion: null, cantidad: 2, precioUnitario: 15000, descuento: null, modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false }],
    totals: { subtotal: 30000, descuentoItems: 0, descuentoGlobal: 0, iva: 0, total: 30000, opcionales: { cantidad: 0, total: 0 }, secciones: [], renglones: {}, descuento: null },
  });
  B.agregar("fotofficePedidoCuota", { id: "cuota-1", workspaceId: "ws-1", pedidoId: "ped-1", position: 1, dueDate: new Date("2026-10-01T00:00:00Z"), amountArs: "30000.00" });
  pagar("cuota-1");
  B.agregar("fotofficeProyecto", { id: "pro-1", workspaceId: "ws-1", pedidoId: "ped-1", pedidoItemIndex: 0, number: "T-1", name: "Digitalización" });
  B.agregar("digitalizacionGrabacion", { id: "gra-1", workspaceId: "ws-1", proyectoId: "pro-1", estado: "COMPLETA", conversionEstado: "LISTA", tipo: "VHS", titulo: null, cassetteNumero: 1, videoBorradoAt: null, descargasExtra: 0 });
  B.agregar("digitalizacionEntrega", {
    id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1", accessTokenHash: hashDeToken(TOKEN), enviadoAt: new Date("2026-10-20T15:00:00Z"),
    videosVencenAt: VENCE, cassettesVencenAt: VENCE, videosBorradosAt: null, recordatorios: [10], extensiones: 0,
    envioEstado: null, envioDireccion: null, envioPrecioArs: null,
  });
  B.agregar("digitalizacionAjustes", { workspaceId: "ws-1", enviosFranjas: [{ hastaKm: 10, precioArs: 4000 }, { hastaKm: 40, precioArs: 9000 }] });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(JSON.stringify(errores.mock.calls)).not.toMatch(/Ana|Paz|Real/);
  errores.mockRestore();
});

describe("comprar otra descarga", () => {
  it("cobra el 25 % del precio del trabajo, crea el cargo PENDIENTE y manda a pagar esa cuota", async () => {
    const r = await C.pedirDescargaExtra("ws-1", TOKEN, "gra-1", deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [c] = cargos();
    expect(c).toMatchObject({ tipo: "DESCARGA_EXTRA", grabacionId: "gra-1", montoArs: "3750.00", estado: "PENDIENTE", entregaId: "ent-1", pedidoId: "ped-1" });
    expect(r.urlPagar).toBe(`https://fotoffice.com/w/fp/pedido/TOKEN?pagar=${c!.cuotaId}`);
    expect(pedido().totalArs).toBe("33750.00");
    expect((pedido().items as { nombre: string }[])[1]!.nombre).toBe("Descarga extra · Cassette 1");
  });

  it("un segundo pedido igual sin pagar reusa el mismo cargo", async () => {
    await C.pedirDescargaExtra("ws-1", TOKEN, "gra-1", deps);
    const r = await C.pedirDescargaExtra("ws-1", TOKEN, "gra-1", deps);
    expect(r).toMatchObject({ ok: true, reusado: true });
    expect(cargos()).toHaveLength(1);
    expect(pedido().totalArs).toBe("33750.00");
  });

  it("no se compra la descarga de un video borrado ni con un token ajeno", async () => {
    B.datos.digitalizacionGrabacion[0]!.videoBorradoAt = AHORA;
    expect(await C.pedirDescargaExtra("ws-1", TOKEN, "gra-1", deps)).toEqual({ ok: false, error: C.MENSAJES_CARGOS.videoBorrado });
    expect(await C.pedirDescargaExtra("ws-2", TOKEN, "gra-1", deps)).toEqual({ ok: false, error: C.MENSAJES_CARGOS.noExiste });
    expect(cargos()).toHaveLength(0);
  });
});

describe("extender 30 días", () => {
  it("cobra el 50 % del total original, sin contar los cargos extra", async () => {
    await C.pedirDescargaExtra("ws-1", TOKEN, "gra-1", deps);
    const r = await C.pedirExtension("ws-1", TOKEN, deps);
    expect(r.ok).toBe(true);
    expect(cargos().find((c) => c.tipo === "EXTENSION")).toMatchObject({ montoArs: "15000.00", grabacionId: null });
  });

  it("no se extiende con los videos borrados", async () => {
    entrega().videosBorradosAt = AHORA;
    expect(await C.pedirExtension("ws-1", TOKEN, deps)).toEqual({ ok: false, error: C.MENSAJES_CARGOS.borrados });
  });
});

describe("aplicar los cargos pagos", () => {
  it("una descarga extra paga suma una descarga, una sola vez", async () => {
    await C.pedirDescargaExtra("ws-1", TOKEN, "gra-1", deps);
    expect(await C.aplicarCargosPagados({ workspaceId: "ws-1", pedidoId: "ped-1" }, deps)).toMatchObject({ aplicados: 0 });
    pagar(cargos()[0]!.cuotaId as string);
    expect(await C.aplicarCargosPagados({ workspaceId: "ws-1", pedidoId: "ped-1" }, deps)).toMatchObject({ aplicados: 1 });
    expect(await C.aplicarCargosPagados(null, deps)).toMatchObject({ aplicados: 0, revisados: 0 });
    expect(B.datos.digitalizacionGrabacion[0]!.descargasExtra).toBe(1);
    expect(cargos()[0]).toMatchObject({ estado: "APLICADO", aplicadoAt: AHORA });
    expect(B.datos.fotofficeProyectoNota.map((n) => n.body)).toEqual(["Pago acreditado (3.750 pesos): una descarga extra de «Cassette 1»."]);
  });

  it("una extensión paga corre el vencimiento 30 días y vacía los recordatorios", async () => {
    await C.pedirExtension("ws-1", TOKEN, deps);
    pagar(cargos()[0]!.cuotaId as string);
    await C.aplicarCargosPagados(null, deps);
    expect((entrega().videosVencenAt as Date).toISOString()).toBe("2026-12-21T02:59:59.999Z");
    expect(entrega()).toMatchObject({ extensiones: 1, recordatorios: [] });
  });

  it("toma primero el candado del pedido y después el de la entrega", async () => {
    await C.pedirExtension("ws-1", TOKEN, deps);
    pagar(cargos()[0]!.cuotaId as string);
    B.sql.length = 0;
    await C.aplicarCargosPagados(null, deps);
    const i = B.sql.findIndex((s) => s.texto.includes("pg_advisory_xact_lock"));
    const j = B.sql.findIndex((s) => s.texto.includes('"DigitalizacionEntrega"'));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(j).toBeGreaterThan(i);
  });

  it("una cuota que ya no está en el plan deja el cargo anulado", async () => {
    await C.pedirExtension("ws-1", TOKEN, deps);
    B.datos.fotofficePedidoCuota = B.datos.fotofficePedidoCuota.filter((c) => c.id === "cuota-1");
    expect(await C.aplicarCargosPagados(null, deps)).toMatchObject({ anulados: 1 });
    expect(cargos()[0]!.estado).toBe("ANULADO");
  });
});

describe("envío de los cassettes", () => {
  it("con franja crea el cargo, guarda la dirección y completa la ficha vacía", async () => {
    const r = await C.pedirEnvioCassettes("ws-1", TOKEN, FUNES, deps);
    expect(r).toMatchObject({ ok: true, estado: "A_PAGAR", precioArs: 9000 });
    expect(cargos()[0]).toMatchObject({ tipo: "ENVIO", montoArs: "9000.00" });
    expect(entrega()).toMatchObject({ envioEstado: "A_PAGAR", envioDireccion: "Av. Real 100, Funes", envioLat: FUNES.lat, envioLng: FUNES.lon, envioPrecioArs: "9000.00", envioPedidoAt: AHORA });
    expect(entrega().envioKm).toBeGreaterThan(10);
    expect(B.datos.client[0]).toMatchObject({ address: "Av. Real 100", city: "Funes" });
    expect(B.datos.fotofficeProyectoNota[0]!.body).toMatch(/pidió el envío de los cassettes a Av\. Real 100, Funes .*9\.000 pesos, pendiente de pago/);
  });

  it("no pisa la dirección que cargó el equipo", async () => {
    B.datos.client[0]!.address = "San Martín 1";
    B.datos.client[0]!.city = "Rosario";
    await C.pedirEnvioCassettes("ws-1", TOKEN, FUNES, deps);
    expect(B.datos.client[0]).toMatchObject({ address: "San Martín 1", city: "Rosario" });
    expect(B.datos.fotofficeProyectoNota[0]!.body).toMatch(/ya tenía otra dirección/);
  });

  it("sin coordenadas del estudio o fuera de las franjas queda a coordinar, sin cargo", async () => {
    H.extras.mockResolvedValueOnce(null);
    expect(await C.pedirEnvioCassettes("ws-1", TOKEN, FUNES, deps)).toEqual({ ok: true, estado: "A_COORDINAR", mensaje: C.A_COORDINAR_TEXTO });
    expect(cargos()).toHaveLength(0);
    expect(entrega()).toMatchObject({ envioEstado: "A_COORDINAR", envioPrecioArs: null });
    B.datos.digitalizacionAjustes[0]!.enviosFranjas = [{ hastaKm: 5, precioArs: 4000 }];
    expect(await C.pedirEnvioCassettes("ws-1", TOKEN, FUNES, deps)).toMatchObject({ estado: "A_COORDINAR" });
  });

  it("pedirlo a otra dirección reemplaza el cargo sin pagar; a la misma, lo reusa", async () => {
    await C.pedirEnvioCassettes("ws-1", TOKEN, FUNES, deps);
    await C.pedirEnvioCassettes("ws-1", TOKEN, FUNES, deps);
    expect(cargos().filter((c) => c.estado === "PENDIENTE")).toHaveLength(1);
    expect(pedido().totalArs).toBe("39000.00");
    await C.pedirEnvioCassettes("ws-1", TOKEN, { lat: -32.95, lon: -60.65, direccion: "Centro", detalles: "" }, deps);
    expect(cargos().map((c) => [c.estado, c.montoArs])).toEqual([["ANULADO", "9000.00"], ["PENDIENTE", "4000.00"]]);
    expect(pedido().totalArs).toBe("34000.00");
  });

  it("no se pide con los cassettes vencidos ni con el envío confirmado", async () => {
    entrega().envioEstado = "CONFIRMADO";
    expect(await C.pedirEnvioCassettes("ws-1", TOKEN, FUNES, deps)).toEqual({ ok: false, error: C.MENSAJES_CARGOS.envioYaConfirmado });
    entrega().envioEstado = null;
    entrega().cassettesVencenAt = new Date("2026-10-01T00:00:00Z");
    expect(await C.pedirEnvioCassettes("ws-1", TOKEN, FUNES, deps)).toEqual({ ok: false, error: C.MENSAJES_CARGOS.cassettesVencidos });
  });

  it("al pagarse queda confirmado y después se marca entregado", async () => {
    await C.pedirEnvioCassettes("ws-1", TOKEN, FUNES, deps);
    expect(await C.marcarEnvioEntregado("ws-1", "ent-1")).toEqual({ ok: false, error: "El envío todavía no está pago." });
    pagar(cargos()[0]!.cuotaId as string);
    await C.aplicarCargosPagados(null, deps);
    expect(entrega().envioEstado).toBe("CONFIRMADO");
    expect(await C.marcarEnvioEntregado("ws-1", "ent-1")).toEqual({ ok: true });
    expect(entrega().envioEstado).toBe("ENTREGADO");
  });
});

describe("anular un cargo", () => {
  it("lo saca del pedido y el envío vuelve a sin pedir", async () => {
    await C.pedirEnvioCassettes("ws-1", TOKEN, FUNES, deps);
    expect(await C.anularCargo("ws-1", cargos()[0]!.id)).toEqual({ ok: true });
    expect(pedido().totalArs).toBe("30000.00");
    expect(cargos()[0]!.estado).toBe("ANULADO");
    expect(entrega().envioEstado).toBeNull();
  });

  it("la limpieza diaria anula las descargas pendientes de videos ya borrados", async () => {
    await C.pedirDescargaExtra("ws-1", TOKEN, "gra-1", deps);
    entrega().videosBorradosAt = AHORA;
    expect(await C.anularCargosSinSentido(deps)).toBe(1);
    expect(pedido().totalArs).toBe("30000.00");
  });
});
