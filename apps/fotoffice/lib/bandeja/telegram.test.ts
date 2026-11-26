import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/telegram/credentials", () => ({ leerTokenTelegram: vi.fn(async () => "tok") }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ leerTokenWhatsapp: vi.fn(async () => null), hayTokenWhatsapp: vi.fn(), guardarTokenWhatsapp: vi.fn() }));
vi.mock("@/lib/access/acceso", () => ({ resolverAcceso: vi.fn() }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: vi.fn(async () => true) }));

const T = await import("./telegram");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;
const AHORA = new Date("2026-11-24T15:00:00.000Z");
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000);
const TG = "555"; // chat privado de Daniel en Telegram

const CONEXION = {
  id: "conexion0001", workspaceId: "w1", botId: "1", botUsername: "bot", chatId: TG, chatNombre: "Daniel", linkCode: null, linkCodeExpiresAt: null,
  webhookSecretHash: "x", linkedAt: AHORA, connectedByUserId: 4, bandejaActiva: true,
};
const DANIEL = { workspaceId: "w1", userId: 4, userLabel: "Daniel", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { "whatsapp-inbox": "MANAGE" } } as never };

function deps(p: Record<string, unknown> = {}) {
  let n = 100;
  const api = { mandar: vi.fn(async () => String(n++)), contestar: vi.fn(async () => undefined), botones: vi.fn(async () => undefined) };
  return {
    api, ahora: AHORA, origen: "https://fo.test", leerToken: async () => "tok", conexionDe: async () => CONEXION, ctxDe: async () => DANIEL,
    personas: async () => [{ userId: 4, nombre: "Daniel", puedeOperar: true }, { userId: 7, nombre: "Camila", puedeOperar: true }, { userId: 8, nombre: "Leo", puedeOperar: false }],
    responder: vi.fn(async () => ({ ok: true as const, mensajeId: "m1", estadoEnvio: "ENVIADO" })),
    resumir: vi.fn(async () => "Quiere XV."),
    ...p,
  };
}

async function chat(p: Record<string, unknown> = {}) {
  return (await P.fotofficeWaChat.create({ data: { workspaceId: "w1", waId: "549341", nombre: "María", estado: "HUMANO", asignadoUserId: 4, ultimoMensajeEn: hace(5), ultimoEntranteEn: hace(5), ...p } })) as { id: string };
}
async function aviso(chatId: string, telegramMessageId = "77", workspaceId = "w1", telegramChatId = TG) {
  return (await P.fotofficeWaTelegramAviso.create({ data: { workspaceId, conexionId: CONEXION.id, chatId, telegramChatId, telegramMessageId } })) as { id: string };
}
const respuesta = (texto: string, p: Record<string, unknown> = {}) => ({ tipo: "RESPUESTA" as const, chatId: TG, chatPrivado: true, deId: TG, messageId: "900", respondeA: "77", texto, ...p });
const boton = (data: string) => ({ tipo: "BOTON" as const, callbackId: "cb", chatId: TG, deId: TG, messageId: "77", data });

beforeEach(() => {
  B.vaciar();
  B.agregar("user", { id: 4, name: "Daniel", email: "d@x.com" });
  B.agregar("user", { id: 7, name: "Camila", email: "c@x.com" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("responder citando", () => {
  it("cita conocida: responde a ESE chat con un token fijo y cuenta «Enviado»", async () => {
    const c = await chat();
    await aviso(c.id);
    const d = deps();
    expect(await T.atenderRespuesta(CONEXION, respuesta("Sí, incluye video"), d)).toBe(true);
    expect(d.responder).toHaveBeenCalledWith(DANIEL, c.id, "Sí, incluye video", "tg-conexion0001-900");
    expect(d.api.mandar).toHaveBeenCalledWith("tok", TG, "✅ Enviado a María", expect.anything(), "900");
    // La confirmación también queda atada al chat: citarla responde al mismo cliente.
    expect(B.datos.fotofficeWaTelegramAviso.filter((a) => a.chatId === c.id)).toHaveLength(2);
  });
  it("cita desconocida, de otra conexión u otro chat de Telegram: nada", async () => {
    const c = await chat();
    await aviso(c.id);
    const d = deps();
    expect(await T.atenderRespuesta(CONEXION, respuesta("x", { respondeA: "999" }), d)).toBe(false);
    expect(await T.atenderRespuesta(CONEXION, respuesta("x", { chatId: "666", deId: "666" }), d)).toBe(false);
    expect(await T.atenderRespuesta({ ...CONEXION, id: "otraconexion" }, respuesta("x"), d)).toBe(false);
    expect(d.responder).not.toHaveBeenCalled();
    expect(d.api.mandar).not.toHaveBeenCalled();
  });
  it("un aviso de otra institución con el mismo id de mensaje no sirve", async () => {
    const c = await chat();
    await aviso(c.id, "77", "w2");
    const d = deps();
    expect(await T.atenderRespuesta(CONEXION, respuesta("x"), d)).toBe(false);
    expect(d.responder).not.toHaveBeenCalled();
  });
  it("el mismo mensaje de Telegram dos veces usa el mismo token (responder no duplica)", async () => {
    const c = await chat();
    await aviso(c.id);
    const d = deps();
    await T.atenderRespuesta(CONEXION, respuesta("hola"), d);
    await T.atenderRespuesta(CONEXION, respuesta("hola"), d);
    const tokens = d.responder.mock.calls.map((x) => (x as unknown[])[3]);
    expect(new Set(tokens)).toEqual(new Set(["tg-conexion0001-900"]));
  });
  it("si ahora lo atiende otra persona, no envía: guarda el texto y ofrece «Tomarlo y enviar»", async () => {
    const c = await chat({ asignadoUserId: 7 });
    const a = await aviso(c.id);
    const d = deps();
    await T.atenderRespuesta(CONEXION, respuesta("Te paso el precio"), d);
    expect(d.responder).not.toHaveBeenCalled();
    expect(B.datos.fotofficeWaTelegramAviso[0]).toMatchObject({ textoPendiente: "Te paso el precio", pendienteEn: AHORA });
    expect(d.api.mandar).toHaveBeenCalledWith("tok", TG, "Ahora lo atiende Camila. ¿Lo tomás y lo mando?", { inline_keyboard: [[{ text: "Tomarlo y enviar", callback_data: `bj:t:${a.id}` }]] }, "900");
  });
  it("fuera de la ventana: avisa con el motivo y el botón para abrirlo", async () => {
    const c = await chat();
    await aviso(c.id);
    const d = deps({ responder: vi.fn(async () => ({ ok: false as const, error: "Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp sólo permite responder con una plantilla aprobada." })) });
    await T.atenderRespuesta(CONEXION, respuesta("hola"), d);
    const [, , html, teclado] = d.api.mandar.mock.calls[0] as unknown as [string, string, string, { inline_keyboard: { text: string; url?: string }[][] }];
    expect(html).toContain("⚠️ No se pudo enviar: Pasaron más de 24 horas");
    expect(teclado.inline_keyboard[0][0]).toEqual({ text: "Abrir en FOTOFFICE", url: `https://fo.test/bandeja/${c.id}` });
  });
  it("una foto citando: sólo texto", async () => {
    const c = await chat();
    await aviso(c.id);
    const d = deps();
    await T.atenderRespuesta(CONEXION, { tipo: "RESPUESTA_NO_TEXTO", chatId: TG, deId: TG, respondeA: "77" }, d);
    expect(d.api.mandar).toHaveBeenCalledWith("tok", TG, "Por ahora desde Telegram sólo se puede mandar texto.", null, undefined);
    expect(d.responder).not.toHaveBeenCalled();
  });
});

describe("botones", () => {
  it("un botón que no es de la Bandeja no se atiende acá", async () => {
    expect(await T.atenderBoton(CONEXION, boton("ap:abcdefgh12"), deps())).toBe(false);
  });
  it("datos inventados, otro chat de Telegram o un chat de otra institución: no se toca nada", async () => {
    const ajeno = (await P.fotofficeWaChat.create({ data: { workspaceId: "w2", waId: "1", estado: "HUMANO", asignadoUserId: 4, ultimoMensajeEn: AHORA } })) as { id: string };
    const derivar = vi.fn();
    const resolver = vi.fn();
    const d = deps({ derivar, resolver });
    await T.atenderBoton(CONEXION, boton(`bj:r:${ajeno.id}`), d);
    await T.atenderBoton(CONEXION, boton(`bj:d:${ajeno.id}:7`), d);
    expect(d.api.contestar).toHaveBeenCalledWith("tok", "cb", "No encontramos ese chat.");
    await T.atenderBoton(CONEXION, { ...boton(`bj:r:${ajeno.id}`), chatId: "666", deId: "666" }, d);
    expect(derivar).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
  });
  it("Derivar ▸ muestra a quienes pueden atender (sin uno mismo) y el bot", async () => {
    const c = await chat();
    const d = deps();
    await T.atenderBoton(CONEXION, boton(`bj:dv:${c.id}`), d);
    const teclado = (d.api.botones.mock.calls[0] as unknown as [string, string, string, { inline_keyboard: { text: string }[][] }])[3];
    expect(teclado.inline_keyboard.map((f) => f[0].text)).toEqual(["Camila", "🤖 Bot", "← Volver"]);
  });
  it("derivar desde Telegram usa las mismas reglas que el panel y arma el resumen", async () => {
    const c = await chat();
    const derivar = vi.fn(async () => ({ ok: true as const, cambio: true }));
    const d = deps({ derivar });
    await T.atenderBoton(CONEXION, boton(`bj:d:${c.id}:7`), d);
    expect(derivar).toHaveBeenCalledWith(DANIEL, c.id, 7);
    expect(d.api.contestar).toHaveBeenCalledWith("tok", "cb", "Se lo pasaste a Camila");
    expect(d.resumir).toHaveBeenCalledWith("w1", c.id);
  });
  it("Tomarlo y enviar: toma el chat y manda lo pendiente una sola vez", async () => {
    const c = await chat({ asignadoUserId: 7 });
    const a = await aviso(c.id);
    await P.fotofficeWaTelegramAviso.update({ where: { id: a.id }, data: { textoPendiente: "Te paso el precio", pendienteEn: hace(10) } });
    const tomar = vi.fn(async () => ({ ok: true as const, cambio: true }));
    const d = deps({ tomar });
    await T.atenderBoton(CONEXION, boton(`bj:t:${a.id}`), d);
    expect(tomar).toHaveBeenCalledWith(DANIEL, c.id);
    expect(d.responder).toHaveBeenCalledWith(DANIEL, c.id, "Te paso el precio", `tg-conexion0001-t-${a.id}`);
    await T.atenderBoton(CONEXION, boton(`bj:t:${a.id}`), d);
    expect(d.responder).toHaveBeenCalledTimes(1);
    expect(d.api.contestar).toHaveBeenLastCalledWith("tok", "cb", "Ya no hay nada pendiente para enviar.");
  });
});

describe("avisos", () => {
  it("derivado a Daniel por otra persona: tarjeta con resumen y botones; él mismo o con la Bandeja apagada en Telegram: nada", async () => {
    const c = await chat();
    await P.fotofficeWaMensaje.create({ data: { workspaceId: "w1", chatId: c.id, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "¿Incluye video?", createdAt: hace(5) } });
    const d = deps();
    await T.avisarDerivacion("w1", c.id, { userId: 7, nombre: "Camila" }, d);
    const [, , html] = d.api.mandar.mock.calls[0] as unknown as [string, string, string];
    expect(html).toContain("Camila te derivó un chat");
    expect(html).toContain("Resumen: Quiere XV.");
    expect(html).toContain("👤 ¿Incluye video?");
    expect(B.datos.fotofficeWaTelegramAviso).toHaveLength(1);
    const d2 = deps();
    await T.avisarDerivacion("w1", c.id, { userId: 4, nombre: "Daniel" }, d2);
    await T.avisarDerivacion("w1", c.id, { userId: 7, nombre: "Camila" }, deps({ conexionDe: async () => ({ ...CONEXION, bandejaActiva: false }), api: d2.api }));
    expect(d2.api.mandar).not.toHaveBeenCalled();
  });
  it("cada mensaje nuevo del cliente, sólo mientras el chat sea de Daniel", async () => {
    const mio = await chat();
    const deCamila = await chat({ waId: "549342", asignadoUserId: 7 });
    const m1 = await P.fotofficeWaMensaje.create({ data: { workspaceId: "w1", chatId: mio.id, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "hola", createdAt: AHORA } });
    const m2 = await P.fotofficeWaMensaje.create({ data: { workspaceId: "w1", chatId: deCamila.id, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "hola", createdAt: AHORA } });
    const d = deps();
    await T.avisarEntrantes([{ workspaceId: "w1", chatId: mio.id, mensajeId: m1.id }, { workspaceId: "w1", chatId: deCamila.id, mensajeId: m2.id }], d);
    expect(d.api.mandar).toHaveBeenCalledTimes(1);
    expect((d.api.mandar.mock.calls[0] as unknown as [string, string, string])[2]).toBe("💬 <b>María</b>: hola");
  });
});

describe("arreglos de la revisión", () => {
  it("tras vincular otro celular, una cita con el mismo número de mensaje no va al chat viejo", async () => {
    const viejo = await chat({ waId: "549111" });
    const nuevo = await chat({ waId: "549222" });
    await aviso(viejo.id, "77", "w1", "OTRO_CELULAR");
    const d = deps();
    // El celular nuevo recibe la tarjeta del chat nuevo con el mismo número 77.
    d.api.mandar.mockImplementationOnce(async () => "77");
    await T.avisarDerivacion("w1", nuevo.id, { userId: 7, nombre: "Camila" }, d);
    await T.atenderRespuesta(CONEXION, respuesta("hola"), d);
    expect(d.responder).toHaveBeenCalledWith(DANIEL, nuevo.id, "hola", "tg-conexion0001-900");
    expect(d.responder).not.toHaveBeenCalledWith(DANIEL, viejo.id, expect.anything(), expect.anything());
  });
  it("Tomarlo y enviar usa el token de la respuesta pendiente: un segundo pendiente sobre la misma tarjeta sí sale", async () => {
    const c = await chat({ asignadoUserId: 7 });
    const a = await aviso(c.id);
    const tomar = vi.fn(async () => ({ ok: true as const, cambio: true }));
    const d = deps({ tomar });
    await T.atenderRespuesta(CONEXION, respuesta("primero", { messageId: "900" }), d);
    await T.atenderBoton(CONEXION, boton(`bj:t:${a.id}`), d);
    await P.fotofficeWaChat.update({ where: { id: c.id }, data: { asignadoUserId: 7 } });
    await T.atenderRespuesta(CONEXION, respuesta("segundo", { messageId: "901" }), d);
    await T.atenderBoton(CONEXION, boton(`bj:t:${a.id}`), d);
    expect(d.responder.mock.calls.map((x) => (x as unknown[])[3])).toEqual(["tg-conexion0001-900", "tg-conexion0001-901"]);
  });
  it("si tomar falla, lo pendiente no se pierde", async () => {
    const c = await chat({ asignadoUserId: 7 });
    const a = await aviso(c.id);
    const d = deps({ tomar: vi.fn(async () => ({ ok: false as const, error: "No se pudo completar la acción. Probá de nuevo." })) });
    await T.atenderRespuesta(CONEXION, respuesta("texto"), d);
    await T.atenderBoton(CONEXION, boton(`bj:t:${a.id}`), d);
    expect(B.datos.fotofficeWaTelegramAviso.find((x) => x.id === a.id)!.textoPendiente).toBe("texto");
  });
});
