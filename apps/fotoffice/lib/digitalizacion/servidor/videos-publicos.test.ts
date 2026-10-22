import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const d = {
    digitalizacionEntrega: { findFirst: vi.fn() },
    digitalizacionGrabacion: { findMany: vi.fn(), findFirst: vi.fn() },
    digitalizacionDescarga: { count: vi.fn(), create: vi.fn() },
    fotofficePedido: { findFirst: vi.fn() },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(),
  };
  d.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(d));
  return d;
});
vi.mock("@repo/db", () => ({ prisma: db }));
const almacen = vi.hoisted(() => ({ urlDeVideo: vi.fn(async (_k: string, _n: string, modo: string) => `https://r2/${modo}`), SEGUNDOS_VER_PUBLICO: 10800 }));
vi.mock("./almacen", () => almacen);
const saldo = vi.hoisted(() => ({ saldoDelPedido: vi.fn() }));
vi.mock("@/lib/pedidos/candado-saldo", () => saldo);
vi.mock("@/lib/pedidos/enlace", () => ({ enlaceDelPedidoDelSistema: vi.fn(async () => ({ ok: true, url: "https://fotoffice.com/w/fp/pedido/PED" })) }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: vi.fn(async () => ({ workspaceId: "ws1", slug: "fp", customDomain: null, nombre: "Foto Positiva", logoUrl: "http://inseguro/logo.png", whatsapp: null, email: null })),
}));

import { abrirEntregaPublica, registrarDescarga } from "./videos-publicos";

const TOKEN = "a".repeat(43);
const AHORA = new Date("2026-10-22T15:00:00Z");
const entrega = (extra: Record<string, unknown> = {}) => ({
  id: "e1", pedidoId: "p1", videosVencenAt: new Date("2026-11-21T15:00:00Z"), cassettesVencenAt: new Date("2026-11-21T15:00:00Z"), videosBorradosAt: null, ...extra,
});
const video = { id: "g1", titulo: null, tipo: "VHS", cassetteNumero: 2, videoDuracionSeg: 3600, videoKey: "digitalizacion/ws1/g1/final.mp4", videoBorradoAt: null, descargasExtra: 1, _count: { descargas: 2 } };

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
  db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
  db.fotofficePedido.findFirst.mockResolvedValue({ number: "P-12", client: { firstName: "Ana", lastName: "Gómez", businessName: null } });
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
  it("pagado y vigente: firma para mirar (corto) y cuenta las descargas", async () => {
    const v = await abrirEntregaPublica("ws1", TOKEN, AHORA);
    expect(v).toMatchObject({ habilitados: true, pedidoNumero: "P-12", cliente: "Ana Gómez", borradosAt: null });
    expect(v!.organizacion.logoUrl).toBeNull();
    expect(v!.videos).toEqual([{ id: "g1", titulo: "Cassette 2", duracionSeg: 3600, quedan: 2, total: 4, urlVer: "https://r2/ver" }]);
    expect(almacen.urlDeVideo).toHaveBeenCalledWith("digitalizacion/ws1/g1/final.mp4", expect.stringMatching(/\.mp4$/), "ver", 10800);
  });
  it("con saldo: no firma nada y da el enlace del pedido", async () => {
    saldo.saldoDelPedido.mockResolvedValue({ numero: "P-12", saldoMinor: 100000 });
    const v = await abrirEntregaPublica("ws1", TOKEN, AHORA);
    expect(v).toMatchObject({ habilitados: false, saldoMinor: 100000, urlPedido: "https://fotoffice.com/w/fp/pedido/PED" });
    expect(v!.videos[0]!.urlVer).toBeNull();
    expect(almacen.urlDeVideo).not.toHaveBeenCalled();
  });
  it("vencida aunque no borrada: como borrada, sin firmar", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega({ videosVencenAt: new Date("2026-10-22T14:00:00Z") }));
    const v = await abrirEntregaPublica("ws1", TOKEN, AHORA);
    expect(v).toMatchObject({ habilitados: false, borradosAt: new Date("2026-10-22T14:00:00Z") });
    expect(almacen.urlDeVideo).not.toHaveBeenCalled();
  });
});

describe("registrarDescarga", () => {
  const g = { id: "g1", titulo: "Boda", tipo: "VHS", cassetteNumero: 1, videoKey: "digitalizacion/ws1/g1/final.mp4", videoBorradoAt: null, descargasExtra: 0, proyecto: { pedido: { number: "P-12", client: null } } };
  beforeEach(() => db.digitalizacionGrabacion.findFirst.mockResolvedValue(g));

  it("cuenta dentro de una transacción con la entrega bloqueada y redirige a la firma de descarga", async () => {
    db.digitalizacionDescarga.count.mockResolvedValue(2);
    expect(await registrarDescarga("ws1", TOKEN, "g1", AHORA)).toEqual({ ok: true, url: "https://r2/descargar" });
    const sql = (db.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray])[0].join("?");
    expect(sql).toMatch(/FROM "DigitalizacionEntrega" WHERE id = \? FOR UPDATE/);
    expect(db.digitalizacionDescarga.create).toHaveBeenCalledWith({ data: { workspaceId: "ws1", entregaId: "e1", grabacionId: "g1" } });
    expect(almacen.urlDeVideo).toHaveBeenCalledWith(g.videoKey, "Pedido P-12 - Boda.mp4", "descargar");
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
