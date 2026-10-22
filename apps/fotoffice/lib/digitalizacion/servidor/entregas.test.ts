import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  digitalizacionEntrega: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  digitalizacionAjustes: { findUnique: vi.fn() },
  digitalizacionGrabacion: { findMany: vi.fn(), updateMany: vi.fn() },
  fotofficePedido: { findFirst: vi.fn(), findMany: vi.fn() },
  fotofficeWorkspaceBranding: { findUnique: vi.fn() },
  fotofficeProyectoNota: { createMany: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));
const almacen = vi.hoisted(() => ({ borrarVideoFinal: vi.fn() }));
vi.mock("./almacen", () => almacen);
const saldo = vi.hoisted(() => ({ saldoDelPedido: vi.fn() }));
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
import { asegurarEntrega, enviarEntrega, enviarEntregasAutomaticas, MENSAJES_ENTREGA, recordatoriosYVencimientos } from "./entregas";

const AHORA = new Date("2026-10-22T15:00:00Z");
type Enviar = (m: OutboundEmail) => Promise<SendOutcome>;
const enviador = (r: SendOutcome) => vi.fn<Enviar>(async () => r);
const deps = (enviar = enviador({ status: "SENT", providerId: "x" })) => ({ ahora: () => AHORA, clave: "clave", appOrigin: "https://fotoffice.com", enviar });

const entrega = (extra: Record<string, unknown> = {}) => ({
  id: "e1", workspaceId: "ws1", pedidoId: "p1", envioAutomatico: true, accessTokenHash: null, enviadoAt: null,
  videosVencenAt: null, cassettesVencenAt: null, recordatorios: [], videosBorradosAt: null, ...extra,
});
const lista = { id: "g1", proyectoId: "t1", estado: "COMPLETA", conversionEstado: "LISTA", titulo: "Boda", tipo: "VHS", cassetteNumero: 1, videoDuracionSeg: 3600, videoKey: "digitalizacion/ws1/g1/final.mp4", hlsKey: null, videoBorradoAt: null, descargasExtra: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  db.fotofficePedido.findFirst.mockResolvedValue({ id: "p1", number: "P-12", client: { firstName: "Ana", businessName: null, email: "ana@x.com" } });
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
  });
  it("si ya existe no la vuelve a crear; de otro negocio no la da", async () => {
    db.digitalizacionEntrega.findUnique.mockResolvedValue(entrega());
    expect(await asegurarEntrega("ws1", "p1")).toMatchObject({ entrega: { id: "e1" } });
    expect(await asegurarEntrega("otro", "p1")).toBeNull();
    expect(db.digitalizacionEntrega.create).not.toHaveBeenCalled();
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
      accessTokenHash: hashDeToken(token), enviadoAt: AHORA, videosVencenAt: new Date("2026-11-21T15:00:00Z"), cassettesVencenAt: new Date("2026-11-21T15:00:00Z"), recordatorios: [],
    });
    const correo = d.enviar.mock.calls[0]![0];
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
  it("vencida: no se reenvía", async () => {
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega({ enviadoAt: new Date("2026-09-01T00:00:00Z"), videosVencenAt: new Date("2026-10-01T00:00:00Z") }));
    expect(await enviarEntrega("ws1", "e1", "CORREO", deps())).toEqual({ ok: false, error: MENSAJES_ENTREGA.borrada });
  });
});

describe("enviarEntregasAutomaticas", () => {
  it("manda sólo las automáticas y listas", async () => {
    db.digitalizacionGrabacion.findMany
      .mockResolvedValueOnce([{ workspaceId: "ws1", proyecto: { pedidoId: "p1" } }, { workspaceId: "ws1", proyecto: { pedidoId: "p2" } }])
      .mockResolvedValue([lista]);
    db.digitalizacionEntrega.findUnique.mockImplementation(async ({ where }: { where: { pedidoId: string } }) =>
      where.pedidoId === "p1" ? entrega() : entrega({ id: "e2", pedidoId: "p2", envioAutomatico: false }),
    );
    db.digitalizacionEntrega.findFirst.mockResolvedValue(entrega());
    const d = deps();
    const r = await enviarEntregasAutomaticas(d);
    expect(r).toMatchObject({ revisadas: 2, enviadas: 1, manuales: 1 });
    expect(d.enviar).toHaveBeenCalledTimes(1);
  });
});

describe("recordatoriosYVencimientos", () => {
  const enviada = (vence: string, extra: Record<string, unknown> = {}) =>
    entrega({ accessTokenHash: hashDeToken(tokenDeEntrega("e1", "clave", 2)), enviadoAt: new Date("2026-10-01T00:00:00Z"), videosVencenAt: new Date(vence), ...extra });

  it("vencida: borra de R2 y marca grabaciones y entrega", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-22T14:00:00Z")]);
    const r = await recordatoriosYVencimientos(deps());
    expect(almacen.borrarVideoFinal).toHaveBeenCalledWith("digitalizacion/ws1/g1/", "digitalizacion/ws1/g1/final.mp4", null);
    expect(db.digitalizacionGrabacion.updateMany).toHaveBeenCalledWith({ where: { id: "g1", workspaceId: "ws1" }, data: { videoBorradoAt: AHORA } });
    expect(db.digitalizacionEntrega.updateMany).toHaveBeenCalledWith({ where: { id: "e1", workspaceId: "ws1", videosBorradosAt: null }, data: { videosBorradosAt: AHORA } });
    expect(r).toMatchObject({ borradas: 1 });
  });
  it("si R2 falla, no marca nada como borrado (se reintenta mañana)", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-22T14:00:00Z")]);
    almacen.borrarVideoFinal.mockRejectedValue(new Error("R2 caído"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await recordatoriosYVencimientos(deps());
    expect(db.digitalizacionGrabacion.updateMany).not.toHaveBeenCalled();
    expect(db.digitalizacionEntrega.updateMany).not.toHaveBeenCalled();
    expect(r).toMatchObject({ borradas: 0, borradoFallido: 1 });
  });
  it("faltan 5 días: reserva el 5, manda el recordatorio con el enlace vigente", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-27T18:00:00Z")]);
    const d = deps();
    const r = await recordatoriosYVencimientos(d);
    expect(db.digitalizacionEntrega.updateMany.mock.calls[0][0]).toEqual({
      where: { id: "e1", workspaceId: "ws1", videosBorradosAt: null, NOT: { recordatorios: { has: 5 } } },
      data: { recordatorios: { push: 5 } },
    });
    expect(d.enviar.mock.calls[0]![0].subject).toContain("Tus videos se borran el 27/10");
    expect(d.enviar.mock.calls[0]![0].text).toContain(tokenDeEntrega("e1", "clave", 2));
    expect(r).toMatchObject({ recordatorios: 1 });
  });
  it("si el recordatorio no sale, libera el umbral", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-10-27T18:00:00Z", { recordatorios: [10] })]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await recordatoriosYVencimientos(deps(enviador({ status: "INTERNAL_ERROR", detail: "x" })));
    expect(db.digitalizacionEntrega.updateMany.mock.calls[1][0]).toEqual({ where: { id: "e1", workspaceId: "ws1" }, data: { recordatorios: { set: [10] } } });
  });
  it("faltan más de 10 días: nada", async () => {
    db.digitalizacionEntrega.findMany.mockResolvedValue([enviada("2026-11-20T18:00:00Z")]);
    const d = deps();
    await recordatoriosYVencimientos(d);
    expect(d.enviar).not.toHaveBeenCalled();
    expect(db.digitalizacionEntrega.updateMany).not.toHaveBeenCalled();
  });
});
