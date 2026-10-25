import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = randomBytes(32).toString("base64");

const C = await import("@/lib/telegram/conexion");
const W = await import("./telegram-webhook");
const { hashDeSecreto, secretoValido } = await import("@/lib/telegram/webhook");
const { leerTokenTelegram } = await import("@/lib/integrations/telegram/credentials");

const TOKEN = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw";
const AHORA = new Date("2026-10-25T23:00:00.000Z");
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Daniel", role: "WORKSPACE_OWNER" };

/** `fetch` falso de la Bot API: anota cada llamada (método y cuerpo) y contesta ok. */
function botApi(respuestas: Record<string, unknown> = {}) {
  const llamadas: { metodo: string; cuerpo: Record<string, unknown> }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const metodo = String(url).split("/").pop()!;
    llamadas.push({ metodo, cuerpo: JSON.parse(String(init?.body ?? "{}")) });
    const result = metodo in respuestas ? respuestas[metodo] : metodo === "sendMessage" ? { message_id: 1 } : true;
    return new Response(JSON.stringify(result === "ERROR" ? { ok: false, error_code: 401 } : { ok: true, result }), { status: 200 });
  }) as typeof fetch;
  return { f, llamadas };
}

beforeEach(() => B.vaciar());

describe("conectar el bot", () => {
  it("valida con getMe, guarda el token cifrado y registra el webhook con un secreto que sólo se guarda como hash", async () => {
    const api = botApi({ getMe: { id: 987, is_bot: true, username: "dnx_presupuestos_bot", first_name: "Presupuestos" } });
    const r = await C.conectarTelegram(DUENO, ` ${TOKEN} `, { fetch: api.f, ahora: () => AHORA, origen: "https://fotoffice.com" });
    expect(r).toEqual({ ok: true });
    const fila = (await B.tablas.fotofficeTelegramConexion.findFirst({ where: { workspaceId: "ws-1" } })) as Record<string, unknown>;
    expect(fila).toMatchObject({ botId: "987", botUsername: "dnx_presupuestos_bot", chatId: null });
    const set = api.llamadas.find((l) => l.metodo === "setWebhook")!;
    expect(set.cuerpo.url).toBe(`https://fotoffice.com/api/webhooks/telegram/${fila.id}`);
    expect(secretoValido(set.cuerpo.secret_token as string, fila.webhookSecretHash as string)).toBe(true);
    expect(JSON.stringify(fila)).not.toContain(set.cuerpo.secret_token as string);
    expect(JSON.stringify(fila)).not.toContain(TOKEN);
    expect(await leerTokenTelegram("ws-1")).toBe(TOKEN);
  });

  it("un token rechazado por Telegram o con mala forma no guarda nada", async () => {
    const api = botApi({ getMe: "ERROR" });
    expect(await C.conectarTelegram(DUENO, TOKEN, { fetch: api.f, origen: "https://fotoffice.com" })).toEqual({ ok: false, error: C.MENSAJES_TELEGRAM.tokenRechazado });
    expect(await C.conectarTelegram(DUENO, "hola", { fetch: api.f, origen: "https://fotoffice.com" })).toEqual({ ok: false, error: C.MENSAJES_TELEGRAM.token });
    expect(await B.tablas.fotofficeTelegramConexion.findFirst({ where: { workspaceId: "ws-1" } })).toBeNull();
  });

  it("sin `configurar` no se conecta", async () => {
    const api = botApi();
    const r = await C.conectarTelegram({ ...DUENO, role: "STAFF", acceso: { role: "STAFF", levels: {} } as never }, TOKEN, { fetch: api.f, origen: "https://x" });
    expect(r).toEqual({ ok: false, error: C.MENSAJES_TELEGRAM.sinPermiso });
    expect(api.llamadas).toHaveLength(0);
  });
});

function conexion(extra: Record<string, unknown> = {}) {
  return B.agregar("fotofficeTelegramConexion", {
    id: "ckconexion000001", workspaceId: "ws-1", botId: "987", botUsername: "dnx_bot", webhookSecretHash: hashDeSecreto("s"),
    linkCode: "ABCD234567", linkCodeExpiresAt: new Date(AHORA.getTime() + 60_000), ...extra,
  }) as unknown as Parameters<typeof W.procesarUpdateTelegram>[0];
}

describe("vincular el chat con /start <código>", () => {
  it("el código correcto vincula ese chat y no se puede volver a usar", async () => {
    const c = conexion();
    expect(await C.vincularChat(c, { chatId: "555", chatPrivado: true, codigo: "ABCD234567", nombre: "Daniel" }, AHORA)).toBe("VINCULADO");
    expect(await B.tablas.fotofficeTelegramConexion.findFirst({ where: { id: c.id } })).toMatchObject({ chatId: "555", linkCode: null, chatNombre: "Daniel" });
    expect(await C.vincularChat(c, { chatId: "666", chatPrivado: true, codigo: "ABCD234567", nombre: null }, AHORA)).toBe("CODIGO_INVALIDO");
  });

  it("vencido, equivocado o desde un grupo: no", async () => {
    const c = conexion({ linkCodeExpiresAt: new Date(AHORA.getTime() - 1) });
    expect(await C.vincularChat(c, { chatId: "555", chatPrivado: true, codigo: "ABCD234567", nombre: null }, AHORA)).toBe("CODIGO_INVALIDO");
    expect(await C.vincularChat(c, { chatId: "555", chatPrivado: true, codigo: "OTRO", nombre: null }, AHORA)).toBe("CODIGO_INVALIDO");
    expect(await C.vincularChat(c, { chatId: "555", chatPrivado: false, codigo: "ABCD234567", nombre: null }, AHORA)).toBe("NO_PRIVADO");
  });
});

describe("procesarUpdateTelegram (botones)", () => {
  const aprobar = vi.fn(async () => ({ ok: true as const, canales: { correo: "ENVIADO" as const, whatsapp: "SIN_CELULAR" as const }, texto: "Enviado por correo." }));
  beforeEach(() => aprobar.mockClear());

  it("un botón que no viene del chat vinculado no aprueba nada", async () => {
    const api = botApi();
    const c = conexion({ chatId: "555" });
    await W.procesarUpdateTelegram(c, { tipo: "BOTON", callbackId: "cb", chatId: "666", deId: "666", messageId: "1", data: "ap:ckaprobacion0001" }, { fetch: api.f, leerToken: async () => TOKEN, aprobar });
    expect(aprobar).not.toHaveBeenCalled();
    expect(api.llamadas[0]).toMatchObject({ metodo: "answerCallbackQuery", cuerpo: { text: "Este botón no es para este chat." } });
  });

  it("desde el chat vinculado aprueba con el workspace de la conexión", async () => {
    const api = botApi();
    const c = conexion({ chatId: "555" });
    await W.procesarUpdateTelegram(c, { tipo: "BOTON", callbackId: "cb", chatId: "555", deId: "555", messageId: "1", data: "ap:ckaprobacion0001" }, { fetch: api.f, leerToken: async () => TOKEN, aprobar });
    expect(aprobar).toHaveBeenCalledWith("ws-1", "ckaprobacion0001", { tipo: "TELEGRAM" }, expect.anything());
    expect(api.llamadas.at(-1)).toMatchObject({ metodo: "answerCallbackQuery", cuerpo: { text: "Enviado por correo." } });
  });

  it("/start contesta en el chat con el resultado del vínculo", async () => {
    const api = botApi();
    const c = conexion();
    await W.procesarUpdateTelegram(c, { tipo: "START", chatId: "555", chatPrivado: true, codigo: "ABCD234567", nombre: "Daniel" }, { fetch: api.f, leerToken: async () => TOKEN, ahora: () => AHORA });
    expect(api.llamadas[0]).toMatchObject({ metodo: "sendMessage", cuerpo: { chat_id: "555", text: W.TEXTOS_VINCULO.VINCULADO } });
  });
});
