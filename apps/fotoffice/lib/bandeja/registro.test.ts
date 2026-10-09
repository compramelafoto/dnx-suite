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
  await P.fotofficeWaConexion.create({ data: { workspaceId: WS, phoneNumberId: PNID, modo: "REAL" } });
});

describe("aplicarEventos: entrantes", () => {
  it("crea el chat con nombre, no leído, hora y el mensaje", async () => {
    const r = await aplicarEventos([entrante()], AHORA);
    expect(r).toEqual({ aplicados: 1, duplicados: 0, ignorados: 0, fallidos: 0 });
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
    expect(r).toEqual({ aplicados: 0, duplicados: 1, ignorados: 0, fallidos: 0 });
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
    expect(r).toEqual({ aplicados: 0, duplicados: 0, ignorados: 1, fallidos: 0 });
    expect(chats()).toHaveLength(0);
  });

  it("una conexión SIMULADA no recibe eventos por phoneNumberId (no puede apropiarse de un número)", async () => {
    B.datos.fotofficeWaConexion[0].modo = "SIMULADO";
    const r = await aplicarEventos([entrante()], AHORA);
    expect(r).toEqual({ aplicados: 0, duplicados: 0, ignorados: 1, fallidos: 0 });
    expect(chats()).toHaveLength(0);
    // El simulador de Configuración sí entra, por workspaceId.
    expect(await aplicarEventos([entrante()], AHORA, { workspaceId: WS })).toMatchObject({ aplicados: 1 });
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
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await aplicarEventos([entrante()], AHORA)).toMatchObject({ aplicados: 0, fallidos: 1 });
    } finally {
      B.tablas.fotofficeWaMensaje.create = original;
      log.mockRestore();
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

  it("estado de un mensaje desconocido y reciente (< 5 min): fallido, para que Meta reintente", async () => {
    expect(await aplicarEventos([estado({ en: min(-1) })], AHORA)).toEqual({ aplicados: 0, duplicados: 0, ignorados: 0, fallidos: 1 });
  });

  it("estado desconocido con hora ilegible o muy en el futuro: se ignora, no se reintenta", async () => {
    expect(await aplicarEventos([estado({ en: null })], AHORA)).toMatchObject({ ignorados: 1, fallidos: 0 });
    expect(await aplicarEventos([estado({ en: min(30) })], AHORA)).toMatchObject({ ignorados: 1, fallidos: 0 });
  });

  it("estado de un mensaje desconocido y viejo (>= 5 min): se ignora", async () => {
    expect(await aplicarEventos([estado({ en: min(-6) })], AHORA)).toEqual({ aplicados: 0, duplicados: 0, ignorados: 1, fallidos: 0 });
  });

  it("mensaje entrante con ese id: el estado se ignora", async () => {
    await aplicarEventos([entrante({ waMessageId: "wamid.out1" })], AHORA);
    expect((await aplicarEventos([estado()], AHORA)).ignorados).toBe(1);
    expect(mensajes()[0].estadoEnvio).toBe("RECIBIDO");
  });
});

describe("concurrencia", () => {
  const sembrar = (p: Record<string, unknown> = {}) =>
    P.fotofficeWaChat.create({ data: { workspaceId: WS, waId: WA, ultimoMensajeEn: min(-30), ...p } });

  it("chat existente: toma el candado de fila (FOR UPDATE) y suma no leídos con increment", async () => {
    await sembrar({ noLeidos: 2 });
    B.sql.length = 0;
    await aplicarEventos([entrante()], AHORA);
    expect(B.sql.some((q) => q.texto.includes("FOR UPDATE") && q.texto.includes("FotofficeWaChat"))).toBe(true);
    expect(chats()[0].noLeidos).toBe(3);
  });

  it("un 'Tomar' del panel que gana el candado no se pisa: se relee el chat antes de las reglas", async () => {
    const c = await sembrar({ estado: "RESUELTO" });
    // Al tomar el candado, el panel ya había tomado el chat (asignado 7, HUMANO).
    B.ganchos.alEjecutarSql = (texto) => {
      if (texto.includes("FOR UPDATE")) B.datos.fotofficeWaChat.find((x) => x.id === c.id)!.estado = "HUMANO";
      if (texto.includes("FOR UPDATE")) B.datos.fotofficeWaChat.find((x) => x.id === c.id)!.asignadoUserId = 7;
    };
    try {
      await aplicarEventos([entrante()], AHORA);
    } finally {
      B.ganchos.alEjecutarSql = null;
    }
    expect(chats()[0]).toMatchObject({ estado: "HUMANO", asignadoUserId: 7 });
    expect(mensajes().filter((m) => m.direccion === "SISTEMA")).toHaveLength(0);
  });

  it("carrera al crear el chat: el otro lo creó primero, el mensaje se guarda una sola vez y no se pierde", async () => {
    const original = B.tablas.fotofficeWaChat.create;
    let fallo = true;
    B.tablas.fotofficeWaChat.create = async (a) => {
      if (fallo) {
        fallo = false;
        B.agregarDeOtraTransaccion("fotofficeWaChat", { workspaceId: WS, waId: WA, ultimoMensajeEn: min(-2), noLeidos: 1 });
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      }
      return original(a);
    };
    try {
      const r = await aplicarEventos([entrante()], AHORA);
      expect(r).toMatchObject({ aplicados: 1, fallidos: 0 });
    } finally {
      B.tablas.fotofficeWaChat.create = original;
    }
    expect(chats()).toHaveLength(1);
    expect(mensajes().filter((m) => m.waMessageId === "wamid.1")).toHaveLength(1);
    expect(chats()[0].noLeidos).toBe(2);
  });
});

describe("aislamiento de fallos por evento", () => {
  it("un evento que falla no frena al resto y se informa en fallidos (log sin datos personales)", async () => {
    const original = B.tablas.fotofficeWaMensaje.create;
    B.tablas.fotofficeWaMensaje.create = async (a) => {
      if ((a.data as { waMessageId?: string }).waMessageId === "wamid.malo") throw new Error("boom: hola 5493413419869");
      return original(a);
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await aplicarEventos([entrante({ waMessageId: "wamid.malo" }), entrante({ waMessageId: "wamid.bueno", waId: "5493415550000" })], AHORA);
      expect(r).toMatchObject({ aplicados: 1, fallidos: 1 });
    } finally {
      B.tablas.fotofficeWaMensaje.create = original;
    }
    const registrado = JSON.stringify(log.mock.calls);
    log.mockRestore();
    expect(mensajes().map((m) => m.waMessageId)).toEqual(["wamid.bueno"]);
    expect(registrado).toContain('"indice":0');
    expect(registrado).not.toContain("5493413419869");
  });
});

describe("ECO sobre un chat resuelto", () => {
  it("lo reabre como HUMANO y deja el mensaje de sistema", async () => {
    await P.fotofficeWaChat.create({ data: { workspaceId: WS, waId: WA, estado: "RESUELTO", ultimoMensajeEn: min(-60) } });
    await aplicarEventos([eco()], AHORA);
    expect(chats()[0].estado).toBe("HUMANO");
    expect(mensajes().some((m) => m.texto === "Se reabrió desde el celular")).toBe(true);
  });
});

describe("estados de envío: nunca retroceden", () => {
  const saliente = async (estadoEnvio: string) => {
    const c = await P.fotofficeWaChat.create({ data: { workspaceId: WS, waId: WA, ultimoMensajeEn: min(-5) } });
    await P.fotofficeWaMensaje.create({
      data: { workspaceId: WS, chatId: c.id, direccion: "SALIENTE", autor: "BOT", waMessageId: "wamid.out1", estadoEnvio },
    });
  };

  it("el where del updateMany protege de una carrera: si otro aviso ya lo pasó a LEIDO, ENTREGADO no lo pisa", async () => {
    await saliente("ENVIADO");
    const original = B.tablas.fotofficeWaMensaje.updateMany;
    B.tablas.fotofficeWaMensaje.updateMany = async (a) => {
      mensajes()[0].estadoEnvio = "LEIDO"; // el aviso "read" se aplicó entre la lectura y la escritura
      return original(a);
    };
    try {
      const r = await aplicarEventos([estado({ estado: "ENTREGADO" })], AHORA);
      expect(r.ignorados).toBe(1);
    } finally {
      B.tablas.fotofficeWaMensaje.updateMany = original;
    }
    expect(mensajes()[0].estadoEnvio).toBe("LEIDO");
  });

  it("FALLO es terminal: no lo pisa un estado posterior", async () => {
    await saliente("PENDIENTE");
    await aplicarEventos([estado({ estado: "FALLO", errorCodigo: "131047" })], AHORA);
    expect((await aplicarEventos([estado({ estado: "LEIDO" })], AHORA)).ignorados).toBe(1);
    expect((await aplicarEventos([estado({ estado: "ENVIADO" })], AHORA)).ignorados).toBe(1);
    expect(mensajes()[0]).toMatchObject({ estadoEnvio: "FALLO", errorCodigo: "131047" });
  });

  it("un FALLO tardío no pisa un mensaje ya entregado", async () => {
    await saliente("ENTREGADO");
    expect((await aplicarEventos([estado({ estado: "FALLO", errorCodigo: "1" })], AHORA)).ignorados).toBe(1);
    expect(mensajes()[0].estadoEnvio).toBe("ENTREGADO");
  });

  it("estado de un mensaje desconocido: avisa en el log sólo con el código", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await aplicarEventos([estado({ waMessageId: "wamid.nadie", estado: "FALLO", errorCodigo: "131026" })], AHORA);
    } finally {
      // (se lee antes de restaurar)
    }
    const registrado = JSON.stringify(aviso.mock.calls);
    aviso.mockRestore();
    expect(registrado).toContain("131026");
    expect(registrado).not.toContain("wamid.nadie");
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

describe("vista previa del chat", () => {
  it("el entrante crea el chat con su vista previa y el siguiente la actualiza", async () => {
    await aplicarEventos([entrante({ texto: "hola" })], AHORA);
    expect(chats()[0]).toMatchObject({ ultimoMensajeTexto: "hola", ultimoMensajeTipo: "TEXTO" });
    await aplicarEventos([entrante({ waMessageId: "wamid.2", en: min(-0.5), texto: "x".repeat(300) })], AHORA);
    expect(chats()[0].ultimoMensajeTexto).toHaveLength(120);
  });

  it("una imagen sin texto deja el tipo", async () => {
    await aplicarEventos([entrante({ mensajeTipo: "IMAGEN", texto: null })], AHORA);
    expect(chats()[0]).toMatchObject({ ultimoMensajeTexto: null, ultimoMensajeTipo: "IMAGEN" });
  });

  it("el eco también actualiza la vista previa", async () => {
    await aplicarEventos([entrante({ en: min(-5) })], AHORA);
    await aplicarEventos([eco({ en: min(-1), texto: "ya te contesto" })], AHORA);
    expect(chats()[0].ultimoMensajeTexto).toBe("ya te contesto");
  });

  it("un mensaje viejo que llega tarde no pisa la vista previa, ni el de sistema", async () => {
    await aplicarEventos([entrante({ en: min(-1), texto: "nuevo" })], AHORA);
    await aplicarEventos([entrante({ waMessageId: "wamid.viejo", en: min(-30), texto: "viejo" })], AHORA);
    expect(chats()[0].ultimoMensajeTexto).toBe("nuevo");
    await P.fotofficeWaChat.update({ where: { id: chats()[0].id }, data: { estado: "RESUELTO" } });
    await aplicarEventos([entrante({ waMessageId: "wamid.3", en: min(-0.5), texto: "volví" })], AHORA);
    expect(mensajes().some((m) => m.autor === "SISTEMA")).toBe(true);
    expect(chats()[0].ultimoMensajeTexto).toBe("volví");
  });
});
