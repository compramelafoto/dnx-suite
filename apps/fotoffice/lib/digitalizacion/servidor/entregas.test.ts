import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const d = {
    digitalizacionEntrega: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    digitalizacionAjustes: { findUnique: vi.fn() },
    digitalizacionGrabacion: { findMany: vi.fn(), updateMany: vi.fn() },
    fotofficePedido: { findFirst: vi.fn(), findMany: vi.fn() },
    fotofficeWorkspaceBranding: { findUnique: vi.fn() },
    fotofficeProyectoNota: { createMany: vi.fn(), findMany: vi.fn(async (): Promise<unknown[]> => []) },
    $executeRaw: vi.fn(async () => 0),
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(),
  };
  d.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(d));
  return d;
});
vi.mock("@repo/db", () => ({ prisma: db }));
const almacen = vi.hoisted(() => ({ borrarVideoFinal: vi.fn() }));
vi.mock("./almacen", () => almacen);
const cargos = vi.hoisted(() => ({
  aplicarCargosPagados: vi.fn(async () => ({ revisados: 0, aplicados: 0, anulados: 0, fallidos: 0 })),
  anularCargosSinSentido: vi.fn(async () => 0),
  cargosPendientes: vi.fn(async () => new Map()),
  cargosARevisar: vi.fn(async () => new Map()),
}));
vi.mock("./cargos", () => cargos);
const comision = vi.hoisted(() => ({
  devengarComisionesDelPedido: vi.fn(async () => 0),
  conciliarComisiones: vi.fn(async () => ({ devengadas: 0, revertidas: 0 })),
}));
vi.mock("./comision", () => comision);
const saldo = vi.hoisted(() => {
  const saldoDelPedido = vi.fn();
  // El correo usa el saldo sin extras opcionales: acá, el mismo mock.
  return { saldoDelPedido, saldoSinExtrasOpcionales: (...a: unknown[]) => saldoDelPedido(...a) };
});
vi.mock("@/lib/pedidos/candado-saldo", () => saldo);
vi.mock("@/lib/pedidos/enlace", () => ({
  enlaceDelPedidoDelSistema: vi.fn(async () => ({ ok: true, url: "https://fotoffice.com/w/fp/pedido/PED" })),
  MENSAJES_ENLACE: { sinClave: "sin clave", sinSitio: "sin sitio" },
}));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: vi.fn(async () => ({ workspaceId: "ws1", slug: "fp", customDomain: null, nombre: "Foto Positiva", logoUrl: null, whatsapp: null, email: null })),
}));
vi.mock("@/lib/communications/load-workspace-sender", () => ({ loadWorkspaceSender: vi.fn(async () => null) }));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: vi.fn() }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: vi.fn(async () => true) }));
vi.mock("@/lib/plantillas/contexto", () => ({ correoValido: (v: string) => /@/.test(v ?? "") }));

import type { OutboundEmail, SendOutcome } from "@/lib/communications/send-email";
import { hashDeToken } from "@/lib/presupuestos/enlace";
import { tokenDeEntrega } from "../token-entrega";
import { asegurarEntrega, enviarEntrega, enviarEntregasAutomaticas, MENSAJES_ENTREGA, recordatoriosYVencimientos, resumenDeEntregas } from "./entregas";

const AHORA = new Date("2026-10-22T15:00:00Z");
type Enviar = (m: OutboundEmail) => Promise<SendOutcome>;
const enviador = (r: SendOutcome) => vi.fn<Enviar>(async () => r);
const deps = (enviar = enviador({ status: "SENT", providerId: "x" })) => ({ ahora: () => AHORA, clave: "clave", appOrigin: "https://fotoffice.com", enviar });

const entrega = (extra: Record<string, unknown> = {}) => ({
  id: "e1", workspaceId: "ws1", pedidoId: "p1", envioAutomatico: true, accessTokenHash: null, enviadoAt: null,
  videosVencenAt: null, cassettesVencenAt: null, recordatorios: [], videosBorradosAt: null, ...extra,
});
const lista = { id: "g1", proyectoId: "t1", estado: "COMPLETA", conversionEstado: "LISTA", titulo: "Boda", tipo: "VHS", cassetteNumero: 1, videoDuracionSeg: 3600, videoKey: "digitalizacion/ws1/g1/final.mp4", hlsKey: null, videoBorradoAt: null, descargasExtra: 0, sinImagen: false, terminadaAt: new Date("2026-10-20T10:00:00Z"), convertidaAt: new Date("2026-10-20T12:00:00Z") };

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
  for (const m of [db.digitalizacionGrabacion.findMany, db.digitalizacionEntrega.findMany, db.digitalizacionEntrega.findUnique, db.fotofficePedido.findMany]) m.mockReset();
  db.digitalizacionEntrega.findMany.mockResolvedValue([]);
  db.fotofficePedido.findMany.mockResolvedValue([]);
  db.fotofficePedido.findFirst.mockResolvedValue({ id: "p1", number: "P-12", status: "CONFIRMADO", client: { firstName: "Ana", businessName: null, email: "ana@x.com" } });
  db.digitalizacionGrabacion.findMany.mockResolvedValue([lista]);
  db.digitalizacionEntrega.updateMany.mockResolvedValue({ count: 1 });
  db.fotofficeWorkspaceBranding.findUnique.mockResolvedValue({ whatsapp: null, phone: null });
  saldo.saldoDelPedido.mockResolvedValue({ numero: "P-12", saldoMinor: 0 });
});

describe("asegurarEntrega", () => {
  it("la crea con el envío automático de los ajustes", async () => {
    db.digitalizacionEntrega.findUnique.mockResolvedValue(null);
    db.digitalizacionAjustes.findUnique.mockResolvedValue({ envioAutomatico: false });
    db.digitalizacionEntrega.create.mockResolvedValue(entrega({ envioAutomatico: false }));
    const r = await asegurarEntrega("ws1", "p1");
    expect(db.digitalizacionEntrega.create.mock.calls[0][0].data).toEqual({ workspaceId: "ws1", pedidoId: "p1", envioAutomatico: false });
    expect(r?.preparacion).toBe("LISTA");
    // F1: al nacer la entrega devenga la comisión de los cobros que el pedido ya tenía (la seña).
    expect(comision.devengarComisionesDelPedido).toHaveBeenCalledWith("ws1", "p1");
  });
  it("si ya existe no la vuelve a crear; de otro negocio no la da", async () => {
    db.digitalizacionEntrega.findUnique.mockResolvedValue(entrega());
    expect(await asegurarEntrega("ws1", "p1")).toMatchObject({ entrega: { id: "e1" } });
    expect(await asegurarEntrega("otro", "p1")).toBeNull();
    expect(db.digitalizacionEntrega.create).not.toHaveBeenCalled();
    expect(comision.devengarComisionesDelPedido).not.toHaveBeenCalled();
  });
  it("dos a la vez: la segunda usa la que creó la primera", async () => {
    db.digitalizacionEntrega.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(entrega());
    db.digitalizacionAjustes.findUnique.mockResolvedValue(null);
    db.digitalizacionEntrega.create.mockRejectedValue(Object.assign(new Error("único"), { code: "P2002" }));
    expect(await asegurarEntrega("ws1", "p1")).toMatchObject({ entrega: { id: "e1" } });
  });
  it("pedido de otro negocio: null sin crear", async () => {
    db.digitalizacionEntrega.findUnique.mockResolvedValue(null);
    db.fotofficePedido.findFirst.mockResolvedValue(null);
    expect(await asegurarEntrega("ws1", "p1")).toBeNull();
    expect(db.digitalizacionEntrega.create).not.toHaveBeenCalled();
  });
});

describe("enviarEntrega", () => {
  it("primera vez: token, enviadoAt, vencimientos a 30 días, recordatorios vacíos y el correo", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
    const d = deps();
    const r = await enviarEntrega("ws1", "e1", "CORREO", d);
    expect(r).toMatchObject({ ok: true, correo: "ENVIADO" });
    const token = tokenDeEntrega("e1", "clave", 0);
    expect(r.ok && r.url).toBe(`https://fotoffice.com/w/fp/videos/${token}`);
    const escritura = db.digitalizacionEntrega.updateMany.mock.calls[0][0];
    expect(escritura.where).toEqual({ id: "e1", workspaceId: "ws1", enviadoAt: null });
    expect(escritura.data).toEqual({
      accessTokenHash: hashDeToken(token), enviadoAt: AHORA, videosVencenAt: new Date("2026-11-22T02:59:59.999Z"), cassettesVencenAt: new Date("2026-11-22T02:59:59.999Z"), recordatorios: [],
    });
    const correo = d.enviar.mock.calls[0]![0];
    expect(correo.idempotencyKey).toBe("fotoffice-videos:e1:g0:listos");
    expect(correo.text).toContain("disponibles hasta el 21/11/2026");
    expect(correo.to).toBe("ana@x.com");
    expect(correo.text).toContain(token);
    expect(db.fotofficeProyectoNota.createMany).toHaveBeenCalled();
  });
  it("con saldo, el correo lleva el saldo y el enlace del pedido", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
    saldo.saldoDelPedido.mockResolvedValue({ numero: "P-12", saldoMinor: 500000 });
    const d = deps();
    await enviarEntrega("ws1", "e1", "CORREO", d);
    expect(d.enviar.mock.calls[0]![0].text).toContain("5.000 pesos");
    expect(d.enviar.mock.calls[0]![0].text).toContain("https://fotoffice.com/w/fp/pedido/PED");
  });
  it("no lista: no escribe", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
    db.digitalizacionGrabacion.findMany.mockResolvedValue([lista, { ...lista, id: "g2", conversionEstado: "PROCESANDO" }]);
    expect(await enviarEntrega("ws1", "e1", "CORREO", deps())).toEqual({ ok: false, error: MENSAJES_ENTREGA.noLista });
    expect(db.digitalizacionEntrega.updateMany).not.toHaveBeenCalled();
  });
  it("sin correo del cliente: avisa y no escribe; con ENLACE la da por enviada sin correo", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
    db.fotofficePedido.findFirst.mockResolvedValue({ number: "P-12", client: { firstName: "Ana", businessName: null, email: null } });
    const d = deps();
    expect(await enviarEntrega("ws1", "e1", "CORREO", d)).toEqual({ ok: false, error: MENSAJES_ENTREGA.sinEmail });
    expect(db.digitalizacionEntrega.updateMany).not.toHaveBeenCalled();
    expect(await enviarEntrega("ws1", "e1", "ENLACE", d)).toMatchObject({ ok: true, correo: "NO_PEDIDO" });
    expect(db.digitalizacionEntrega.updateMany.mock.calls[0][0].data.enviadoAt).toEqual(AHORA);
    expect(d.enviar).not.toHaveBeenCalled();
  });
  it("reenviar: no toca los vencimientos y pasa a la generación siguiente", async () => {
    const previo = hashDeToken(tokenDeEntrega("e1", "clave", 0));
    db.digitalizacionEntrega.findFirst.mockResolvedValue(
      entrega({ accessTokenHash: previo, enviadoAt: new Date("2026-10-10T00:00:00Z"), videosVencenAt: new Date("2026-11-09T00:00:00Z"), cassettesVencenAt: new Date("2026-11-09T00:00:00Z"), recordatorios: [10] }),
    );
    const d = deps();
    const r = await enviarEntrega("ws1", "e1", "CORREO", d);
    expect(r).toMatchObject({ ok: true });
    const escritura = db.digitalizacionEntrega.updateMany.mock.calls[0][0];
    expect(escritura.where).toEqual({ id: "e1", workspaceId: "ws1", accessTokenHash: previo, videosBorradosAt: null });
    expect(escritura.data).toEqual({ accessTokenHash: hashDeToken(tokenDeEntrega("e1", "clave", 1)) });
    expect(d.enviar.mock.calls[0]![0].text).toContain("disponibles hasta el 08/11/2026");
  });
  it("si el correo no sale, vuelve atrás", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await enviarEntrega("ws1", "e1", "CORREO", deps(enviador({ status: "PROVIDER_REJECTED", detail: "x" })));
    expect(r).toEqual({ ok: false, error: MENSAJES_ENTREGA.correoNoSalio });
    const vuelta = db.digitalizacionEntrega.updateMany.mock.calls[1][0];
    expect(vuelta.where.accessTokenHash).toBe(hashDeToken(tokenDeEntrega("e1", "clave", 0)));
    expect(vuelta.data).toMatchObject({ accessTokenHash: null, enviadoAt: null, videosVencenAt: null });
  });
  it("ya enviada por otro en paralelo", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
    db.digitalizacionEntrega.updateMany.mockResolvedValue({ count: 0 });
    const d = deps();
    expect(await enviarEntrega("ws1", "e1", "CORREO", d)).toEqual({ ok: false, error: MENSAJES_ENTREGA.yaEnviada });
    expect(d.enviar).not.toHaveBeenCalled();
  });
  it("pedido cancelado: error claro, sin escribir", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
    db.fotofficePedido.findFirst.mockResolvedValue({ number: "P-12", status: "CANCELADO", client: { firstName: "Ana", businessName: null, email: "ana@x.com" } });
    expect(await enviarEntrega("ws1", "e1", "CORREO", deps())).toEqual({ ok: false, error: MENSAJES_ENTREGA.cancelado });
    expect(db.digitalizacionEntrega.updateMany).not.toHaveBeenCalled();
  });
  it("vencida: no se reenvía", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega({ enviadoAt: new Date("2026-09-01T00:00:00Z"), videosVencenAt: new Date("2026-10-01T00:00:00Z") }));
    expect(await enviarEntrega("ws1", "e1", "CORREO", deps())).toEqual({ ok: false, error: MENSAJES_ENTREGA.borrada });
  });
});

describe("enviarEntregasAutomaticas", () => {
  const p = (id: string) => ({ id, workspaceId: "ws1" });
  it("consulta sin cancelados, de más nuevo a más viejo, y sólo entregas automáticas con correo", async () => {
    await enviarEntregasAutomaticas(deps());
    const sinEntrega = db.fotofficePedido.findMany.mock.calls[0][0];
    expect(sinEntrega.where.status).toEqual({ not: "CANCELADO" });
    expect(sinEntrega.orderBy).toEqual([{ createdAt: "desc" }]);
    const sinEnviar = db.digitalizacionEntrega.findMany.mock.calls[0][0];
    expect(sinEnviar.where).toMatchObject({ enviadoAt: null, envioAutomatico: true, pedido: { status: { not: "CANCELADO" }, client: { email: { contains: "@" } } } });
    expect(sinEnviar.orderBy).toEqual([{ createdAt: "desc" }]);
  });
  it("manda la lista pasado el margen; espera si hubo actividad hace menos de 12 h; salta las manuales", async () => {
    db.fotofficePedido.findMany.mockResolvedValue([p("p1"), p("p2"), p("p3")]);
    db.digitalizacionEntrega.findUnique.mockImplementation(async ({ where }: { where: { pedidoId: string } }) =>
      where.pedidoId === "p1" ? entrega() : where.pedidoId === "p2" ? entrega({ id: "e2", pedidoId: "p2" }) : entrega({ id: "e3", pedidoId: "p3", envioAutomatico: false }),
    );
    db.digitalizacionGrabacion.findMany.mockImplementation(async ({ where }: { where: { proyecto: { pedidoId: string } } }) =>
      where.proyecto.pedidoId === "p2" ? [{ ...lista, convertidaAt: new Date("2026-10-22T10:00:00Z") }] : [lista],
    );
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
    const d = deps();
    const r = await enviarEntregasAutomaticas(d);
    expect(r).toMatchObject({ revisadas: 3, enviadas: 1, esperando: 1, manuales: 1 });
    expect(d.enviar).toHaveBeenCalledTimes(1);
  });
  it("los clientes sin correo no gastan el tope", async () => {
    db.fotofficePedido.findMany.mockResolvedValue([p("p1"), p("p2")]);
    db.digitalizacionEntrega.findUnique.mockImplementation(async ({ where }: { where: { pedidoId: string } }) => entrega({ id: where.pedidoId === "p1" ? "e1" : "e2", pedidoId: where.pedidoId }));
    db.digitalizacionGrabacion.findMany.mockResolvedValue([lista]);
    db.digitalizacionEntrega.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => entrega({ id: where.id, pedidoId: where.id === "e1" ? "p1" : "p2" }));
    db.fotofficePedido.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      number: "P", status: "CONFIRMADO", client: { firstName: "A", businessName: null, email: where.id === "p1" ? null : "b@x.com" },
    }));
    const d = deps();
    const r = await enviarEntregasAutomaticas({ ...d, tope: 1 });
    expect(r).toMatchObject({ sinEmail: 1, enviadas: 1 });
  });
  it("video convertido después del envío: corre el vencimiento, vacía recordatorios y avisa con el mismo enlace", async () => {
    const hash = hashDeToken(tokenDeEntrega("e1", "clave", 1));
    const vence = new Date("2026-11-10T02:59:59.999Z");
    db.digitalizacionEntrega.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      entrega({ accessTokenHash: hash, enviadoAt: new Date("2026-10-10T12:00:00Z"), videosVencenAt: vence, cassettesVencenAt: vence, recordatorios: [10] }),
    ]);
    db.digitalizacionGrabacion.findMany.mockResolvedValue([lista, { ...lista, id: "g2", titulo: "Cumple", convertidaAt: new Date("2026-10-21T12:00:00Z") }]);
    const d = deps();
    const r = await enviarEntregasAutomaticas(d);
    const nuevo = new Date("2026-11-21T02:59:59.999Z");
    expect(db.digitalizacionEntrega.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", workspaceId: "ws1", videosVencenAt: vence, videosBorradosAt: null },
      data: { videosVencenAt: nuevo, cassettesVencenAt: nuevo, recordatorios: [] },
    });
    const correo = d.enviar.mock.calls[0]![0];
    expect(correo.subject).toContain("Agregamos un video");
    expect(correo.text).toContain(tokenDeEntrega("e1", "clave", 1));
    expect(correo.idempotencyKey).toBe(`fotoffice-videos:e1:v${nuevo.getTime()}:agregado`);
    expect(r).toMatchObject({ extendidas: 1, avisosAgregado: 1 });
  });
  it("ya extendida: no hace nada", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      entrega({ enviadoAt: new Date("2026-10-10T12:00:00Z"), videosVencenAt: new Date("2026-11-21T02:59:59.999Z") }),
    ]);
    db.digitalizacionGrabacion.findMany.mockResolvedValue([{ ...lista, convertidaAt: new Date("2026-10-21T12:00:00Z") }]);
    const d = deps();
    await enviarEntregasAutomaticas(d);
    expect(db.digitalizacionEntrega.updateMany).not.toHaveBeenCalled();
    expect(d.enviar).not.toHaveBeenCalled();
  });
});

describe("recordatoriosYVencimientos", () => {
  const enviada = (vence: string, extra: Record<string, unknown> = {}) =>
    entrega({ accessTokenHash: hashDeToken(tokenDeEntrega("e1", "clave", 2)), enviadoAt: new Date("2026-10-01T00:00:00Z"), videosVencenAt: new Date(vence), ...extra });

  const releida = (vence: string, extra: Record<string, unknown> = {}) =>
    db.digitalizacionEntrega.findFirst.mockResolvedValue({ videosVencenAt: new Date(vence), videosBorradosAt: null, ...extra });

  it("vencida: con los candados vuelve a leer, marca la entrega y borra de R2", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-22T14:00:00Z")]);
    releida("2026-10-22T14:00:00Z");
    const r = await recordatoriosYVencimientos(deps());
    expect(almacen.borrarVideoFinal).toHaveBeenCalledWith("digitalizacion/ws1/g1/", "digitalizacion/ws1/g1/final.mp4");
    expect(db.digitalizacionGrabacion.updateMany).toHaveBeenCalledWith({ where: { id: "g1", workspaceId: "ws1" }, data: { videoBorradoAt: AHORA } });
    expect(db.digitalizacionEntrega.updateMany).toHaveBeenCalledWith({ where: { id: "e1", workspaceId: "ws1", videosBorradosAt: null }, data: { videosBorradosAt: AHORA } });
    expect(db.$executeRaw).toHaveBeenCalled();
    expect(db.$executeRaw.mock.invocationCallOrder[0]!).toBeLessThan(db.$queryRaw.mock.invocationCallOrder[0]!);
    expect(db.$queryRaw.mock.invocationCallOrder[0]!).toBeLessThan(almacen.borrarVideoFinal.mock.invocationCallOrder[0]!);
    expect(r).toMatchObject({ borradas: 1 });
  });
  it("si alguien la extendió en el medio, no borra nada", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-22T14:00:00Z")]);
    releida("2026-11-21T14:00:00Z");
    const r = await recordatoriosYVencimientos(deps());
    expect(almacen.borrarVideoFinal).not.toHaveBeenCalled();
    expect(db.digitalizacionEntrega.updateMany).not.toHaveBeenCalled();
    expect(r).toMatchObject({ borradas: 0, borradoFallido: 0 });
    releida("2026-10-22T14:00:00Z", { videosBorradosAt: AHORA });
    await recordatoriosYVencimientos(deps());
    expect(almacen.borrarVideoFinal).not.toHaveBeenCalled();
  });
  it("clave con forma inesperada: no la toca, la marca igual y avisa en el log", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-22T14:00:00Z")]);
    releida("2026-10-22T14:00:00Z");
    db.digitalizacionGrabacion.findMany.mockResolvedValue([{ ...lista, videoKey: "otra/cosa.mp4", hlsKey: "digitalizacion/ws1/g1/hls" }]);
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await recordatoriosYVencimientos(deps());
    expect(almacen.borrarVideoFinal).toHaveBeenCalledWith("digitalizacion/ws1/g1/", null);
    expect(db.digitalizacionGrabacion.updateMany).toHaveBeenCalled();
    expect(aviso).toHaveBeenCalled();
    expect(r).toMatchObject({ borradas: 1 });
  });
  it("sin videoKey ni hlsKey igual limpia las carpetas hls* (un relleno pudo dejar restos)", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-22T14:00:00Z")]);
    releida("2026-10-22T14:00:00Z");
    db.digitalizacionGrabacion.findMany.mockResolvedValue([{ ...lista, videoKey: null, hlsKey: null }]);
    await recordatoriosYVencimientos(deps());
    expect(almacen.borrarVideoFinal).toHaveBeenCalledWith("digitalizacion/ws1/g1/", null);
  });
  it("si R2 falla, desmarca la entrega (se reintenta mañana)", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-22T14:00:00Z")]);
    releida("2026-10-22T14:00:00Z");
    almacen.borrarVideoFinal.mockRejectedValue(new Error("R2 caído"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await recordatoriosYVencimientos(deps());
    expect(db.digitalizacionGrabacion.updateMany).not.toHaveBeenCalled();
    expect(db.digitalizacionEntrega.updateMany.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: "e1", workspaceId: "ws1", videosBorradosAt: null }, data: { videosBorradosAt: AHORA } },
      { where: { id: "e1", workspaceId: "ws1", videosBorradosAt: AHORA }, data: { videosBorradosAt: null } },
    ]);
    expect(r).toMatchObject({ borradas: 0, borradoFallido: 1 });
  });
  it("faltan 4 días: reserva el 5, manda el recordatorio con el enlace vigente", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-26T18:00:00Z")]);
    const d = deps();
    const r = await recordatoriosYVencimientos(d);
    expect(db.digitalizacionEntrega.updateMany.mock.calls[0][0]).toEqual({
      where: { id: "e1", workspaceId: "ws1", videosBorradosAt: null, NOT: { recordatorios: { has: 5 } } },
      data: { recordatorios: { push: 5 } },
    });
    expect(d.enviar.mock.calls[0]![0].subject).toContain("Tus videos se borran el 26/10");
    expect(d.enviar.mock.calls[0]![0].text).toContain(tokenDeEntrega("e1", "clave", 2));
    // Faltan 4 días de verdad (22/10 → 26/10 de Argentina), aunque el aviso sea el de 5.
    expect(d.enviar.mock.calls[0]![0].text).toContain("se borran en 4 días");
    expect(r).toMatchObject({ recordatorios: 1 });
  });
  it("si el recordatorio no sale, libera el umbral", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-27T18:00:00Z", { recordatorios: [10] })]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await recordatoriosYVencimientos(deps(enviador({ status: "INTERNAL_ERROR", detail: "x" })));
    expect(db.digitalizacionEntrega.updateMany.mock.calls[1][0]).toEqual({ where: { id: "e1", workspaceId: "ws1" }, data: { recordatorios: { set: [10] } } });
  });
  it("sin correo: no es una falla", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-27T18:00:00Z")]);
    db.fotofficePedido.findFirst.mockResolvedValue({ number: "P-12", status: "CONFIRMADO", client: { firstName: "Ana", businessName: null, email: null } });
    expect(await recordatoriosYVencimientos(deps())).toMatchObject({ sinEmail: 1, recordatoriosFallidos: 0 });
  });
  it("faltan más de 10 días: nada", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-11-20T18:00:00Z")]);
    const d = deps();
    await recordatoriosYVencimientos(d);
    expect(d.enviar).not.toHaveBeenCalled();
    expect(db.digitalizacionEntrega.updateMany).not.toHaveBeenCalled();
  });
});

describe("resumenDeEntregas", () => {
  it("elige los pedidos y trae TODAS sus grabaciones (no un tope de grabaciones del negocio)", async () => {
    db.fotofficePedido.findMany.mockResolvedValue([{ id: "p1", number: "P-12", status: "CONFIRMADO", client: { firstName: "Ana", lastName: null, businessName: null, email: "ana@x.com" } }]);
    db.digitalizacionGrabacion.findMany.mockResolvedValue([
      { ...lista, proyecto: { pedidoId: "p1" } },
      { ...lista, conversionEstado: null, sinImagen: true, proyecto: { pedidoId: "p1" } },
    ]);
    const r = await resumenDeEntregas("ws1");
    const consulta = db.digitalizacionGrabacion.findMany.mock.calls[0][0];
    expect(consulta.where).toEqual({ workspaceId: "ws1", proyecto: { workspaceId: "ws1", pedidoId: { in: ["p1"] } } });
    expect(consulta.take).toBeUndefined();
    expect(r).toEqual([expect.objectContaining({ pedidoId: "p1", preparacion: "LISTA", videos: 1, tieneEmail: true, cancelado: false, enviaSoloDesde: new Date("2026-10-21T00:00:00Z") })]);
  });
});

describe("resumenDeEntregas: filtro y registro del envío", () => {
  it("con pedidoIds busca sólo esos y lee de las notas a quién salió el correo", async () => {
    db.fotofficePedido.findMany.mockResolvedValue([{ id: "p1", number: "P-12", status: "CONFIRMADO", client: { firstName: "Ana", lastName: null, businessName: null, email: " ana@x.com " } }]);
    db.digitalizacionGrabacion.findMany.mockResolvedValue([{ ...lista, proyecto: { pedidoId: "p1" } }]);
    db.fotofficeProyectoNota.findMany.mockResolvedValueOnce([
      { body: "Correo «Tus videos están listos» enviado a ana@x.com.", createdAt: new Date("2026-10-22T13:00:00Z"), proyecto: { pedidoId: "p1" } },
    ]);
    const [r] = await resumenDeEntregas("ws1", { pedidoIds: ["p1"] });
    expect(db.fotofficePedido.findMany.mock.calls[0][0].where.id).toEqual({ in: ["p1"] });
    expect(r!.email).toBe("ana@x.com");
    expect(r!.envioRegistrado.primero).toEqual({ modo: "CORREO", email: "ana@x.com", at: new Date("2026-10-22T13:00:00Z") });
  });

  it("con una lista vacía no consulta nada", async () => {
    expect(await resumenDeEntregas("ws1", { pedidoIds: [] })).toEqual([]);
    expect(db.fotofficePedido.findMany).not.toHaveBeenCalled();
  });
});

describe("resumenDeEntregas: envío y cargos", () => {
  it("trae el envío de los cassettes y los cargos sin pagar de cada entrega", async () => {
    db.fotofficePedido.findMany.mockResolvedValue([{ id: "p1", number: "P-12", status: "CONFIRMADO", client: { firstName: "Ana", lastName: null, businessName: null, email: "ana@x.com" } }]);
    db.digitalizacionGrabacion.findMany.mockResolvedValue([{ ...lista, proyecto: { pedidoId: "p1" } }]);
    db.digitalizacionEntrega.findMany.mockResolvedValue([entrega({ envioEstado: "A_PAGAR", envioDireccion: "Av. Real 100", envioKm: 22.4, envioPrecioArs: "9000.00" })]);
    const pendiente = { id: "c1", tipo: "ENVIO", grabacionId: null, montoMinor: 900000, cuotaId: "q1" };
    cargos.cargosPendientes.mockResolvedValueOnce(new Map([["e1", [pendiente]]]));
    const [r] = await resumenDeEntregas("ws1");
    expect(r!.envio).toEqual({ estado: "A_PAGAR", direccion: "Av. Real 100", km: 22.4, precioMinor: 900000 });
    expect(r!.cargosPendientes).toEqual([pendiente]);
    expect(r!.cargosARevisar).toEqual([]);
  });
});

describe("conciliación de cargos en los crons", () => {
  it("las dos corridas aplican los cargos pagos y la diaria limpia los que perdieron sentido", async () => {
    cargos.aplicarCargosPagados.mockResolvedValueOnce({ revisados: 2, aplicados: 1, anulados: 0, fallidos: 0 });
    cargos.anularCargosSinSentido.mockResolvedValueOnce(3);
    const r = await recordatoriosYVencimientos(deps());
    expect(r).toMatchObject({ cargosAplicados: 1, cargosAnulados: 3 });
    cargos.aplicarCargosPagados.mockResolvedValueOnce({ revisados: 1, aplicados: 1, anulados: 0, fallidos: 0 });
    expect(await enviarEntregasAutomaticas(deps())).toMatchObject({ cargosAplicados: 1 });
  });
  it("la corrida de cada 15 minutos concilia la comisión de plataforma (F1)", async () => {
    comision.conciliarComisiones.mockResolvedValueOnce({ devengadas: 2, revertidas: 1 });
    expect(await enviarEntregasAutomaticas(deps())).toMatchObject({ comisionesDevengadas: 2, comisionesRevertidas: 1 });
  });
});
