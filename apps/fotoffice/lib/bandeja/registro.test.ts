import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventoWa } from "./webhook";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
const perfil = vi.hoisted(() => ({ fn: vi.fn(async () => ({ nombre: "Lucía Gómez" as string | null, usuario: "luciag" as string | null })) }));
vi.mock("./instagram/perfil", () => ({ perfilInstagram: perfil.fn }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;

const { aplicarEventos, clienteDelTelefono } = await import("./registro");
const { META_APP_ID } = await import("./coexistencia");

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
    expect(r).toEqual({ aplicados: 1, duplicados: 0, ignorados: 0, fallidos: 0, paraElBot: [chats()[0].id], medios: [], paraTelegram: [] });
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

  it("una imagen del cliente entra en medios (para bajarla); repetida, eco o texto no", async () => {
    const foto = entrante({ mensajeTipo: "IMAGEN", texto: null, media: { id: "9", mimeType: "image/jpeg" } });
    const r = await aplicarEventos([foto, entrante({ waMessageId: "wamid.2" })], AHORA);
    expect(r.medios).toEqual([mensajes()[0].id]);
    expect((await aplicarEventos([foto], AHORA)).medios).toEqual([]);
    const r2 = await aplicarEventos([eco({ mensajeTipo: "IMAGEN", texto: null, media: { id: "10", mimeType: "image/jpeg" } })], AHORA);
    expect(r2.medios).toEqual([]);
  });

  it("idempotente: el mismo waMessageId no duplica ni vuelve a sumar", async () => {
    await aplicarEventos([entrante()], AHORA);
    const r = await aplicarEventos([entrante()], AHORA);
    expect(r).toEqual({ aplicados: 0, duplicados: 1, ignorados: 0, fallidos: 0, paraElBot: [], medios: [], paraTelegram: [] });
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
    expect(r).toEqual({ aplicados: 0, duplicados: 0, ignorados: 1, fallidos: 0, paraElBot: [], medios: [], paraTelegram: [] });
    expect(chats()).toHaveLength(0);
  });

  it("una conexión SIMULADA no recibe eventos por phoneNumberId (no puede apropiarse de un número)", async () => {
    B.datos.fotofficeWaConexion[0].modo = "SIMULADO";
    const r = await aplicarEventos([entrante()], AHORA);
    expect(r).toEqual({ aplicados: 0, duplicados: 0, ignorados: 1, fallidos: 0, paraElBot: [], medios: [], paraTelegram: [] });
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
    expect(await aplicarEventos([estado({ en: min(-1) })], AHORA)).toEqual({ aplicados: 0, duplicados: 0, ignorados: 0, fallidos: 1, paraElBot: [], medios: [], paraTelegram: [] });
  });

  it("estado desconocido con hora ilegible o muy en el futuro: se ignora, no se reintenta", async () => {
    expect(await aplicarEventos([estado({ en: null })], AHORA)).toMatchObject({ ignorados: 1, fallidos: 0 });
    expect(await aplicarEventos([estado({ en: min(30) })], AHORA)).toMatchObject({ ignorados: 1, fallidos: 0 });
  });

  it("estado de un mensaje desconocido y viejo (>= 5 min): se ignora", async () => {
    expect(await aplicarEventos([estado({ en: min(-6) })], AHORA)).toEqual({ aplicados: 0, duplicados: 0, ignorados: 1, fallidos: 0, paraElBot: [], medios: [], paraTelegram: [] });
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

  it("pide a la base sólo los candidatos por los últimos 6 dígitos", async () => {
    await cliente("c1", "0341 15 3419869");
    B.sql.length = 0;
    expect(await clienteDelTelefono(WS, WA)).toBe("c1");
    const consulta = B.sql.find((q: { texto: string }) => q.texto.includes("clientes-por-telefono"));
    expect(consulta?.valores).toEqual([WS, "419869"]);
  });

  it("con un waId de menos de 6 dígitos no consulta la base", async () => {
    B.sql.length = 0;
    expect(await clienteDelTelefono(WS, "12345")).toBeNull();
    expect(B.sql).toHaveLength(0);
  });

  it("un número de otro país con los mismos 6 dígitos finales no se vincula", async () => {
    await cliente("c1", "+1 555 341 9869");
    expect(await clienteDelTelefono(WS, WA)).toBeNull();
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

describe("chats para el bot (etapa 3a)", () => {
  it("un mensaje del cliente a un chat del bot lo marca para el bot", async () => {
    const r = await aplicarEventos([entrante()], AHORA);
    expect(r.paraElBot).toEqual([chats()[0].id]);
  });

  it("un eco del celular o un chat tomado por una persona no", async () => {
    await aplicarEventos([entrante()], AHORA);
    expect((await aplicarEventos([eco()], AHORA)).paraElBot).toEqual([]);
    await P.fotofficeWaChat.update({ where: { id: chats()[0].id }, data: { estado: "HUMANO", asignadoUserId: 4 } });
    expect((await aplicarEventos([entrante({ waMessageId: "wamid.9" })], AHORA)).paraElBot).toEqual([]);
  });

  it("un mensaje repetido no se marca dos veces", async () => {
    await aplicarEventos([entrante()], AHORA);
    expect((await aplicarEventos([entrante()], AHORA)).paraElBot).toEqual([]);
  });
});

describe("mismo waId en dos canales", () => {
  it("un entrante de WhatsApp con los mismos dígitos que un IGSID crea otro chat y la búsqueda por teléfono no ve el de Instagram", async () => {
    await P.fotofficeWaChat.create({
      data: { workspaceId: WS, canal: "INSTAGRAM", waId: WA, usuarioInstagram: "lucia", ultimoMensajeEn: min(-5), ultimoEntranteEn: min(-5) },
    });
    const { estadoWhatsappDe } = await import("./aviso-sistema");
    // Sólo existe el chat de Instagram: para WhatsApp no hay ventana abierta.
    expect((await estadoWhatsappDe(WS, WA, AHORA)).ventanaAbierta).toBe(false);

    await aplicarEventos([entrante()], AHORA);
    expect(chats()).toHaveLength(2);
    const ig = chats().find((c) => c.canal === "INSTAGRAM");
    const wa = chats().find((c) => c.canal === "WHATSAPP");
    expect(ig).toMatchObject({ waId: WA, usuarioInstagram: "lucia", noLeidos: 0 });
    expect(wa).toMatchObject({ waId: WA, noLeidos: 1 });
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0].chatId).toBe(wa?.id);
  });
});

describe("Instagram", () => {
  const IG = "17841400000000001";
  const IGSID = "5550001";
  const igEntrante = (p: Partial<Extract<EventoWa, { tipo: "ENTRANTE" }>> = {}): EventoWa =>
    entrante({ canal: "INSTAGRAM", phoneNumberId: IG, waId: IGSID, nombre: null, waMessageId: "m_1", ...p });
  const igEco = (p: Partial<Extract<EventoWa, { tipo: "ECO" }>> = {}): EventoWa =>
    eco({ canal: "INSTAGRAM", phoneNumberId: IG, waId: IGSID, waMessageId: "m_eco1", ...p });
  const conectar = (extra: Record<string, unknown> = {}) => Object.assign(B.datos.fotofficeWaConexion[0], { igAccountId: IG, igPageId: "pg1", igActivo: true, ...extra });

  beforeEach(() => {
    conectar();
    perfil.fn.mockClear();
    perfil.fn.mockImplementation(async () => ({ nombre: "Lucía Gómez", usuario: "luciag" }));
  });

  /** Chat de Instagram con una respuesta del bot que todavía no guardó su `mid`. */
  async function conRespuestaDelBot(texto: string, hace: number, extra: Record<string, unknown> = {}) {
    await aplicarEventos([igEntrante({ en: min(-5) })], AHORA);
    const chat = chats()[0];
    await P.fotofficeWaMensaje.create({
      data: {
        workspaceId: WS, chatId: chat.id, direccion: "SALIENTE", autor: "BOT", estadoEnvio: "PENDIENTE",
        tipo: "TEXTO", texto, waMessageId: null, createdAt: new Date(AHORA.getTime() - hace * 1000), ...extra,
      },
    });
    return chat;
  }

  it("un entrante crea el chat de Instagram con el perfil y sin buscar cliente por teléfono", async () => {
    await P.client.create({ data: { id: "c1", workspaceId: WS, phone: "555-0001" } });
    B.sql.length = 0;
    const r = await aplicarEventos([igEntrante()], AHORA);
    expect(r).toMatchObject({ aplicados: 1, ignorados: 0, paraElBot: [chats()[0].id] });
    expect(chats()[0]).toMatchObject({ workspaceId: WS, canal: "INSTAGRAM", waId: IGSID, clientId: null, nombre: "Lucía Gómez", usuarioInstagram: "luciag", noLeidos: 1 });
    expect(perfil.fn).toHaveBeenCalledWith(WS, IGSID);
    expect(B.sql.some((q: { texto: string }) => q.texto.includes("clientes-por-telefono"))).toBe(false);
    // El segundo mensaje no vuelve a pedir el perfil ni busca por teléfono.
    await aplicarEventos([igEntrante({ waMessageId: "m_2" })], AHORA);
    expect(perfil.fn).toHaveBeenCalledTimes(1);
    expect(B.sql.some((q: { texto: string }) => q.texto.includes("clientes-por-telefono"))).toBe(false);
    expect(chats()[0]).toMatchObject({ clientId: null, nombre: "Lucía Gómez", noLeidos: 2 });
  });

  it("perfil sin nombre usa @usuario; perfil que falla no frena el registro", async () => {
    perfil.fn.mockImplementation(async () => ({ nombre: null, usuario: "luciag" }));
    await aplicarEventos([igEntrante()], AHORA);
    expect(chats()[0]).toMatchObject({ nombre: "@luciag", usuarioInstagram: "luciag" });

    B.datos.fotofficeWaChat.length = 0;
    B.datos.fotofficeWaMensaje.length = 0;
    perfil.fn.mockImplementation(async () => { throw new Error("Graph caído"); });
    const r = await aplicarEventos([igEntrante({ waMessageId: "m_9" })], AHORA);
    expect(r).toMatchObject({ aplicados: 1, fallidos: 0 });
    expect(chats()[0]).toMatchObject({ canal: "INSTAGRAM", nombre: null, usuarioInstagram: null });
  });

  it("eco propio sin mid todavía: le asigna el mid a la respuesta del bot, no crea mensaje y no pausa al bot", async () => {
    const chat = await conRespuestaDelBot("¡Hola! ¿Para qué fecha?", 30);
    const r = await aplicarEventos([igEco({ texto: "¡Hola! ¿Para qué fecha?" })], AHORA);
    expect(r).toMatchObject({ aplicados: 0, duplicados: 1 });
    expect(mensajes()).toHaveLength(2);
    expect(mensajes()[1]).toMatchObject({ autor: "BOT", waMessageId: "m_eco1" });
    expect(mensajes().some((m) => m.autor === "CELULAR")).toBe(false);
    expect(chats()[0]).toMatchObject({ id: chat.id, estado: "BOT", botPausadoHasta: null });
    // Reintento de Meta del mismo eco: duplicado por waMessageId.
    expect(await aplicarEventos([igEco({ texto: "¡Hola! ¿Para qué fecha?" })], AHORA)).toMatchObject({ duplicados: 1 });
    expect(mensajes()).toHaveLength(2);
  });

  it("respuesta larga del bot partida en 3: sus 3 ecos no crean CELULAR ni pausan al bot", async () => {
    const { partirPorBytes } = await import("./instagram/partir");
    let texto = "";
    while (Buffer.byteLength(texto) < 2500) texto += "foto 📸 casamiento ";
    texto = texto.trim();
    const partes = partirPorBytes(texto);
    expect(partes).toHaveLength(3);
    const chat = await conRespuestaDelBot(texto, 20);
    for (const [i, parte] of partes.entries()) {
      expect(await aplicarEventos([igEco({ waMessageId: `m_p${i + 1}`, texto: parte })], AHORA)).toMatchObject({ aplicados: 0, duplicados: 1 });
    }
    expect(mensajes()).toHaveLength(2);
    expect(mensajes().some((m) => m.autor === "CELULAR")).toBe(false);
    // El mid sólo se asigna si la fila no tenía: queda el del primer eco.
    expect(mensajes()[1]).toMatchObject({ autor: "BOT", waMessageId: "m_p1" });
    expect(chats()[0]).toMatchObject({ id: chat.id, estado: "BOT", botPausadoHasta: null });
  });

  it("ecos recortados (sin el espacio final de cada parte, o del texto completo) también son propios", async () => {
    const { partirPorBytes } = await import("./instagram/partir");
    let texto = "";
    while (Buffer.byteLength(texto) < 2500) texto += "foto 📸 casamiento ";
    const partes = partirPorBytes(texto.trim());
    expect(partes.slice(0, -1).every((p) => /\s$/.test(p))).toBe(true);
    await conRespuestaDelBot(texto.trim(), 20);
    for (const [i, parte] of partes.entries()) {
      expect(await aplicarEventos([igEco({ waMessageId: `m_r${i + 1}`, texto: parte.trim() })], AHORA)).toMatchObject({ aplicados: 0, duplicados: 1 });
    }
    expect(mensajes().some((m) => m.autor === "CELULAR")).toBe(false);
    expect(chats()[0]).toMatchObject({ estado: "BOT", botPausadoHasta: null });

    // Texto corto guardado con espacios al final: el eco recortado igual es propio.
    B.datos.fotofficeWaChat.length = 0;
    B.datos.fotofficeWaMensaje.length = 0;
    await conRespuestaDelBot("listo  \n", 10);
    expect(await aplicarEventos([igEco({ waMessageId: "m_corto", texto: "listo" })], AHORA)).toMatchObject({ duplicados: 1 });
    expect(mensajes()[1]).toMatchObject({ autor: "BOT", waMessageId: "m_corto" });
  });

  it("un eco corto igual a una respuesta que ya tiene su mid sigue siendo ajeno", async () => {
    await conRespuestaDelBot("listo", 10, { estadoEnvio: "ENVIADO", waMessageId: "m_ya" });
    expect(await aplicarEventos([igEco({ texto: "listo" })], AHORA)).toMatchObject({ aplicados: 1 });
    expect(mensajes().some((m) => m.autor === "CELULAR")).toBe(true);
  });

  it("eco propio también si el envío ya quedó ENVIADO sin mid", async () => {
    await conRespuestaDelBot("listo", 10, { estadoEnvio: "ENVIADO" });
    expect(await aplicarEventos([igEco({ texto: "listo" })], AHORA)).toMatchObject({ duplicados: 1 });
    expect(mensajes()[1].waMessageId).toBe("m_eco1");
  });

  it("eco con media.appId igual a META_APP_ID (el de coexistencia.ts): propio", async () => {
    await aplicarEventos([igEntrante({ en: min(-5) })], AHORA);
    const r = await aplicarEventos([igEco({ texto: "otro texto", media: { appId: META_APP_ID } })], AHORA);
    expect(r).toMatchObject({ aplicados: 0, duplicados: 1 });
    expect(mensajes()).toHaveLength(1);
    expect(chats()[0]).toMatchObject({ estado: "BOT", botPausadoHasta: null });
  });

  it("eco ajeno: autor CELULAR y pausa al bot (como WhatsApp)", async () => {
    // Texto distinto, respuesta vieja (más de MINUTOS_PENDIENTE_INCIERTO) y otra app: nada lo hace propio.
    await conRespuestaDelBot("ya te contesto", 30);
    await P.fotofficeWaMensaje.create({
      data: { workspaceId: WS, chatId: chats()[0].id, direccion: "SALIENTE", autor: "BOT", estadoEnvio: "PENDIENTE", tipo: "TEXTO", texto: "te escribo desde el celu", waMessageId: null, createdAt: min(-10) },
    });
    const r = await aplicarEventos([igEco({ texto: "te escribo desde el celu", media: { appId: "999" } })], AHORA);
    expect(r).toMatchObject({ aplicados: 1, duplicados: 0 });
    const celular = mensajes().find((m) => m.autor === "CELULAR");
    expect(celular).toMatchObject({ direccion: "SALIENTE", waMessageId: "m_eco1" });
    expect(chats()[0].botPausadoHasta).not.toBeNull();
    expect(mensajes().filter((m) => m.autor === "BOT").every((m) => m.waMessageId === null)).toBe(true);
  });

  it("un eco de WhatsApp con el mismo texto que una respuesta pendiente sigue siendo del celular", async () => {
    await aplicarEventos([entrante({ en: min(-5) })], AHORA);
    await P.fotofficeWaMensaje.create({
      data: { workspaceId: WS, chatId: chats()[0].id, direccion: "SALIENTE", autor: "BOT", estadoEnvio: "PENDIENTE", tipo: "TEXTO", texto: "ya te contesto", waMessageId: null, createdAt: new Date(AHORA.getTime() - 30_000) },
    });
    const r = await aplicarEventos([eco({ texto: "ya te contesto" })], AHORA);
    expect(r).toMatchObject({ aplicados: 1 });
    expect(mensajes().some((m) => m.autor === "CELULAR")).toBe(true);
  });

  it("cuenta desconocida: igAccountId sin conexión, SIMULADA o apagada → ignorado", async () => {
    expect(await aplicarEventos([igEntrante({ phoneNumberId: "999" })], AHORA)).toMatchObject({ ignorados: 1, aplicados: 0 });
    conectar({ modo: "SIMULADO" });
    expect(await aplicarEventos([igEntrante()], AHORA)).toMatchObject({ ignorados: 1, aplicados: 0 });
    conectar({ modo: "REAL", igActivo: false });
    expect(await aplicarEventos([igEntrante()], AHORA)).toMatchObject({ ignorados: 1, aplicados: 0 });
    expect(chats()).toHaveLength(0);
  });

  it("el id de la cuenta de Instagram no se confunde con un phoneNumberId", async () => {
    // Un evento de WhatsApp cuyo phoneNumberId coincide con el igAccountId no encuentra la conexión.
    expect(await aplicarEventos([entrante({ phoneNumberId: IG })], AHORA)).toMatchObject({ ignorados: 1 });
    // Y en el mismo lote, Instagram sí (no se mezcla la memoria de conexiones).
    expect(await aplicarEventos([entrante({ phoneNumberId: IG }), igEntrante()], AHORA)).toMatchObject({ ignorados: 1, aplicados: 1 });
  });

  it("una foto del cliente por Instagram entra en medios", async () => {
    const r = await aplicarEventos([igEntrante({ mensajeTipo: "IMAGEN", texto: null, media: { url: "https://scontent.cdninstagram.com/x.jpg" } })], AHORA);
    expect(r.medios).toEqual([mensajes()[0].id]);
  });
});

describe("aplicarEventos: reenvío a Telegram", () => {
  it("un entrante en un chat que atiende una persona queda para Telegram; uno del bot, no", async () => {
    await P.fotofficeWaChat.create({ data: { workspaceId: WS, waId: WA, estado: "HUMANO", asignadoUserId: 4, ultimoMensajeEn: min(-10) } });
    await P.fotofficeWaChat.create({ data: { workspaceId: WS, waId: "5493410000001", estado: "BOT", ultimoMensajeEn: min(-10) } });
    const r = await aplicarEventos([entrante(), entrante({ waId: "5493410000001", waMessageId: "wamid.2" })], AHORA);
    const humano = chats().find((c) => c.waId === WA)!;
    const delMensaje = mensajes().find((m) => m.waMessageId === "wamid.1")!;
    expect(r.paraTelegram).toEqual([{ workspaceId: WS, chatId: humano.id, mensajeId: delMensaje.id }]);
  });
});
