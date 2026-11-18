import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ leerTokenWhatsapp: vi.fn(async () => null), hayTokenWhatsapp: vi.fn(), guardarTokenWhatsapp: vi.fn() }));

const { enviarComoBot, pasarAPersona } = await import("./envio-bot");

const AHORA = new Date("2026-10-20T15:00:00.000Z");
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;
const mensajes = () => B.datos.fotofficeWaMensaje;
const chats = () => B.datos.fotofficeWaChat;

async function escenario(chatExtra: Record<string, unknown> = {}) {
  await P.fotofficeWaConexion.create({ data: { workspaceId: "w1", modo: "SIMULADO" } });
  const chat = await P.fotofficeWaChat.create({
    data: { workspaceId: "w1", waId: "5493413419869", ultimoMensajeEn: hace(1), ultimoEntranteEn: hace(1), ...chatExtra },
  });
  const m = await P.fotofficeWaMensaje.create({
    data: { workspaceId: "w1", chatId: chat.id, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "hola", estadoEnvio: "RECIBIDO", createdAt: hace(1) },
  });
  return { chatId: chat.id as string, ultimo: m.id as string };
}

beforeEach(() => {
  B.vaciar();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("enviarComoBot", () => {
  it("guarda el mensaje del bot y en modo prueba queda SIMULADO", async () => {
    const { chatId, ultimo } = await escenario();
    expect(await enviarComoBot("w1", chatId, "¡Hola! ¿En qué te ayudo?", { ultimoMensajeId: ultimo }, { ahora: AHORA })).toBe("simulado");
    const bot = mensajes().find((m) => m.autor === "BOT");
    expect(bot).toMatchObject({ direccion: "SALIENTE", autorLabel: "Bot", texto: "¡Hola! ¿En qué te ayudo?", estadoEnvio: "SIMULADO" });
    expect(chats()[0].ultimoMensajeTexto).toContain("Hola");
  });

  it("no envía si entró otro mensaje mientras pensaba", async () => {
    const { chatId, ultimo } = await escenario();
    await P.fotofficeWaMensaje.create({
      data: { workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "otra cosa", estadoEnvio: "RECIBIDO", createdAt: AHORA },
    });
    expect(await enviarComoBot("w1", chatId, "respuesta vieja", { ultimoMensajeId: ultimo }, { ahora: AHORA })).toBe("omitido");
    expect(mensajes().some((m) => m.autor === "BOT")).toBe(false);
  });

  it("no envía si una persona tomó el chat", async () => {
    const { chatId, ultimo } = await escenario({ estado: "HUMANO", asignadoUserId: 7 });
    expect(await enviarComoBot("w1", chatId, "hola", { ultimoMensajeId: ultimo }, { ahora: AHORA })).toBe("omitido");
  });

  it("no envía fuera de la ventana de 24 h", async () => {
    const { chatId, ultimo } = await escenario({ ultimoEntranteEn: new Date(AHORA.getTime() - 25 * 3_600_000) });
    expect(await enviarComoBot("w1", chatId, "hola", { ultimoMensajeId: ultimo }, { ahora: AHORA })).toBe("omitido");
  });
});

describe("pasarAPersona", () => {
  it("deja el chat para una persona y lo anota", async () => {
    const { chatId } = await escenario();
    await pasarAPersona("w1", chatId, "presupuesto de boda", AHORA);
    expect(chats()[0]).toMatchObject({ estado: "HUMANO", asignadoUserId: null, botPausadoHasta: null });
    expect(mensajes().find((m) => m.direccion === "SISTEMA")?.texto).toBe("El bot pasó el chat a una persona: presupuesto de boda");
  });
});

describe("enviarComoBot en Instagram", () => {
  it("le pasa el canal del chat al envío y guarda el mid aunque el eco ya lo haya puesto", async () => {
    const { chatId, ultimo } = await escenario({ canal: "INSTAGRAM", waId: "5550001" });
    const enviar = vi.fn(async () => {
      const m = mensajes().find((x) => x.autor === "BOT");
      Object.assign(m!, { waMessageId: "m_eco" });
      return { ok: true as const, simulado: false as const, waMessageId: "m_eco" };
    });
    expect(await enviarComoBot("w1", chatId, "¡Hola!", { ultimoMensajeId: ultimo }, { ahora: AHORA, enviar })).toBe("enviado");
    const [, destino, , , canal] = enviar.mock.calls[0] as unknown as [unknown, string, string, unknown, string];
    expect([destino, canal]).toEqual(["5550001", "INSTAGRAM"]);
    expect(mensajes().find((m) => m.autor === "BOT")).toMatchObject({ estadoEnvio: "ENVIADO", waMessageId: "m_eco" });
  });

  it("si otra fila ya tiene ese mid, el mensaje del bot queda ENVIADO igual", async () => {
    const { chatId, ultimo } = await escenario({ canal: "INSTAGRAM", waId: "5550001" });
    await P.fotofficeWaMensaje.create({ data: { workspaceId: "w1", chatId, direccion: "SALIENTE", autor: "CELULAR", tipo: "TEXTO", texto: "x", estadoEnvio: "ENVIADO", waMessageId: "m_dup", createdAt: hace(5) } });
    const enviar = vi.fn(async () => ({ ok: true as const, simulado: false as const, waMessageId: "m_dup" }));
    expect(await enviarComoBot("w1", chatId, "¡Hola!", { ultimoMensajeId: ultimo }, { ahora: AHORA, enviar })).toBe("enviado");
    expect(mensajes().find((m) => m.autor === "BOT")).toMatchObject({ estadoEnvio: "ENVIADO", waMessageId: null });
  });
});
