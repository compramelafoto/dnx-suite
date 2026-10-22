import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const d = {
    digitalizacionEntrega: { findFirst: vi.fn() },
    digitalizacionGrabacion: { findMany: vi.fn(), findFirst: vi.fn() },
    digitalizacionDescarga: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    fotofficePedido: { findFirst: vi.fn() },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(),
  };
  d.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(d));
  return d;
});
vi.mock("@repo/db", () => ({ prisma: db }));
const almacen = vi.hoisted(() => ({ urlDeVideo: vi.fn(async (_k: string, _n: string, modo: string, _s?: number) => `https://r2/${modo}`), SEGUNDOS_HLS: 14400 }));
vi.mock("./almacen", () => almacen);
const saldo = vi.hoisted(() => ({ saldoDelPedido: vi.fn() }));
vi.mock("@/lib/pedidos/candado-saldo", () => saldo);
const cargos = vi.hoisted(() => ({
  cargosPendientes: vi.fn(async () => new Map()),
  urlsParaPagar: vi.fn(async () => new Map()),
}));
// El saldo de los videos es el del pedido sin los cargos pendientes: acá, el mismo mock del saldo.
vi.mock("./cargos", () => ({ ...cargos, saldoDeVideosMinor: (...a: unknown[]) => saldo.saldoDelPedido(...a) }));
const plan = vi.hoisted(() => ({ bloquearPedido: vi.fn(async () => 0) }));
vi.mock("@/lib/pedidos/plan", () => plan);
vi.mock("@/lib/pedidos/enlace", () => ({ enlaceDelPedidoDelSistema: vi.fn(async () => ({ ok: true, url: "https://fotoffice.com/w/fp/pedido/PED" })) }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: vi.fn(async () => ({ workspaceId: "ws1", slug: "fp", customDomain: null, nombre: "Foto Positiva", logoUrl: "http://inseguro/logo.png", whatsapp: null, email: null })),
}));

import { enlaceDelPedidoDelSistema } from "@/lib/pedidos/enlace";
import { abrirEntregaPublica, abrirVistaPreviaDelEquipo, registrarDescarga, vistaDeEntregaPublica } from "./videos-publicos";

const TOKEN = "a".repeat(43);
const AHORA = new Date("2026-10-22T15:00:00Z");
const entrega = (extra: Record<string, unknown> = {}) => ({
  id: "e1", pedidoId: "p1", videosVencenAt: new Date("2026-11-21T15:00:00Z"), cassettesVencenAt: new Date("2026-11-21T15:00:00Z"), videosBorradosAt: null, ...extra,
});
const video = { id: "g1", titulo: null, tipo: "VHS", cassetteNumero: 2, videoDuracionSeg: 3600, videoKey: "digitalizacion/ws1/g1/final.mp4", hlsKey: "digitalizacion/ws1/g1/hls", conversionError: null, videoBorradoAt: null, descargasExtra: 1, _count: { descargas: 2 } };

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
  db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
  db.digitalizacionDescarga.findFirst.mockResolvedValue(null);
  db.fotofficePedido.findFirst.mockResolvedValue({ number: "P-12", status: "CONFIRMADO", client: { firstName: "Ana", lastName: "Gómez", businessName: null } });
  db.digitalizacionGrabacion.findMany.mockResolvedValue([video]);
  saldo.saldoDelPedido.mockResolvedValue({ numero: "P-12", saldoMinor: 0 });
});

describe("abrirEntregaPublica", () => {
  it("token sin forma o desconocido: null", async () => {
    expect(await abrirEntregaPublica("ws1", "corto", AHORA)).toBeNull();
    expect(db.digitalizacionEntrega.findFirst).not.toHaveBeenCalled();
    db.digitalizacionEntrega.findFirst.mockResolvedValue(null);
    expect(await abrirEntregaPublica("ws1", TOKEN, AHORA)).toBeNull();
    expect(db.digitalizacionEntrega.findFirst.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws1", enviadoAt: { not: null } });
  });
  it("pagado y vigente: vista previa HLS y descargas contadas; el MP4 nunca se firma para mirar", async () => {
    const v = await abrirEntregaPublica("ws1", TOKEN, AHORA);
    expect(v).toMatchObject({ habilitados: true, pedidoNumero: "P-12", cliente: "Ana Gómez", borradosAt: null });
    expect(v!.organizacion.logoUrl).toBeNull();
    expect(v!.videos).toEqual([{ id: "g1", titulo: "Cassette 2", duracionSeg: 3600, quedan: 2, total: 4, vistaPrevia: true, vistaPreviaAgotada: false, puedeComprar: true, descargaPendiente: null }]);
    expect(v).toMatchObject({ puedeExtender: true, extensionPendiente: null, envio: { puedePedir: true, estado: null, urlPagar: null } });
    expect(almacen.urlDeVideo).not.toHaveBeenCalled();
  });
  it("sin versión HLS (o con una clave ajena): sin vista previa, y tampoco firma el MP4", async () => {
    db.digitalizacionGrabacion.findMany.mockResolvedValue([{ ...video, hlsKey: null }, { ...video, id: "g2", hlsKey: "digitalizacion/ws1/g1/hls" }]);
    const v = await abrirEntregaPublica("ws1", TOKEN, AHORA);
    expect(v!.videos.map((x) => x.vistaPrevia)).toEqual([false, false]);
    expect(almacen.urlDeVideo).not.toHaveBeenCalled();
  });
  it("relleno agotado (3 fallos): lo dice, para ofrecer la descarga", async () => {
    db.digitalizacionGrabacion.findMany.mockResolvedValue([{ ...video, hlsKey: null, conversionError: "HLS:3:ffmpeg falló" }, { ...video, id: "g2", hlsKey: null, conversionError: "HLS:2:R2" }]);
    const v = await abrirEntregaPublica("ws1", TOKEN, AHORA);
    expect(v!.videos.map((x) => [x.vistaPrevia, x.vistaPreviaAgotada])).toEqual([[false, true], [false, false]]);
  });
  it("con saldo: no firma nada y da el enlace del pedido", async () => {
    saldo.saldoDelPedido.mockResolvedValue({ numero: "P-12", saldoMinor: 100000 });
    const v = await abrirEntregaPublica("ws1", TOKEN, AHORA);
    expect(v).toMatchObject({ habilitados: false, saldoMinor: 100000, urlPedido: "https://fotoffice.com/w/fp/pedido/PED" });
    expect(v!.videos[0]!.vistaPrevia).toBe(false);
    expect(almacen.urlDeVideo).not.toHaveBeenCalled();
  });
  it("pedido cancelado: no firma nada", async () => {
    db.fotofficePedido.findFirst.mockResolvedValue({ number: "P-12", status: "CANCELADO", client: null });
    const v = await abrirEntregaPublica("ws1", TOKEN, AHORA);
    expect(v).toMatchObject({ cancelado: true, habilitados: false, urlPedido: null });
    expect(almacen.urlDeVideo).not.toHaveBeenCalled();
  });
  it("vencida aunque no borrada: como borrada, sin firmar", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega({ videosVencenAt: new Date("2026-10-22T14:00:00Z") }));
    const v = await abrirEntregaPublica("ws1", TOKEN, AHORA);
    expect(v).toMatchObject({ habilitados: false, borradosAt: new Date("2026-10-22T14:00:00Z") });
    expect(v!.videos[0]!.vistaPrevia).toBe(false);
  });
});

describe("vistaDeEntregaPublica", () => {
  const g = { id: "g1", hlsKey: "digitalizacion/ws1/g1/hls", videoBorradoAt: null };
  beforeEach(() => db.digitalizacionGrabacion.findFirst.mockResolvedValue(g));

  it("pagado y vigente: la carpeta HLS y firmas de 4 h; no cuenta descargas", async () => {
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: true, hlsKey: "digitalizacion/ws1/g1/hls", segundos: 14400 });
    expect(db.digitalizacionGrabacion.findFirst.mock.calls[0][0].where).toMatchObject({ id: "g1", workspaceId: "ws1", conversionEstado: "LISTA", proyecto: { pedidoId: "p1", workspaceId: "ws1" } });
    expect(db.digitalizacionDescarga.create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("a minutos del vencimiento, las firmas duran lo que falta", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega({ videosVencenAt: new Date("2026-10-22T15:10:00Z") }));
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "g1", AHORA)).toMatchObject({ ok: true, segundos: 600 });
  });
  it("con saldo, cancelado, vencido o borrado: no deja mirar", async () => {
    saldo.saldoDelPedido.mockResolvedValue({ numero: "P-12", saldoMinor: 1 });
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "SALDO" });
    saldo.saldoDelPedido.mockResolvedValue({ numero: "P-12", saldoMinor: 0 });
    db.fotofficePedido.findFirst.mockResolvedValue({ number: "P-12", status: "CANCELADO", client: null });
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "CANCELADO" });
    db.fotofficePedido.findFirst.mockResolvedValue({ number: "P-12", status: "CONFIRMADO", client: null });
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega({ videosVencenAt: new Date("2026-10-22T14:00:00Z") }));
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "BORRADO" });
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...g, videoBorradoAt: new Date("2026-10-20T00:00:00Z") });
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "BORRADO" });
  });
  it("sin HLS todavía, o con una carpeta de otra grabación: PREPARANDO", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...g, hlsKey: null });
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "PREPARANDO" });
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...g, hlsKey: "digitalizacion/ws1/g2/hls" });
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "PREPARANDO" });
  });
  it("token desconocido, video de otro pedido o id raro: no existe", async () => {
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "../x", AHORA)).toEqual({ ok: false, motivo: "NO_EXISTE" });
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(null);
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "g9", AHORA)).toEqual({ ok: false, motivo: "NO_EXISTE" });
    db.digitalizacionEntrega.findFirst.mockResolvedValue(null);
    expect(await vistaDeEntregaPublica("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "NO_EXISTE" });
  });
});

describe("registrarDescarga", () => {
  const g = { id: "g1", titulo: "Boda", tipo: "VHS", cassetteNumero: 1, videoKey: "digitalizacion/ws1/g1/final.mp4", videoBorradoAt: null, descargasExtra: 0, proyecto: { pedido: { number: "P-12", status: "CONFIRMADO", client: null } } };
  beforeEach(() => db.digitalizacionGrabacion.findFirst.mockResolvedValue(g));

  it("cuenta dentro de una transacción con el pedido y la entrega bloqueados y redirige a la firma de descarga", async () => {
    db.digitalizacionDescarga.count.mockResolvedValue(2);
    expect(await registrarDescarga("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: true, url: "https://r2/descargar" });
    expect(plan.bloquearPedido).toHaveBeenCalledWith(db, "p1");
    expect(plan.bloquearPedido.mock.invocationCallOrder[0]!).toBeLessThan(saldo.saldoDelPedido.mock.invocationCallOrder[0]!);
    const sql = (db.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray])[0].join("?");
    expect(sql).toMatch(/FROM "DigitalizacionEntrega" WHERE id = \? FOR UPDATE/);
    expect(db.digitalizacionDescarga.create).toHaveBeenCalledWith({ data: { workspaceId: "ws1", entregaId: "e1", grabacionId: "g1" } });
    expect(almacen.urlDeVideo).toHaveBeenCalledWith(g.videoKey, "Pedido P-12 - Boda.mp4", "descargar", 24 * 3600);
  });
  it("otra descarga del mismo video en los últimos 2 minutos: firma de nuevo sin contar", async () => {
    db.digitalizacionDescarga.findFirst.mockResolvedValue({ id: "d1" });
    db.digitalizacionDescarga.count.mockResolvedValue(3);
    expect(await registrarDescarga("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: true, url: "https://r2/descargar" });
    expect(db.digitalizacionDescarga.create).not.toHaveBeenCalled();
    expect(db.digitalizacionDescarga.findFirst.mock.calls[0][0].where).toEqual({
      entregaId: "e1", grabacionId: "g1", createdAt: { gte: new Date("2026-10-22T14:58:00Z") },
    });
  });
  it("a una hora del vencimiento, la firma de descarga dura una hora", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega({ videosVencenAt: new Date("2026-10-22T16:00:00Z") }));
    db.digitalizacionDescarga.count.mockResolvedValue(0);
    await registrarDescarga("ws1", TOKEN, "g1", AHORA);
    expect(almacen.urlDeVideo.mock.calls[0]![3]).toBe(3600);
  });
  it("pedido cancelado: no registra", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ ...g, proyecto: { pedido: { number: "P-12", status: "CANCELADO", client: null } } });
    expect(await registrarDescarga("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "CANCELADO" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("sin cupo: no registra", async () => {
    db.digitalizacionDescarga.count.mockResolvedValue(3);
    expect(await registrarDescarga("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "SIN_CUPO" });
    expect(db.digitalizacionDescarga.create).not.toHaveBeenCalled();
  });
  it("con saldo: no registra ni firma", async () => {
    saldo.saldoDelPedido.mockResolvedValue({ numero: "P-12", saldoMinor: 1 });
    expect(await registrarDescarga("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "SALDO" });
    expect(db.digitalizacionDescarga.create).not.toHaveBeenCalled();
    expect(almacen.urlDeVideo).not.toHaveBeenCalled();
  });
  it("vencida: borrado", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega({ videosVencenAt: new Date("2026-10-01T00:00:00Z") }));
    expect(await registrarDescarga("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: false, motivo: "BORRADO" });
  });
  it("video de otro pedido o id raro: no existe", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(null);
    expect(await registrarDescarga("ws1", TOKEN, "g9", AHORA)).toEqual({ ok: false, motivo: "NO_EXISTE" });
    expect(db.digitalizacionGrabacion.findFirst.mock.calls[0][0].where).toMatchObject({ id: "g9", workspaceId: "ws1", proyecto: { pedidoId: "p1", workspaceId: "ws1" } });
    expect(await registrarDescarga("ws1", TOKEN, "../x", AHORA)).toEqual({ ok: false, motivo: "NO_EXISTE" });
  });
});

describe("cargos pendientes en la página", () => {
  it("muestra la extensión, la descarga extra y el envío pendientes con su enlace para pagar", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega({ envioEstado: "A_PAGAR", envioDireccion: "Av. Real 100", envioPrecioArs: "9000.00" }));
    cargos.cargosPendientes.mockResolvedValue(new Map([["e1", [
      { id: "c1", tipo: "EXTENSION", grabacionId: null, montoMinor: 1500000, cuotaId: "q1" },
      { id: "c2", tipo: "DESCARGA_EXTRA", grabacionId: "g1", montoMinor: 375000, cuotaId: "q2" },
      { id: "c3", tipo: "ENVIO", grabacionId: null, montoMinor: 900000, cuotaId: "q3" },
    ]]]));
    cargos.urlsParaPagar.mockResolvedValue(new Map([["q1", "u1"], ["q2", "u2"], ["q3", "u3"]]));
    const v = await abrirEntregaPublica("ws1", TOKEN, AHORA);
    expect(v!.extensionPendiente).toEqual({ montoMinor: 1500000, urlPagar: "u1" });
    expect(v!.videos[0]!.descargaPendiente).toEqual({ montoMinor: 375000, urlPagar: "u2" });
    expect(v!.envio).toEqual({ puedePedir: true, estado: "A_PAGAR", direccion: "Av. Real 100", precioMinor: 900000, urlPagar: "u3" });
  });
});

describe("abrirVistaPreviaDelEquipo («Ver como el cliente»)", () => {
  /** Nada de lo que puede escribir: ni descargas, ni transacciones, ni enlaces (del pedido o para pagar), ni firmas. */
  const sinEscribirNada = () => {
    expect(db.digitalizacionDescarga.create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(plan.bloquearPedido).not.toHaveBeenCalled();
    expect(enlaceDelPedidoDelSistema).not.toHaveBeenCalled();
    expect(cargos.urlsParaPagar).not.toHaveBeenCalled();
    expect(almacen.urlDeVideo).not.toHaveBeenCalled();
  };

  it("pedido sin entrega todavía: la arma sin crearla, sin fechas y con los botones que vería el cliente al enviarla hoy", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(null);
    db.digitalizacionGrabacion.findMany.mockResolvedValue([{ ...video, _count: { descargas: 0 } }]);
    const v = await abrirVistaPreviaDelEquipo("ws1", "p1", AHORA);
    expect(db.digitalizacionEntrega.findFirst.mock.calls[0][0].where).toEqual({ workspaceId: "ws1", pedidoId: "p1" });
    // Sin entrega no cuenta descargas de nadie.
    expect(db.digitalizacionGrabacion.findMany.mock.calls[0][0].select._count.select.descargas.where).toEqual({ entregaId: "" });
    expect(cargos.cargosPendientes).not.toHaveBeenCalled();
    expect(v).toMatchObject({ enviada: false, habilitados: true, videosVencenAt: null, cassettesVencenAt: null, borradosAt: null, puedeExtender: true, envio: { puedePedir: true } });
    expect(v!.videos).toEqual([{ id: "g1", titulo: "Cassette 2", duracionSeg: 3600, quedan: 4, total: 4, vistaPrevia: true, vistaPreviaAgotada: false, puedeComprar: true, descargaPendiente: null, verComoEquipo: true }]);
    sinEscribirNada();
  });

  it("entrega con fila pero sin enviar: no muestra los restos de fechas", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue({ ...entrega(), enviadoAt: null, envioEstado: null, envioDireccion: null, envioPrecioArs: null });
    const v = await abrirVistaPreviaDelEquipo("ws1", "p1", AHORA);
    expect(v).toMatchObject({ enviada: false, videosVencenAt: null, cassettesVencenAt: null });
    expect(cargos.cargosPendientes).toHaveBeenCalledWith("ws1", ["e1"]);
    sinEscribirNada();
  });

  it("enviada: las fechas reales, las descargas de esa entrega y los cargos sin enlace para pagar", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue({ ...entrega(), enviadoAt: new Date("2026-10-20T15:00:00Z"), envioEstado: "A_PAGAR", envioDireccion: "Av. Real 100", envioPrecioArs: "9000.00" });
    cargos.cargosPendientes.mockResolvedValue(new Map([["e1", [
      { id: "c1", tipo: "EXTENSION", grabacionId: null, montoMinor: 1500000, cuotaId: "q1" },
      { id: "c3", tipo: "ENVIO", grabacionId: null, montoMinor: 900000, cuotaId: "q3" },
    ]]]));
    const v = await abrirVistaPreviaDelEquipo("ws1", "p1", AHORA);
    expect(db.digitalizacionGrabacion.findMany.mock.calls[0][0].select._count.select.descargas.where).toEqual({ entregaId: "e1" });
    expect(v).toMatchObject({ enviada: true, videosVencenAt: new Date("2026-11-21T15:00:00Z"), extensionPendiente: { montoMinor: 1500000, urlPagar: null } });
    expect(v!.videos[0]).toMatchObject({ quedan: 2, total: 4 });
    expect(v!.envio).toMatchObject({ estado: "A_PAGAR", urlPagar: null });
    sinEscribirNada();
  });

  it("con saldo: el cliente no lo ve (y sin enlace del pedido), pero el equipo lo puede reproducir", async () => {
    saldo.saldoDelPedido.mockResolvedValue({ numero: "P-12", saldoMinor: 100000 });
    const v = await abrirVistaPreviaDelEquipo("ws1", "p1", AHORA);
    expect(v).toMatchObject({ habilitados: false, saldoMinor: 100000, urlPedido: null });
    expect(v!.videos[0]).toMatchObject({ vistaPrevia: false, verComoEquipo: true });
    sinEscribirNada();
  });

  it("sin versión HLS: el equipo tampoco la puede reproducir", async () => {
    db.digitalizacionGrabacion.findMany.mockResolvedValue([{ ...video, hlsKey: null }]);
    const v = await abrirVistaPreviaDelEquipo("ws1", "p1", AHORA);
    expect(v!.videos[0]).toMatchObject({ vistaPrevia: false, verComoEquipo: false });
  });

  it("pedido de otro negocio, inexistente o id raro: null", async () => {
    expect(await abrirVistaPreviaDelEquipo("ws1", "../p1", AHORA)).toBeNull();
    expect(await abrirVistaPreviaDelEquipo("ws1", 5, AHORA)).toBeNull();
    expect(db.digitalizacionEntrega.findFirst).not.toHaveBeenCalled();
    db.digitalizacionEntrega.findFirst.mockResolvedValue(null);
    db.fotofficePedido.findFirst.mockResolvedValue(null);
    expect(await abrirVistaPreviaDelEquipo("ws1", "p-ajeno", AHORA)).toBeNull();
    expect(db.fotofficePedido.findFirst.mock.calls[0][0].where).toEqual({ id: "p-ajeno", workspaceId: "ws1" });
    sinEscribirNada();
  });
});
