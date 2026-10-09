import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventoWa } from "./webhook";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;

const { aplicarEventos, clienteDelTelefono } = await import("./registro");

const AHORA = new Date("2026-10-09T15:00:00.000Z");
const min = (n: number) => new Date(AHORA.getTime() + n * 60_000);
const WS = "w1";
const PNID = "106540352242922";
const WA = "5493413419869";

const entrante = (p: Partial<Extract<EventoWa, { tipo: "ENTRANTE" }>> = {}): EventoWa => ({
  tipo: "ENTRANTE", phoneNumberId: PNID, waMessageId: "wamid.1", waId: WA, nombre: "Lucía", en: min(-1),
  mensajeTipo: "TEXTO", texto: "hola", media: null, ...p,
});
const eco = (p: Partial<Extract<EventoWa, { tipo: "ECO" }>> = {}): EventoWa => ({
  tipo: "ECO", phoneNumberId: PNID, waMessageId: "wamid.eco1", waId: WA, en: min(-1),
  mensajeTipo: "TEXTO", texto: "ya te contesto", media: null, ...p,
});
const estado = (p: Partial<Extract<EventoWa, { tipo: "ESTADO" }>> = {}): EventoWa => ({
  tipo: "ESTADO", phoneNumberId: PNID, waMessageId: "wamid.out1", en: min(-1), estado: "ENTREGADO", errorCodigo: null, ...p,
});

const chats = () => B.datos.fotofficeWaChat;
const mensajes = () => B.datos.fotofficeWaMensaje;

beforeEach(async () => {
  for (const t of ["fotofficeWaConexion", "fotofficeWaChat", "fotofficeWaMensaje", "client"] as const) B.datos[t].length = 0;
  await P.fotofficeWaConexion.create({ data: { workspaceId: WS, phoneNumberId: PNID } });
});

describe("aplicarEventos: entrantes", () => {
  it("crea el chat con nombre, no leído, hora y el mensaje", async () => {
    const r = await aplicarEventos([entrante()], AHORA);
    expect(r).toEqual({ aplicados: 1, duplicados: 0, ignorados: 0 });
    expect(chats()).toHaveLength(1);
    expect(chats()[0]).toMatchObject({
      workspaceId: WS, waId: WA, nombre: "Lucía", estado: "BOT", noLeidos: 1, clientId: null,
      ultimoMensajeEn: min(-1), ultimoEntranteEn: min(-1),
    });
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({
      direccion: "ENTRANTE", autor: "CLIENTE", estadoEnvio: "RECIBIDO", tipo: "TEXTO", texto: "hola", waMessageId: "wamid.1",
    });
  });

  it("segundo mensaje: suma no leídos y conserva el chat", async () => {
    await aplicarEventos([entrante(), entrante({ waMessageId: "wamid.2", en: min(-0.5), nombre: "Lucía P." })], AHORA);
    expect(chats()).toHaveLength(1);
    expect(chats()[0]).toMatchObject({ noLeidos: 2, nombre: "Lucía P." });
    expect(mensajes()).toHaveLength(2);
  });

  it("imagen con caption guarda el archivo en media", async () => {
    await aplicarEventos([entrante({ mensajeTipo: "IMAGEN", texto: "fondo", media: { id: "9", mimeType: "image/jpeg", caption: "fondo" } })], AHORA);
    expect(mensajes()[0]).toMatchObject({ tipo: "IMAGEN", texto: "fondo", media: { id: "9", mimeType: "image/jpeg" } });
  });

  it("idempotente: el mismo waMessageId no duplica ni vuelve a sumar", async () => {
    await aplicarEventos([entrante()], AHORA);
    const r = await aplicarEventos([entrante()], AHORA);
    expect(r).toEqual({ aplicados: 0, duplicados: 1, ignorados: 0 });
    expect(mensajes()).toHaveLength(1);
    expect(chats()[0].noLeidos).toBe(1);
  });

  it("un choque de único al insertar (carrera) se toma como duplicado y no reaplica reglas", async () => {
    await aplicarEventos([entrante()], AHORA);
    // Simula la carrera: el chequeo previo no lo ve, el insert choca.
    const original = B.tablas.fotofficeWaMensaje.findUnique;
    let primera = true;
    B.tablas.fotofficeWaMensaje.findUnique = async (a) => {
      if (primera) { primera = false; return null; }
      return original(a);
    };
    try {
      const r = await aplicarEventos([entrante()], AHORA);
      expect(r.duplicados).toBe(1);
    } finally {
      B.tablas.fotofficeWaMensaje.findUnique = original;
    }
    expect(mensajes()).toHaveLength(1);
    expect(chats()[0].noLeidos).toBe(1);
  });

  it("phoneNumberId sin conexión: se ignora sin tocar nada", async () => {
    const r = await aplicarEventos([entrante({ phoneNumberId: "999" })], AHORA);
    expect(r).toEqual({ aplicados: 0, duplicados: 0, ignorados: 1 });
    expect(chats()).toHaveLength(0);
  });

  it("sin hora de Meta usa la de recepción", async () => {
    await aplicarEventos([entrante({ en: null })], AHORA);
    expect(chats()[0].ultimoMensajeEn).toEqual(AHORA);
  });

  it("un chat RESUELTO se reabre y deja el mensaje de sistema", async () => {
    await P.fotofficeWaChat.create({ data: { workspaceId: WS, waId: WA, estado: "RESUELTO", ultimoMensajeEn: min(-600) } });
    await aplicarEventos([entrante()], AHORA);
    expect(chats()[0].estado).toBe("BOT");
    const sistema = mensajes().filter((m) => m.direccion === "SISTEMA");
    expect(sistema).toHaveLength(1);
    expect(sistema[0]).toMatchObject({ autor: "SISTEMA", texto: "Se reabrió con un mensaje nuevo" });
  });

  it("un entrante no cambia un chat HUMANO tomado", async () => {
    await P.fotofficeWaChat.create({ data: { workspaceId: WS, waId: WA, estado: "HUMANO", asignadoUserId: 7, ultimoMensajeEn: min(-600) } });
    await aplicarEventos([entrante()], AHORA);
    expect(chats()[0]).toMatchObject({ estado: "HUMANO", asignadoUserId: 7 });
  });

  it("si la escritura falla a medias no queda chat ni mensaje (transacción)", async () => {
    const original = B.tablas.fotofficeWaMensaje.create;
    B.tablas.fotofficeWaMensaje.create = async () => { throw new Error("boom"); };
    try {
      await expect(aplicarEventos([entrante()], AHORA)).rejects.toThrow("boom");
    } finally {
      B.tablas.fotofficeWaMensaje.create = original;
    }
    expect(chats()).toHaveLength(0);
  });
});

describe("aplicarEventos: ecos (respuesta desde el celular)", () => {
  it("crea el chat en HUMANO con pausa de 4 h y mensaje saliente del CELULAR", async () => {
    await aplicarEventos([eco()], AHORA);
    expect(chats()[0]).toMatchObject({ estado: "HUMANO", noLeidos: 0, botPausadoHasta: new Date(min(-1).getTime() + 4 * 3600_000), ultimoEntranteEn: null });
    expect(mensajes()[0]).toMatchObject({ direccion: "SALIENTE", autor: "CELULAR", estadoEnvio: "ENVIADO", waMessageId: "wamid.eco1" });
  });

  it("usa las horas de pausa de la conexión", async () => {
    await P.fotofficeWaConexion.update({ where: { workspaceId: WS }, data: { pausaBotHoras: 1 } });
    await aplicarEventos([eco()], AHORA);
    expect(chats()[0].botPausadoHasta).toEqual(new Date(min(-1).getTime() + 3600_000));
  });

  it("'#bot' devuelve al bot y deja el mensaje de sistema", async () => {
    await aplicarEventos([entrante(), eco({ texto: "#bot" })], AHORA);
    expect(chats()[0]).toMatchObject({ estado: "BOT", botPausadoHasta: null, asignadoUserId: null });
    expect(mensajes().find((m) => m.direccion === "SISTEMA")?.texto).toBe("Devuelto al bot desde el celular");
  });

  it("eco repetido no reaplica la pausa", async () => {
    await aplicarEventos([eco()], AHORA);
    const pausa = chats()[0].botPausadoHasta;
    const r = await aplicarEventos([eco()], min(60));
    expect(r.duplicados).toBe(1);
    expect(chats()[0].botPausadoHasta).toEqual(pausa);
  });

  it("no cambia al asignado", async () => {
    await P.fotofficeWaChat.create({ data: { workspaceId: WS, waId: WA, estado: "HUMANO", asignadoUserId: 7, ultimoMensajeEn: min(-600) } });
    await aplicarEventos([eco()], AHORA);
    expect(chats()[0].asignadoUserId).toBe(7);
  });
});

describe("aplicarEventos: estados de envío", () => {
  const saliente = (estadoEnvio: string) =>
    P.fotofficeWaChat.create({ data: { workspaceId: WS, waId: WA, ultimoMensajeEn: min(-5) } }).then((c: { id: string }) =>
      P.fotofficeWaMensaje.create({
        data: { workspaceId: WS, chatId: c.id, direccion: "SALIENTE", autor: "BOT", waMessageId: "wamid.out1", estadoEnvio },
      }),
    );

  it("actualiza el estado del mensaje saliente", async () => {
    await saliente("ENVIADO");
    expect(await aplicarEventos([estado({ estado: "LEIDO" })], AHORA)).toMatchObject({ aplicados: 1 });
    expect(mensajes()[0].estadoEnvio).toBe("LEIDO");
  });

  it("un estado anterior que llega tarde no retrocede", async () => {
    await saliente("LEIDO");
    const r = await aplicarEventos([estado({ estado: "ENTREGADO" })], AHORA);
    expect(r.ignorados).toBe(1);
    expect(mensajes()[0].estadoEnvio).toBe("LEIDO");
  });

  it("fallo con código de error", async () => {
    await saliente("PENDIENTE");
    await aplicarEventos([estado({ estado: "FALLO", errorCodigo: "131047" })], AHORA);
    expect(mensajes()[0]).toMatchObject({ estadoEnvio: "FALLO", errorCodigo: "131047" });
  });

  it("mensaje desconocido o entrante: se ignora", async () => {
    expect((await aplicarEventos([estado()], AHORA)).ignorados).toBe(1);
    await aplicarEventos([entrante({ waMessageId: "wamid.out1" })], AHORA);
    expect((await aplicarEventos([estado()], AHORA)).ignorados).toBe(1);
    expect(mensajes()[0].estadoEnvio).toBe("RECIBIDO");
  });
});

describe("vínculo con el cliente (§4)", () => {
  const cliente = (id: string, phone: string | null, workspaceId = WS) =>
    P.client.create({ data: { id, workspaceId, phone, clientNumber: B.datos.client.length + 1 } });

  it("clienteDelTelefono: uno solo, aunque el teléfono esté escrito de otra forma", async () => {
    await cliente("c1", "0341 15 3419869");
    await cliente("c2", "341 5550000");
    await cliente("c3", null);
    expect(await clienteDelTelefono(WS, WA)).toBe("c1");
  });

  it("varios o ninguno: null", async () => {
    expect(await clienteDelTelefono(WS, WA)).toBeNull();
    await cliente("c1", "341 341-9869");
    await cliente("c2", "+54 9 341 3419869");
    expect(await clienteDelTelefono(WS, WA)).toBeNull();
  });

  it("no mira clientes de otro workspace", async () => {
    await cliente("c1", "341 341-9869", "w2");
    expect(await clienteDelTelefono(WS, WA)).toBeNull();
  });

  it("número de otro país: compara completo, no por los últimos 10", async () => {
    await cliente("c1", "341 341-9869");
    expect(await clienteDelTelefono(WS, "13413419869")).toBeNull();
    await cliente("c2", "+55 11 98765-4321");
    expect(await clienteDelTelefono(WS, "5511987654321")).toBe("c2");
  });

  it("el primer mensaje vincula el chat; si después aparece el cliente, el siguiente lo vincula", async () => {
    await aplicarEventos([entrante()], AHORA);
    expect(chats()[0].clientId).toBeNull();
    await cliente("c1", "341 341-9869");
    await aplicarEventos([entrante({ waMessageId: "wamid.2" })], AHORA);
    expect(chats()[0].clientId).toBe("c1");
  });

  it("chat nuevo con cliente existente nace vinculado", async () => {
    await cliente("c1", "341 341-9869");
    await aplicarEventos([entrante()], AHORA);
    expect(chats()[0].clientId).toBe("c1");
  });
});
