import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ leerTokenWhatsapp: vi.fn(async () => null), hayTokenWhatsapp: vi.fn(), guardarTokenWhatsapp: vi.fn() }));

const A = await import("./acciones");
const { estadoVisible } = await import("./reglas");

const AHORA = new Date("2026-10-09T15:00:00.000Z");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);
const WA = "5493413419869";

const ctxDe = (userId: number, label: string, levels: Record<string, "VIEW" | "MANAGE" | "NONE">, workspaceId = "w1") => ({
  workspaceId, userId, userLabel: label, role: "STAFF", acceso: { role: "STAFF", levels } as never,
});
const ANA = ctxDe(2, "Ana", { "whatsapp-inbox": "MANAGE", clients: "MANAGE" });
const LEO = ctxDe(3, "Leo", { "whatsapp-inbox": "VIEW", clients: "VIEW" });
const OTRA_INSTITUCION = ctxDe(2, "Ana", { "whatsapp-inbox": "MANAGE", clients: "MANAGE" }, "w2");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;
const chats = () => B.datos.fotofficeWaChat;
const mensajes = () => B.datos.fotofficeWaMensaje;
const conexionReal = { workspaceId: "w1", modo: "REAL", phoneNumberId: "123" };

async function chatNuevo(p: Record<string, unknown> = {}) {
  return (await P.fotofficeWaChat.create({
    data: { workspaceId: "w1", waId: WA, ultimoMensajeEn: hace(1), ultimoEntranteEn: hace(1), noLeidos: 2, ...p },
  })) as { id: string };
}

beforeEach(() => {
  B.vaciar();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("permisos", () => {
  it("con sólo Ver no se puede responder, tomar, devolver, resolver ni vincular, pero sí marcar leído", async () => {
    const { id } = await chatNuevo();
    const sin = { ok: false, error: "No tenés permiso para hacer esto." };
    expect(await A.responder(LEO, id, "hola", "tok-1", { ahora: AHORA })).toEqual(sin);
    expect(await A.tomar(LEO, id)).toEqual(sin);
    expect(await A.devolverAlBot(LEO, id)).toEqual(sin);
    expect(await A.resolver(LEO, id)).toEqual(sin);
    expect(await A.vincularCliente(LEO, id, "c1")).toEqual(sin);
    expect(await A.crearContactoDesdeChat(LEO, id)).toEqual(sin);
    expect(chats()[0]).toMatchObject({ estado: "BOT", noLeidos: 2 });
    expect(mensajes()).toHaveLength(0);
    expect(await A.marcarLeido(LEO, id)).toEqual({ ok: true });
    expect(chats()[0].noLeidos).toBe(0);
  });

  it("sin nivel en el módulo ni siquiera marca leído", async () => {
    const { id } = await chatNuevo();
    expect(await A.marcarLeido(ctxDe(4, "Nadie", {}), id)).toMatchObject({ ok: false });
  });

  it("otra institución no ve ni toca el chat (todas las acciones)", async () => {
    const { id } = await chatNuevo();
    B.agregar("client", { id: "c-w1", workspaceId: "w1", firstName: "Lu" });
    const noExiste = { ok: false, error: "No encontramos ese chat." };
    expect(await A.responder(OTRA_INSTITUCION, id, "hola", "tok-1", { ahora: AHORA })).toEqual(noExiste);
    expect(await A.tomar(OTRA_INSTITUCION, id)).toEqual(noExiste);
    expect(await A.devolverAlBot(OTRA_INSTITUCION, id)).toEqual(noExiste);
    expect(await A.resolver(OTRA_INSTITUCION, id)).toEqual(noExiste);
    expect(await A.marcarLeido(OTRA_INSTITUCION, id)).toEqual(noExiste);
    expect(await A.crearContactoDesdeChat(OTRA_INSTITUCION, id)).toEqual(noExiste);
    expect(await A.vincularCliente(OTRA_INSTITUCION, id, "c-w1")).toMatchObject({ ok: false });
    expect(chats()[0]).toMatchObject({ estado: "BOT", noLeidos: 2, clientId: null });
    expect(mensajes()).toHaveLength(0);
  });
});

describe("tomar, devolver, resolver", () => {
  it("tomar: HUMANO asignado a quien toma, con candado de fila y mensaje SISTEMA", async () => {
    const { id } = await chatNuevo();
    expect(await A.tomar(ANA, id, { ahora: AHORA })).toEqual({ ok: true });
    expect(chats()[0]).toMatchObject({ estado: "HUMANO", asignadoUserId: 2, botPausadoHasta: null });
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ direccion: "SISTEMA", autor: "SISTEMA", texto: "Ana tomó el chat", createdAt: AHORA });
    expect(B.sql.some((s) => s.texto.includes('FOR UPDATE'))).toBe(true);
  });

  it("tomar dos veces no repite el aviso", async () => {
    const { id } = await chatNuevo();
    await A.tomar(ANA, id, { ahora: AHORA });
    await A.tomar(ANA, id, { ahora: AHORA });
    expect(mensajes()).toHaveLength(1);
  });

  it("devolver al bot y resolver dejan su aviso; repetirlos no", async () => {
    const { id } = await chatNuevo({ estado: "HUMANO", asignadoUserId: 2 });
    await A.devolverAlBot(ANA, id, { ahora: AHORA });
    expect(chats()[0]).toMatchObject({ estado: "BOT", asignadoUserId: null });
    await A.devolverAlBot(ANA, id, { ahora: AHORA });
    await A.resolver(ANA, id, { ahora: AHORA });
    await A.resolver(ANA, id, { ahora: AHORA });
    expect(chats()[0].estado).toBe("RESUELTO");
    expect(mensajes().map((m) => m.texto)).toEqual(["Ana devolvió el chat al bot", "Ana marcó el chat como resuelto"]);
  });
});

describe("responder", () => {
  it("fuera de las 24 h no envía ni escribe nada", async () => {
    const { id } = await chatNuevo({ ultimoEntranteEn: hace(25) });
    const enviar = vi.fn();
    const r = await A.responder(ANA, id, "hola", "tok-1", { ahora: AHORA, enviar });
    expect(r).toEqual({ ok: false, error: "Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp sólo permite responder con una plantilla aprobada." });
    expect(enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
    expect(chats()[0].estado).toBe("BOT");
  });

  it("un chat sin mensajes del cliente tampoco admite texto libre", async () => {
    const { id } = await chatNuevo({ ultimoEntranteEn: null });
    expect(await A.responder(ANA, id, "hola", "tok-1", { ahora: AHORA })).toMatchObject({ ok: false });
  });

  it("texto vacío o de más de 4096 caracteres se rechaza", async () => {
    const { id } = await chatNuevo();
    expect(await A.responder(ANA, id, "   ", "tok-1", { ahora: AHORA })).toMatchObject({ ok: false });
    expect(await A.responder(ANA, id, "a".repeat(4097), "tok-1", { ahora: AHORA })).toMatchObject({ ok: false });
    expect(await A.responder(ANA, id, 42, "tok-1", { ahora: AHORA })).toMatchObject({ ok: false });
    expect(mensajes()).toHaveLength(0);
  });

  it("sin haber tomado el chat lo toma (SISTEMA) y deja el mensaje con su autor; simulado", async () => {
    const { id } = await chatNuevo();
    const r = await A.responder(ANA, id, "  Hola Lucía  ", "tok-1", { ahora: AHORA });
    expect(r).toMatchObject({ ok: true, estadoEnvio: "SIMULADO" });
    expect(chats()[0]).toMatchObject({ estado: "HUMANO", asignadoUserId: 2, noLeidos: 0 });
    const [sistema, saliente] = mensajes();
    expect(sistema).toMatchObject({ direccion: "SISTEMA", texto: "Ana tomó el chat" });
    expect(saliente).toMatchObject({
      direccion: "SALIENTE", autor: "USUARIO", autorUserId: 2, autorLabel: "Ana", texto: "Hola Lucía", estadoEnvio: "SIMULADO", waMessageId: null,
    });
    expect((sistema.createdAt as Date).getTime()).toBeLessThan((saliente.createdAt as Date).getTime());
  });

  it("si ya es suyo, no repite el aviso de que lo tomó", async () => {
    const { id } = await chatNuevo({ estado: "HUMANO", asignadoUserId: 2 });
    await A.responder(ANA, id, "hola", "tok-1", { ahora: AHORA });
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0].direccion).toBe("SALIENTE");
  });

  it("envío real exitoso: ENVIADO con el id de Meta", async () => {
    const { id } = await chatNuevo();
    B.agregar("fotofficeWaConexion", { workspaceId: "w1", modo: "REAL", phoneNumberId: "123" });
    const enviar = vi.fn(async () => ({ ok: true as const, simulado: false as const, waMessageId: "wamid.OK" }));
    const r = await A.responder(ANA, id, "hola", "tok-1", { ahora: AHORA, enviar });
    expect(r).toMatchObject({ ok: true, estadoEnvio: "ENVIADO" });
    expect(enviar).toHaveBeenCalledWith(expect.objectContaining(conexionReal), WA, "hola");
    expect(mensajes().at(-1)).toMatchObject({ estadoEnvio: "ENVIADO", waMessageId: "wamid.OK", errorCodigo: null });
  });

  it("falla de Meta: el mensaje queda FALLO con el código y la acción avisa; el chat igual quedó tomado", async () => {
    const { id } = await chatNuevo();
    const enviar = vi.fn(async () => ({ ok: false as const, codigo: "131047" }));
    const r = await A.responder(ANA, id, "hola", "tok-1", { ahora: AHORA, enviar });
    expect(r).toMatchObject({ ok: false });
    expect(mensajes().at(-1)).toMatchObject({ direccion: "SALIENTE", estadoEnvio: "FALLO", errorCodigo: "131047" });
    expect(chats()[0].estado).toBe("HUMANO");
  });

  it("el envío ocurre FUERA de la transacción y con el mensaje ya PENDIENTE", async () => {
    const { id } = await chatNuevo();
    let estadoAlEnviar: string | undefined;
    const enviar = vi.fn(async () => {
      estadoAlEnviar = mensajes().at(-1)?.estadoEnvio as string;
      return { ok: true as const, simulado: true as const };
    });
    await A.responder(ANA, id, "hola", "tok-1", { ahora: AHORA, enviar });
    expect(estadoAlEnviar).toBe("PENDIENTE");
  });

  it("si el envío revienta, queda FALLO y no se pierde el mensaje", async () => {
    const { id } = await chatNuevo();
    const enviar = vi.fn(async () => { throw new Error("boom con el texto hola"); });
    const r = await A.responder(ANA, id, "hola", "tok-1", { ahora: AHORA, enviar });
    expect(r).toMatchObject({ ok: false });
    expect(mensajes().at(-1)).toMatchObject({ estadoEnvio: "FALLO", errorCodigo: "INTERNO" });
  });

  it("no loguea el texto ni el teléfono", async () => {
    const { id } = await chatNuevo();
    const enviar = vi.fn(async () => ({ ok: false as const, codigo: "RED" }));
    await A.responder(ANA, id, "texto-secreto", "tok-1", { ahora: AHORA, enviar });
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toMatch(/texto-secreto|549341/);
  });
});

describe("vincular y crear contacto", () => {
  it("si el chat ya tiene otro cliente, no lo pisa salvo `reemplazar`", async () => {
    const { id } = await chatNuevo({ clientId: "c1" });
    B.agregar("client", { id: "c1", workspaceId: "w1", firstName: "Lu" });
    B.agregar("client", { id: "c3", workspaceId: "w1", firstName: "Otro" });
    expect(await A.vincularCliente(ANA, id, "c3")).toEqual({ ok: false, error: "Este chat ya está vinculado a otro cliente." });
    expect(chats()[0].clientId).toBe("c1");
    expect(await A.vincularCliente(ANA, id, "c1")).toEqual({ ok: true });
    expect(await A.vincularCliente(ANA, id, "c3", { reemplazar: true })).toEqual({ ok: true });
    expect(chats()[0].clientId).toBe("c3");
    expect(B.sql.some((q) => q.texto.includes("FOR UPDATE"))).toBe(true);
  });

  it("vincula un cliente del mismo workspace y rechaza el de otro", async () => {
    const { id } = await chatNuevo();
    B.agregar("client", { id: "c1", workspaceId: "w1", firstName: "Lu" });
    B.agregar("client", { id: "c2", workspaceId: "w2", firstName: "Ajeno" });
    expect(await A.vincularCliente(ANA, id, "c2")).toMatchObject({ ok: false });
    expect(chats()[0].clientId).toBeNull();
    expect(await A.vincularCliente(ANA, id, "c1")).toEqual({ ok: true });
    expect(chats()[0].clientId).toBe("c1");
    expect(await A.vincularCliente(ANA, id, 7)).toMatchObject({ ok: false });
  });

  it("crea el cliente con el teléfono del chat, el nombre del perfil, y lo vincula", async () => {
    const { id } = await chatNuevo({ nombre: "Lucía Pérez Gómez" });
    const r = await A.crearContactoDesdeChat(ANA, id);
    expect(r).toMatchObject({ ok: true, clientId: expect.any(String) });
    const c = B.datos.client.find((x) => x.id === (r as { clientId: string }).clientId)!;
    expect(c).toMatchObject({ workspaceId: "w1", phone: WA, firstName: "Lucía", lastName: "Pérez Gómez", createdByUserId: 2 });
    expect(chats()[0].clientId).toBe(c.id);
    expect(B.datos.clientAudit[0]).toMatchObject({ clientId: c.id, actorUserId: 2, actorLabel: "Ana" });
  });

  it("usa el nombre indicado, y rechaza si el chat ya tiene cliente", async () => {
    const { id } = await chatNuevo({ nombre: "Perfil" });
    const r = await A.crearContactoDesdeChat(ANA, id, "Marta Díaz");
    expect(B.datos.client[0]).toMatchObject({ firstName: "Marta", lastName: "Díaz" });
    expect(r).toMatchObject({ ok: true });
    expect(await A.crearContactoDesdeChat(ANA, id)).toEqual({ ok: false, error: "Este chat ya tiene un cliente vinculado." });
    expect(B.datos.client).toHaveLength(1);
  });

  it("si ya hay un cliente con ese teléfono lo vincula en vez de duplicar", async () => {
    const { id } = await chatNuevo();
    B.agregar("client", { id: "viejo", workspaceId: "w1", firstName: "Lu", phone: "341 341-9869" });
    expect(await A.crearContactoDesdeChat(ANA, id)).toMatchObject({ ok: true, clientId: "viejo" });
    expect(B.datos.client).toHaveLength(1);
  });

  it("crear la ficha exige también Gestionar en Clientes", async () => {
    const { id } = await chatNuevo();
    const sinClientes = ctxDe(5, "Sol", { "whatsapp-inbox": "MANAGE", clients: "VIEW" });
    expect(await A.crearContactoDesdeChat(sinClientes, id)).toMatchObject({ ok: false });
    expect(B.datos.client).toHaveLength(0);
  });
});

describe("responder: idempotencia, resultado real y modo REAL sin token", () => {
  const ok = async () => ({ ok: true as const, simulado: false as const, waMessageId: "wamid.OK" });

  it("exige un clientToken válido", async () => {
    const { id } = await chatNuevo();
    for (const t of [undefined, "", "a".repeat(65), "con espacio", 5]) {
      expect(await A.responder(ANA, id, "hola", t, { ahora: AHORA })).toMatchObject({ ok: false });
    }
    expect(mensajes()).toHaveLength(0);
  });

  it("reintento con el mismo token: no envía otra vez y devuelve el estado guardado", async () => {
    const { id } = await chatNuevo();
    B.agregar("fotofficeWaConexion", { workspaceId: "w1", modo: "REAL", phoneNumberId: "123" });
    const enviar = vi.fn(ok);
    const a = await A.responder(ANA, id, "hola", "tok-9", { ahora: AHORA, enviar });
    const b = await A.responder(ANA, id, "hola", "tok-9", { ahora: AHORA, enviar });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
    expect(b).toMatchObject({ ok: true, estadoEnvio: "ENVIADO" });
    expect(mensajes().filter((m) => m.direccion === "SALIENTE")).toHaveLength(1);
    // Otro token es otro mensaje.
    await A.responder(ANA, id, "hola", "tok-10", { ahora: AHORA, enviar });
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it("el reintento tras un envío fallido sigue siendo fallido y tampoco reenvía; fuera de ventana igual devuelve lo guardado", async () => {
    const { id } = await chatNuevo();
    const enviar = vi.fn(async () => ({ ok: false as const, codigo: "131047" }));
    await A.responder(ANA, id, "hola", "t", { ahora: AHORA, enviar });
    const dos = await A.responder(ANA, id, "hola", "t", { ahora: new Date(AHORA.getTime() + 30 * 3_600_000), enviar });
    expect(dos).toMatchObject({ ok: false });
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("choque del único (otra petición ganó la carrera): devuelve su estado sin enviar", async () => {
    const { id } = await chatNuevo();
    const enviar = vi.fn(ok);
    // Nuestra transacción choca con el único porque la otra petición confirmó su mensaje primero.
    const dp = B.prisma as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const original = dp.$transaction;
    dp.$transaction = async () => {
      dp.$transaction = original;
      B.agregar("fotofficeWaMensaje", {
        workspaceId: "w1", chatId: id, direccion: "SALIENTE", autor: "USUARIO", estadoEnvio: "ENVIADO", clientToken: "t-carrera", waMessageId: "wamid.R",
      });
      throw Object.assign(new Error("unique"), { code: "P2002" });
    };
    const r = await A.responder(ANA, id, "hola", "t-carrera", { ahora: AHORA, enviar });
    expect(r).toMatchObject({ ok: true, estadoEnvio: "ENVIADO" });
    expect(enviar).not.toHaveBeenCalled();
    expect(mensajes().filter((m) => m.direccion === "SALIENTE")).toHaveLength(1);
  });

  it("P2002 al guardar el waMessageId: queda ENVIADO sin id", async () => {
    const { id } = await chatNuevo();
    B.agregar("fotofficeWaMensaje", { workspaceId: "w1", chatId: id, direccion: "SALIENTE", autor: "CELULAR", estadoEnvio: "ENVIADO", waMessageId: "wamid.OK" });
    const r = await A.responder(ANA, id, "hola", "t", { ahora: AHORA, enviar: vi.fn(ok) });
    expect(r).toMatchObject({ ok: true, estadoEnvio: "ENVIADO" });
    expect(mensajes().find((m) => m.clientToken === "t")).toMatchObject({ estadoEnvio: "ENVIADO", waMessageId: null });
  });

  it("si falla el registro del resultado tras un envío real: PENDIENTE con aviso, nunca ENVIADO", async () => {
    const { id } = await chatNuevo();
    const dp = B.prisma as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const originalTabla = dp.fotofficeWaMensaje;
    dp.fotofficeWaMensaje = new Proxy(originalTabla, {
      get: (t, m: string) => (m === "update" ? async () => { throw new Error("db caída"); } : t[m]),
    });
    try {
      const r = await A.responder(ANA, id, "hola", "t", { ahora: AHORA, enviar: vi.fn(ok) });
      expect(r).toMatchObject({ ok: true, estadoEnvio: "PENDIENTE", aviso: expect.stringContaining("No pudimos confirmar") });
      expect(mensajes().find((m) => m.clientToken === "t")?.estadoEnvio).toBe("PENDIENTE");
    } finally {
      dp.fotofficeWaMensaje = originalTabla;
    }
  });

  it("modo REAL sin token usable: FALLO SIN_TOKEN y mensaje claro (no simula)", async () => {
    const { id } = await chatNuevo();
    B.agregar("fotofficeWaConexion", { workspaceId: "w1", modo: "REAL", phoneNumberId: "123" });
    const r = await A.responder(ANA, id, "hola", "t", { ahora: AHORA }); // envío real de lib: el vault simulado no tiene token
    expect(r).toEqual({ ok: false, error: "Falta el token de WhatsApp en Configuración → WhatsApp." });
    expect(mensajes().at(-1)).toMatchObject({ estadoEnvio: "FALLO", errorCodigo: "SIN_TOKEN" });
  });
});

describe("marcarLeido bajo candado", () => {
  it("toma el candado de la fila", async () => {
    const { id } = await chatNuevo();
    await A.marcarLeido(ANA, id);
    expect(B.sql.some((q) => q.texto.includes("FOR UPDATE"))).toBe(true);
  });
});

describe("estadoVisible", () => {
  it("un PENDIENTE de más de 2 minutos es INCIERTO; el resto no cambia", () => {
    const m = (estadoEnvio: string, min: number) => ({ estadoEnvio, createdAt: new Date(AHORA.getTime() - min * 60_000) });
    expect(estadoVisible(m("PENDIENTE", 1), AHORA)).toBe("PENDIENTE");
    expect(estadoVisible(m("PENDIENTE", 3), AHORA)).toBe("INCIERTO");
    expect(estadoVisible(m("ENVIADO", 60), AHORA)).toBe("ENVIADO");
    expect(estadoVisible(m("FALLO", 60), AHORA)).toBe("FALLO");
  });
});

describe("vista previa del chat", () => {
  it("responder desde el panel la actualiza; tomar (mensaje de sistema) no la cambia", async () => {
    await P.fotofficeWaConexion.create({ data: conexionReal });
    const { id } = await chatNuevo({ ultimoMensajeTexto: "del cliente", ultimoMensajeTipo: "TEXTO", ultimoMensajeEn: hace(2) });
    await A.tomar(ANA, id);
    expect(chats()[0]).toMatchObject({ ultimoMensajeTexto: "del cliente", ultimoMensajeTipo: "TEXTO" });
    const enviar = vi.fn(async () => ({ ok: true as const, waMessageId: "wamid.x" }));
    await A.responder(ANA, id, "Te paso el presupuesto", "tok-prev", { ahora: AHORA, enviar } as never);
    expect(chats()[0]).toMatchObject({ ultimoMensajeTexto: "Te paso el presupuesto", ultimoMensajeTipo: "TEXTO" });
  });
});
