import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  order: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  album: { findFirst: vi.fn() },
  photo: { findUnique: vi.fn() },
  pedirCodigo: vi.fn(),
  verificarCodigo: vi.fn(),
  reenviar: vi.fn(),
  recuperarPack: vi.fn(),
  remocion: vi.fn(),
  privacidad: vi.fn(),
  interes: vi.fn(),
  registrar: vi.fn(),
  contar: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { order: m.order, album: m.album, photo: m.photo } }));
vi.mock("../codigo", () => ({ pedirCodigo: m.pedirCodigo, verificarCodigo: m.verificarCodigo }));
vi.mock("../store", () => ({ registrarAccionComprador: m.registrar, contarAccionesComprador: m.contar }));
vi.mock("@/lib/digital-download/reenviar-descarga", () => ({
  reenviarDescargaDePedido: m.reenviar,
  albumConOriginales: (a: { deletedAt: Date | null; cleanupStatus: string }) => a.deletedAt == null && a.cleanupStatus === "NONE",
}));
vi.mock("@/lib/preventa-canjeable/recuperar-pack", () => ({
  recuperarLinksDePack: m.recuperarPack,
  RESPUESTA_RECUPERAR_PACK: "Si encontramos pedidos con ese email, te enviamos un link.",
}));
vi.mock("@/lib/public/crear-solicitud-remocion", () => ({ crearSolicitudDeRemocion: m.remocion }));
vi.mock("@/lib/privacy/crear-solicitud-privacidad", () => ({
  crearSolicitudDePrivacidad: m.privacidad,
  PRIVACY_REQUEST_TYPES: ["ACCESO", "RECTIFICACION", "SUPRESION", "OCULTAR_FOTO", "BAJA_MARKETING", "DESACTIVAR_BIOMETRIA"],
  PRIVACY_RELATIONSHIPS: ["TITULAR", "PADRE_MADRE_TUTOR"],
}));
vi.mock("@/lib/albums/registrar-interes", () => ({ guardarInteresEnAlbum: m.interes }));

import type { BotTool } from "@repo/dnx-bot";
import { ACTOR_MOTOR_COMPRADOR, type CompradorActor } from "../identidad";
import { herramientasDeAccion, LIMITES_ACCIONES, RESPUESTA_REENVIO } from "./acciones";

const TOKEN = "f".repeat(64);
const MAIL_COMPLETO = /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]+/i;
const actor = (o: Partial<CompradorActor> = {}): CompradorActor => ({
  guestKey: "g".repeat(32), ipHash: "h".repeat(64), conversationId: "c1", pagina: null, pagePath: "/ayuda",
  albumId: null, enlace: null, emailVerificado: null, userId: null, ...o,
});
const tool = (a: CompradorActor, name: string): BotTool => herramientasDeAccion(a).find((t) => t.name === name)!;
const correr = (a: CompradorActor, name: string, input: unknown) => tool(a, name).run(input, ACTOR_MOTOR_COMPRADOR);
const describir = (a: CompradorActor, name: string, input: unknown) => tool(a, name).describe!(input, ACTOR_MOTOR_COMPRADOR);
const sinFuga = (r: unknown) => {
  const s = JSON.stringify(r);
  expect(s).not.toMatch(MAIL_COMPLETO);
  expect(s).not.toContain(TOKEN);
};

const VIVO = { deletedAt: null, cleanupStatus: "NONE" };
const BORRADO = { deletedAt: new Date("2026-09-01T00:00:00Z"), cleanupStatus: "COMPLETED" };
const pedido = (id: number, album = VIVO) => ({ id, albumId: 3, buyerEmail: "juana@gmail.com", album });

beforeEach(() => {
  for (const grupo of [m.order, m.album, m.photo]) {
    for (const f of Object.values(grupo)) f.mockReset();
  }
  for (const f of [m.pedirCodigo, m.verificarCodigo, m.reenviar, m.recuperarPack, m.remocion, m.privacidad, m.interes, m.registrar, m.contar]) {
    f.mockReset();
  }
  m.contar.mockResolvedValue(0);
  m.registrar.mockResolvedValue(undefined);
  m.reenviar.mockResolvedValue({ ok: true, renovado: false });
  m.recuperarPack.mockResolvedValue({ enviados: 1 });
});

describe("armado", () => {
  it("cinco sin tarjeta y dos con tarjeta", () => {
    const ts = herramientasDeAccion(actor());
    const de = (k: string) => ts.filter((t) => t.kind === k).map((t) => t.name);
    expect(de("read")).toEqual(["pedir_codigo", "verificar_codigo", "reenviar_descarga", "reenviar_link_pack", "avisame_cuando_haya_fotos"]);
    expect(de("write")).toEqual(["solicitar_quitar_foto", "solicitud_de_privacidad"]);
    expect(ts.every((t) => !t.undo)).toBe(true);
  });
  it("límites", () => {
    expect(LIMITES_ACCIONES).toEqual({
      reenviosPorMailHora: 3, reenviosPorIpHora: 5, packPorMailHora: 3, packPorIpHora: 5, avisosPorIpDia: 5, solicitudesPorIpHora: 10,
    });
  });
});

describe("pedir_codigo", () => {
  it("devuelve el mismo texto se haya mandado o no, y el resultado sólo queda en la base", async () => {
    m.pedirCodigo.mockResolvedValueOnce({ mensaje: "GENERICO", enviado: true }).mockResolvedValueOnce({ mensaje: "GENERICO", enviado: false });
    const a = actor();
    const r1 = await correr(a, "pedir_codigo", { email: "juana@gmail.com" });
    const r2 = await correr(a, "pedir_codigo", { email: "nadie@gmail.com" });
    expect(r1).toEqual(r2);
    expect(JSON.stringify(r1)).not.toContain("enviado");
    sinFuga(r1);
    expect(m.pedirCodigo).toHaveBeenCalledWith({ conversationId: "c1", ipHash: a.ipHash, email: "juana@gmail.com" });
    expect(m.registrar).toHaveBeenNthCalledWith(1, { conversationId: "c1", toolName: "pedir_codigo", email: "juana@gmail.com", resultado: "enviado" });
    expect(m.registrar).toHaveBeenNthCalledWith(2, { conversationId: "c1", toolName: "pedir_codigo", email: "nadie@gmail.com", resultado: "no_enviado" });
  });
});

describe("verificar_codigo", () => {
  it("ok → el mismo objeto actor queda verificado y el mail sale enmascarado", async () => {
    m.verificarCodigo.mockResolvedValue({ ok: true, email: "juana@gmail.com" });
    const a = actor();
    const r = await correr(a, "verificar_codigo", { codigo: "123456" });
    expect(m.verificarCodigo).toHaveBeenCalledWith({ conversationId: "c1", guestKey: a.guestKey, codigo: "123456" });
    expect(a.emailVerificado).toBe("juana@gmail.com");
    expect(r).toEqual({ ok: true, message: "Listo, verifiqué tu mail (ju***@gmail.com). Ya puedo ver tus pedidos." });
    sinFuga(r);
  });
  it("error → su mensaje y el actor no cambia", async () => {
    m.verificarCodigo.mockResolvedValue({ ok: false, motivo: "incorrecto", mensaje: "Ese código no coincide." });
    const a = actor();
    const r = await correr(a, "verificar_codigo", { codigo: "000000" });
    expect(r).toEqual({ ok: false, message: "Ese código no coincide." });
    expect(a.emailVerificado).toBeNull();
  });
});

describe("reenviar_descarga", () => {
  it("sin datos y sin enlace pide número o mail", async () => {
    const r = await correr(actor(), "reenviar_descarga", {});
    expect(r).toEqual({ ok: false, message: "Necesito el número de pedido o el mail con el que compraste." });
    expect(m.order.findMany).not.toHaveBeenCalled();
  });

  it("mail sin compras y mail con compras → mismo mensaje; sólo el segundo reenvía", async () => {
    m.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([pedido(10)]);
    const sin = await correr(actor(), "reenviar_descarga", { email: "nadie@gmail.com" });
    expect(m.reenviar).not.toHaveBeenCalled();
    const con = await correr(actor(), "reenviar_descarga", { email: "Juana@Gmail.com" });
    expect(sin.message).toBe(RESPUESTA_REENVIO);
    expect(con.message).toBe(RESPUESTA_REENVIO);
    expect(sin).toEqual(con);
    expect(m.reenviar).toHaveBeenCalledTimes(1);
    expect(m.reenviar.mock.calls[0]![0]).toMatchObject({ id: 10, albumId: 3 });
    expect(m.reenviar.mock.calls[0]![1]).toMatch(/^dnx-bot-comprador-10-/);
    const where = m.order.findMany.mock.calls[1]![0].where;
    expect(where).toMatchObject({ status: "PAID", isTest: false, buyerEmail: { equals: "juana@gmail.com", mode: "insensitive" } });
    expect(m.order.findMany.mock.calls[1]![0].take).toBe(3);
    expect(m.registrar).toHaveBeenLastCalledWith({ conversationId: "c1", toolName: "reenviar_descarga", email: "juana@gmail.com", resultado: "enviados:1" });
    sinFuga(sin);
    sinFuga(con);
  });

  it("un reenvío que falla no cambia el texto ni deja pasar el error", async () => {
    m.order.findMany.mockResolvedValue([pedido(10)]);
    m.reenviar.mockResolvedValue({ ok: false, error: "Resend: dominio db.interna", causa: new Error("x") });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await correr(actor(), "reenviar_descarga", { email: "juana@gmail.com" });
    expect(r).toEqual({ ok: true, message: RESPUESTA_REENVIO });
    expect(JSON.stringify(r)).not.toContain("Resend");
    expect(m.registrar).toHaveBeenLastCalledWith(expect.objectContaining({ resultado: "enviados:0" }));
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("con número de pedido de álbum borrado → albumBorrado (el número ya prueba posesión)", async () => {
    m.order.findFirst.mockResolvedValue(pedido(77, BORRADO));
    const r = await correr(actor(), "reenviar_descarga", { pedido: 77 });
    expect(m.order.findFirst.mock.calls[0]![0].where).toMatchObject({ id: 77, status: "PAID", isTest: false });
    expect(r).toEqual({
      ok: true,
      message: "El álbum de ese pedido ya se borró, así que no puedo generar un enlace nuevo. Si querés, abro un caso para que lo vea una persona.",
      data: { albumBorrado: true },
    });
    expect(m.reenviar).not.toHaveBeenCalled();
  });

  it("con número de pedido y un mail que no es el de la compra no reenvía", async () => {
    m.order.findFirst.mockResolvedValue(null);
    const r = await correr(actor(), "reenviar_descarga", { pedido: 77, email: "otra@gmail.com" });
    expect(m.order.findFirst.mock.calls[0]![0].where).toMatchObject({ id: 77, buyerEmail: { equals: "otra@gmail.com", mode: "insensitive" } });
    expect(m.reenviar).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, message: RESPUESTA_REENVIO });
  });

  it("con sólo el mail de un álbum borrado no lo revela", async () => {
    m.order.findMany.mockResolvedValue([pedido(77, BORRADO)]);
    const r = await correr(actor(), "reenviar_descarga", { email: "juana@gmail.com" });
    expect(r).toEqual({ ok: true, message: RESPUESTA_REENVIO });
  });

  it("con el mail verificado igual al del pedido sí avisa que el álbum se borró", async () => {
    m.order.findMany.mockResolvedValue([pedido(77, BORRADO)]);
    const r = await correr(actor({ emailVerificado: "juana@gmail.com" }), "reenviar_descarga", { email: "juana@gmail.com" });
    expect(r.data).toEqual({ albumBorrado: true });
  });

  it("sin datos y con enlace de descarga reenvía ese pedido", async () => {
    m.order.findFirst.mockResolvedValue(pedido(5));
    const r = await correr(actor({ enlace: { tipo: "descarga", orderId: 5, albumId: 3 } }), "reenviar_descarga", {});
    expect(m.order.findFirst.mock.calls[0]![0].where).toMatchObject({ id: 5, status: "PAID", isTest: false });
    expect(m.reenviar).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ ok: true, message: RESPUESTA_REENVIO });
    expect(m.registrar).toHaveBeenLastCalledWith({ conversationId: "c1", toolName: "reenviar_descarga", email: null, resultado: "enviados:1" });
  });

  it("5 reenvíos de la IP en la hora → no reenvía", async () => {
    m.contar.mockImplementation(async (p: { ipHash?: string }) => (p.ipHash ? 5 : 0));
    const a = actor();
    const r = await correr(a, "reenviar_descarga", { email: "juana@gmail.com" });
    expect(r).toEqual({ ok: true, message: "Ya te reenvié varias veces el enlace en la última hora. Esperá un rato y revisá spam; si sigue sin llegar, abro un caso." });
    expect(m.reenviar).not.toHaveBeenCalled();
    expect(m.order.findMany).not.toHaveBeenCalled();
    const llamada = m.contar.mock.calls.find((c) => c[0].ipHash)![0];
    expect(llamada).toMatchObject({ toolName: "reenviar_descarga", ipHash: a.ipHash });
    expect(Date.now() - llamada.desde.getTime()).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
  });

  it("3 reenvíos del mail en la hora → no reenvía", async () => {
    m.contar.mockImplementation(async (p: { email?: string }) => (p.email ? 3 : 0));
    const r = await correr(actor(), "reenviar_descarga", { email: "juana@gmail.com" });
    expect(r.message).toMatch(/^Ya te reenvié varias veces/);
    expect(m.reenviar).not.toHaveBeenCalled();
  });
});

describe("reenviar_link_pack", () => {
  const MENSAJE = "Si encontramos pedidos con ese email, te enviamos un link. El enlace anterior deja de funcionar: usá el del mail nuevo.";

  it("con mail → mismo texto haya o no packs", async () => {
    m.recuperarPack.mockResolvedValueOnce({ enviados: 0 }).mockResolvedValueOnce({ enviados: 2 });
    const sin = await correr(actor(), "reenviar_link_pack", { email: "nadie@gmail.com" });
    const con = await correr(actor(), "reenviar_link_pack", { email: "juana@gmail.com" });
    expect(sin).toEqual({ ok: true, message: MENSAJE });
    expect(con).toEqual(sin);
    expect(m.recuperarPack).toHaveBeenNthCalledWith(2, "juana@gmail.com");
    expect(m.registrar).toHaveBeenLastCalledWith({ conversationId: "c1", toolName: "reenviar_link_pack", email: "juana@gmail.com", resultado: "enviados:2" });
  });

  it("sin mail y con enlace de pack → usa el mail del pedido sin mostrarlo", async () => {
    m.order.findUnique.mockResolvedValue({ buyerEmail: "juana@gmail.com" });
    const r = await correr(actor({ enlace: { tipo: "pack", orderId: 9, albumId: 3 } }), "reenviar_link_pack", {});
    expect(m.recuperarPack).toHaveBeenCalledWith("juana@gmail.com", { soloPedidoId: 9 });
    expect(r).toEqual({ ok: true, message: MENSAJE });
    expect(r.message).toContain("El enlace anterior deja de funcionar");
    sinFuga(r);
  });

  it("sin mail ni enlace pide el mail", async () => {
    const r = await correr(actor(), "reenviar_link_pack", {});
    expect(r.ok).toBe(false);
    expect(m.recuperarPack).not.toHaveBeenCalled();
  });

  it("si la recuperación falla responde igual", async () => {
    m.recuperarPack.mockRejectedValue(new Error("tabla PackAccessToken"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await correr(actor(), "reenviar_link_pack", { email: "juana@gmail.com" });
    expect(r).toEqual({ ok: true, message: MENSAJE });
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("con el tope de la IP no recupera", async () => {
    m.contar.mockImplementation(async (p: { ipHash?: string; toolName: string }) => (p.ipHash && p.toolName === "reenviar_link_pack" ? 5 : 0));
    const r = await correr(actor(), "reenviar_link_pack", { email: "juana@gmail.com" });
    expect(m.recuperarPack).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });
});

describe("avisame_cuando_haya_fotos", () => {
  const ALBUM = { id: 3, title: "Maratón", isPublic: true, isHidden: false };

  it("guarda el aviso por 90 días sin pisar apellido ni WhatsApp", async () => {
    m.album.findFirst.mockResolvedValue(ALBUM);
    m.interes.mockResolvedValue({ id: 1 });
    const r = await correr(actor(), "avisame_cuando_haya_fotos", { albumId: 3, nombre: "Juana", email: "Juana@Gmail.com" });
    expect(m.album.findFirst.mock.calls[0]![0].where).toMatchObject({ id: 3, isTest: false, deletedAt: null });
    const arg = m.interes.mock.calls[0]![0];
    expect(arg).toMatchObject({ albumId: 3, email: "juana@gmail.com", name: "Juana", biometrico: null });
    expect("lastName" in arg).toBe(false);
    expect("whatsapp" in arg).toBe(false);
    const dias = (arg.expiresAt.getTime() - Date.now()) / 86400000;
    expect(dias).toBeGreaterThan(89.9);
    expect(dias).toBeLessThanOrEqual(90);
    expect(r).toEqual({ ok: true, message: "Listo, te aviso a ju***@gmail.com cuando haya fotos en «Maratón»." });
    sinFuga(r);
  });

  it("pasa el WhatsApp si lo dio", async () => {
    m.album.findFirst.mockResolvedValue(ALBUM);
    await correr(actor(), "avisame_cuando_haya_fotos", { albumId: 3, nombre: "Juana", email: "juana@gmail.com", whatsapp: "3415551234" });
    expect(m.interes.mock.calls[0]![0].whatsapp).toBe("3415551234");
  });

  it("álbum no listado sólo si es el de la página", async () => {
    m.album.findFirst.mockResolvedValue({ ...ALBUM, isPublic: false });
    const fuera = await correr(actor(), "avisame_cuando_haya_fotos", { albumId: 3, nombre: "Juana", email: "juana@gmail.com" });
    expect(fuera.ok).toBe(false);
    const enPagina = await correr(actor({ albumId: 3 }), "avisame_cuando_haya_fotos", { albumId: 3, nombre: "Juana", email: "juana@gmail.com" });
    expect(enPagina.ok).toBe(true);
    expect(m.interes).toHaveBeenCalledTimes(1);
  });

  it("con 5 avisos de la IP en el día no guarda", async () => {
    m.album.findFirst.mockResolvedValue(ALBUM);
    m.contar.mockResolvedValue(5);
    const r = await correr(actor(), "avisame_cuando_haya_fotos", { albumId: 3, nombre: "Juana", email: "juana@gmail.com" });
    expect(r.ok).toBe(false);
    expect(m.interes).not.toHaveBeenCalled();
    expect(m.album.findFirst).not.toHaveBeenCalled();
    expect(Date.now() - m.contar.mock.calls[0]![0].desde.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
  });
});

describe("solicitar_quitar_foto", () => {
  const INPUT = { albumId: 3, photoId: 40, nombre: "Juana Pérez", email: "Juana@Gmail.com", telefono: "3415551234", motivo: "Soy yo y no quiero que se vea." };
  const ALBUM_FOTO = { id: 3, title: "Maratón", isTest: false, deletedAt: null, isPublic: true, isHidden: false };
  const FOTO = { id: 40, albumId: 3, isRemoved: false, album: ALBUM_FOTO };

  it("describe con foto de otro álbum lanza", async () => {
    m.photo.findUnique.mockResolvedValue({ ...FOTO, albumId: 99 });
    await expect(describir(actor(), "solicitar_quitar_foto", INPUT)).rejects.toThrow();
  });

  it("describe con foto removida o álbum de prueba lanza", async () => {
    m.photo.findUnique.mockResolvedValueOnce({ ...FOTO, isRemoved: true }).mockResolvedValueOnce({ ...FOTO, album: { ...ALBUM_FOTO, isTest: true } }).mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...FOTO, album: { ...ALBUM_FOTO, deletedAt: new Date("2026-09-01T00:00:00Z") } });
    for (let i = 0; i < 4; i++) await expect(describir(actor(), "solicitar_quitar_foto", INPUT)).rejects.toThrow();
  });

  it("describe arma la tarjeta con el mail enmascarado", async () => {
    m.photo.findUnique.mockResolvedValue(FOTO);
    const t = await describir(actor(), "solicitar_quitar_foto", INPUT);
    expect(t).toBe(
      "Pedirle al fotógrafo que quite la foto #40 del álbum «Maratón». Lo decide el fotógrafo y no es inmediato. Te avisamos a ju***@gmail.com. Al confirmar declarás que sos la persona de la foto o su representante.",
    );
    sinFuga(t);
  });

  it("álbum oculto: acepta la solicitud pero no muestra el título", async () => {
    m.photo.findUnique.mockResolvedValue({ ...FOTO, album: { ...ALBUM_FOTO, title: "Secreto", isHidden: true } });
    const t = await describir(actor({ albumId: 3 }), "solicitar_quitar_foto", INPUT);
    expect(t).toMatch(/^Pedirle al fotógrafo que quite la foto #40 del álbum\. Lo decide/);
    expect(t).not.toContain("Secreto");
  });

  it("álbum no listado: título sólo en su página", async () => {
    m.photo.findUnique.mockResolvedValue({ ...FOTO, album: { ...ALBUM_FOTO, title: "Privado", isPublic: false } });
    expect(await describir(actor(), "solicitar_quitar_foto", INPUT)).not.toContain("Privado");
    expect(await describir(actor({ albumId: 3 }), "solicitar_quitar_foto", INPUT)).toContain("del álbum «Privado»");
  });

  it("describe con 10 solicitudes de la IP en la hora lanza", async () => {
    m.photo.findUnique.mockResolvedValue(FOTO);
    m.contar.mockResolvedValue(10);
    await expect(describir(actor(), "solicitar_quitar_foto", INPUT)).rejects.toThrow("Ya mandaste varias solicitudes en la última hora.");
    expect(m.contar.mock.calls[0]![0]).toMatchObject({ ipHash: "h".repeat(64), toolName: ["solicitar_quitar_foto", "solicitud_de_privacidad"] });
  });

  it("run crea la solicitud con declarationOk", async () => {
    m.remocion.mockResolvedValue({ ok: true, status: 201, requestId: 1, duplicate: false, message: "x" });
    const r = await correr(actor(), "solicitar_quitar_foto", INPUT);
    expect(m.remocion).toHaveBeenCalledWith({
      albumId: 3, photoId: 40, requesterName: "Juana Pérez", requesterEmail: "juana@gmail.com",
      requesterPhone: "3415551234", reason: "Soy yo y no quiero que se vea.", declarationOk: true,
    });
    expect(r).toEqual({ ok: true, message: "Listo, le llegó al fotógrafo. Lo decide él; te avisamos por mail." });
  });

  it("run duplicada y con error", async () => {
    m.remocion.mockResolvedValueOnce({ ok: true, status: 200, requestId: 1, duplicate: true, message: "x" });
    m.remocion.mockResolvedValueOnce({ ok: false, status: 400, error: "La foto ya no está disponible" });
    expect(await correr(actor(), "solicitar_quitar_foto", INPUT)).toEqual({ ok: true, message: "Ya había una solicitud tuya pendiente para esa foto." });
    expect(await correr(actor(), "solicitar_quitar_foto", INPUT)).toEqual({ ok: false, message: "La foto ya no está disponible" });
  });
});

describe("solicitud_de_privacidad", () => {
  const INPUT = { tipo: "SUPRESION", nombre: "Juana Pérez", email: "juana@gmail.com", relacion: "TITULAR" };

  it("describe menciona el tipo en palabras y el mail enmascarado", async () => {
    const t = await describir(actor(), "solicitud_de_privacidad", INPUT);
    expect(t).toBe(
      "Mandar una solicitud de borrar tus datos a nombre de Juana Pérez. La respuesta llega a ju***@gmail.com. Al confirmar declarás ser el titular o su representante.",
    );
    expect(await describir(actor(), "solicitud_de_privacidad", { ...INPUT, tipo: "DESACTIVAR_BIOMETRIA" })).toContain("borrar los datos de tu selfie");
    sinFuga(t);
  });

  it("describe con el tope compartido de solicitudes lanza", async () => {
    m.contar.mockResolvedValue(10);
    await expect(describir(actor(), "solicitud_de_privacidad", INPUT)).rejects.toThrow("Ya mandaste varias solicitudes en la última hora.");
  });

  it("run crea la solicitud con los datos del bot", async () => {
    m.privacidad.mockResolvedValue({ id: 321 });
    const r = await correr(actor({ pagePath: "/ayuda" }), "solicitud_de_privacidad", { ...INPUT, descripcion: "Borrar todo", albumId: 3 });
    expect(m.privacidad).toHaveBeenCalledWith(
      {
        type: "SUPRESION", fullName: "Juana Pérez", email: "juana@gmail.com", relationship: "TITULAR",
        description: "Borrar todo", albumId: 3, photoId: undefined, isRepresentative: true,
      },
      { ip: `dnx-bot:${"h".repeat(12)}`, userAgent: "DNX Bot", sourcePage: "/ayuda" },
    );
    expect(r).toEqual({ ok: true, message: "Listo, quedó la solicitud #321. Te llega la confirmación por mail." });
  });

  it("tipo inválido no pasa el esquema", () => {
    expect(tool(actor(), "solicitud_de_privacidad").input.safeParse({ ...INPUT, tipo: "OTRO" }).success).toBe(false);
  });
});
