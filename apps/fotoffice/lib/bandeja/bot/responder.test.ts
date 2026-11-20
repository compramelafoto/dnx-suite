import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BotTurnInput, BotTurnResult } from "@repo/dnx-bot";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ leerTokenWhatsapp: vi.fn(async () => null), hayTokenWhatsapp: vi.fn(), guardarTokenWhatsapp: vi.fn() }));
const incidentes: string[] = [];
const urgentes: { codigo: string; detalle: string }[] = [];
vi.mock("@/lib/dnx-bot/incidentes", () => ({
  reportarIncidente: vi.fn(async (p: { codigo: string; detalle: string; urgente: boolean }) => {
    incidentes.push(p.codigo);
    if (p.urgente) urgentes.push({ codigo: p.codigo, detalle: p.detalle });
  }),
}));
vi.mock("@/lib/dnx-bot/anthropic", () => ({ clienteAnthropic: () => ({}) }));
vi.mock("./uso", () => ({
  usoWa: vi.fn(async () => USO.actual),
  registrarUsoWa: vi.fn(async () => undefined),
}));
vi.mock("./interruptor", () => ({ botEncendido: vi.fn(async () => USO.encendido) }));

const USO = { actual: { mensajesHoyPersona: 0, gastoMesGlobal: 0, gastoMesWorkspace: 0 }, encendido: true };
const { responderConBot, TEXTO_SI_FALLA, TEXTO_NO_CLIENTE } = await import("./responder");

const AHORA = new Date("2026-10-20T15:00:00.000Z");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;
const mensajes = () => B.datos.fotofficeWaMensaje;
const chats = () => B.datos.fotofficeWaChat;

const CONFIG = {
  enabled: true, model: "claude-sonnet-5-5", effort: "medium" as const, maxIterations: 8, telegram: null, anthropicApiKey: "k",
  limits: { maxMessagesPerUserPerDay: 60, monthlyCapMicroUsd: 15_000_000, workspaceMonthlyCapMicroUsd: 10_000_000 },
};
const CATALOGO = { productos: async () => [{ name: "Digitalización de VHS", priceMinor: 1_200_000, categoryName: null, variants: [] }], estudio: async () => null };
const USAGE = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

/** Turno falso: corre las herramientas que se le indiquen y contesta `texto`. */
function turnoQue(texto: string, herramientas: { name: string; input: unknown }[] = []) {
  const vistos: BotTurnInput[] = [];
  const fn = async (i: BotTurnInput): Promise<BotTurnResult> => {
    vistos.push(i);
    const resultados = [];
    for (const h of herramientas) {
      const t = i.tools.find((x) => x.name === h.name)!;
      const r = await t.run(h.input, i.actor);
      resultados.push({ type: "tool_result", tool_use_id: h.name, content: r.message });
    }
    i.onText(texto);
    const appended: BotTurnResult["appended"] = [{ role: "user", content: i.userText }];
    if (resultados.length) {
      appended.push({ role: "assistant", content: herramientas.map((h) => ({ type: "tool_use", id: h.name, name: h.name, input: h.input })) });
      appended.push({ role: "user", content: resultados });
    }
    appended.push({ role: "assistant", content: [{ type: "text", text: texto }] });
    return { appended, usage: USAGE, outcome: "ok" };
  };
  return { fn, vistos };
}

const deps = (turno: ReturnType<typeof turnoQue>["fn"], extra: Record<string, unknown> = {}) => ({
  ahora: () => AHORA, esperar: async () => undefined, config: () => CONFIG, turno, herramientas: CATALOGO, ...extra,
});

async function chatCon(textos: string[], extra: Record<string, unknown> = {}) {
  await P.fotofficeWaConexion.create({ data: { workspaceId: "w1", modo: "SIMULADO" } });
  const chat = await P.fotofficeWaChat.create({
    data: { workspaceId: "w1", waId: "5493413419869", nombre: "Lucía", ultimoMensajeEn: AHORA, ultimoEntranteEn: AHORA, ...extra },
  });
  for (const [i, texto] of textos.entries()) {
    await P.fotofficeWaMensaje.create({
      data: { workspaceId: "w1", chatId: chat.id, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto, estadoEnvio: "RECIBIDO", createdAt: new Date(AHORA.getTime() - (textos.length - i) * 1000) },
    });
  }
  return chat.id as string;
}

beforeEach(() => {
  B.vaciar();
  incidentes.length = 0;
  urgentes.length = 0;
  USO.actual = { mensajesHoyPersona: 0, gastoMesGlobal: 0, gastoMesWorkspace: 0 };
  USO.encendido = true;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("responderConBot", () => {
  it("contesta con lo que dijo el modelo, usando los precios del catálogo", async () => {
    const chatId = await chatCon(["hola", "quiero digitalizar 3 VHS"]);
    const t = turnoQue("¡Hola Lucía! La digitalización de VHS sale $12.000 cada uno.", [{ name: "buscar_productos", input: { texto: "vhs" } }]);
    expect(await responderConBot(chatId, deps(t.fn))).toBe("respondio");
    expect(t.vistos[0].userText).toBe("hola\nquiero digitalizar 3 VHS");
    expect(mensajes().find((m) => m.autor === "BOT")?.texto).toBe("¡Hola Lucía! La digitalización de VHS sale $12.000 cada uno.");
  });

  it("si el modelo dice un monto que no salió de ninguna herramienta, no lo envía y pasa a persona", async () => {
    const chatId = await chatCon(["cuánto sale un cuadro?"]);
    const t = turnoQue("El cuadro sale $99.000.");
    expect(await responderConBot(chatId, deps(t.fn))).toBe("derivo");
    expect(mensajes().find((m) => m.autor === "BOT")?.texto).toBe(TEXTO_SI_FALLA);
    expect(chats()[0].estado).toBe("HUMANO");
    expect(incidentes).toContain("cifra_no_respaldada");
  });

  it("si el bot pide una persona, envía su mensaje y deja el chat para el equipo", async () => {
    const chatId = await chatCon(["quiero presupuesto para mi casamiento"]);
    const t = turnoQue("¡Qué lindo! Te paso con alguien del estudio que te arma el presupuesto.", [{ name: "pasar_a_persona", input: { motivo: "presupuesto de casamiento" } }]);
    expect(await responderConBot(chatId, deps(t.fn))).toBe("derivo");
    expect(mensajes().find((m) => m.autor === "BOT")?.texto).toContain("Te paso con alguien");
    expect(chats()[0]).toMatchObject({ estado: "HUMANO", asignadoUserId: null });
    expect(mensajes().find((m) => m.direccion === "SISTEMA")?.texto).toContain("presupuesto de casamiento");
  });

  it("XV y bodas: con la cotización del paquete ya enviada en el turno, contesta igual y deja el chat asignado a ventas", async () => {
    const chatId = await chatCon(["Sí, dejame la cotización del Intermedio"]);
    const PAQ = { categoriaId: "cat-boda", categoria: "Boda", conOpciones: true, paquetes: [{ nombre: "Intermedio", total: 620000 }] };
    const enviarCotizacionDelPaquete = async () => {
      // Lo que hace aprobarYEnviar: el enlace de la cotización sale como un mensaje del bot.
      await P.fotofficeWaMensaje.create({
        data: { workspaceId: "w1", chatId, direccion: "SALIENTE", autor: "BOT", tipo: "TEXTO", texto: "¡Hola Laura! Ya está lista tu propuesta: https://x/presupuesto/t", estadoEnvio: "ENVIADO", createdAt: new Date(AHORA.getTime() + 500) },
      });
      return { ok: true, message: "Listo: salió." };
    };
    const t = turnoQue("¡Listo! Ahí te dejé la cotización para que reserves la fecha. Te dejo con Giuli, de nuestro equipo de ventas, que te va a acompañar para cerrar todo 😊", [
      { name: "enviar_cotizacion_del_paquete", input: { evento: "boda", paquete: "Intermedio", nombre: "Laura Gómez", fecha: "2027-03-13", lugar: "Salón, Funes", horario: "21 a 5" } },
    ]);
    const herramientas = { ...CATALOGO, paquetesDelEvento: async () => PAQ, vendedora: async () => ({ userId: 7, nombre: "Giuli", esResponsable: true }), enviarCotizacionDelPaquete };
    expect(await responderConBot(chatId, deps(t.fn, { herramientas, ahora: () => new Date(AHORA.getTime() + 1000) }))).toBe("derivo");
    expect(mensajes().filter((m) => m.autor === "BOT").map((m) => m.texto)).toEqual([expect.stringContaining("propuesta"), expect.stringContaining("Te dejo con Giuli")]);
    expect(chats()[0]).toMatchObject({ estado: "HUMANO", asignadoUserId: 7 });
    expect(mensajes().find((m) => m.direccion === "SISTEMA")?.texto).toBe("El bot pasó el chat a una persona (Giuli): le salió la cotización del paquete Intermedio");
  });

  it("XV y bodas: si el cliente escribió otra cosa mientras tanto, no contesta ni asigna (lo contesta el turno de ese mensaje)", async () => {
    const chatId = await chatCon(["Sí, dejame la cotización del Intermedio"]);
    const PAQ = { categoriaId: "cat-boda", categoria: "Boda", conOpciones: true, paquetes: [{ nombre: "Intermedio", total: 620000 }] };
    const enviarCotizacionDelPaquete = async () => {
      await P.fotofficeWaMensaje.create({ data: { workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "ah, y somos 150", estadoEnvio: "RECIBIDO", createdAt: new Date(AHORA.getTime() + 400) } });
      await P.fotofficeWaMensaje.create({ data: { workspaceId: "w1", chatId, direccion: "SALIENTE", autor: "BOT", tipo: "TEXTO", texto: "propuesta", estadoEnvio: "ENVIADO", createdAt: new Date(AHORA.getTime() + 500) } });
      return { ok: true, message: "Listo: salió." };
    };
    const t = turnoQue("Te dejo con Giuli 😊", [{ name: "enviar_cotizacion_del_paquete", input: { evento: "boda", paquete: "Intermedio", nombre: "Laura Gómez", fecha: "2027-03-13" } }]);
    const herramientas = { ...CATALOGO, paquetesDelEvento: async () => PAQ, vendedora: async () => ({ userId: 7, nombre: "Giuli", esResponsable: true }), enviarCotizacionDelPaquete };
    expect(await responderConBot(chatId, deps(t.fn, { herramientas, ahora: () => new Date(AHORA.getTime() + 1000) }))).toBe("nada");
    expect(mensajes().some((m) => m.texto === "Te dejo con Giuli 😊")).toBe(false);
  });

  it("a un proveedor o spam le dice que lo pasa al encargado, le avisa al dueño por Telegram y deja el chat a una persona", async () => {
    const chatId = await chatCon(["Hola, somos fabricantes de ropa de trabajo, te paso el catálogo"]);
    const t = turnoQue("", [{ name: "no_responder", input: { motivo: "publicidad de ropa de trabajo" } }]);
    const avisos: { motivo: string; texto: string; waId: string }[] = [];
    const avisarNoCliente = async (_ws: string, a: { motivo: string; texto: string; waId: string }) => void avisos.push(a);
    expect(await responderConBot(chatId, deps(t.fn, { avisarNoCliente }))).toBe("derivo");
    expect(mensajes().find((m) => m.autor === "BOT")?.texto).toBe(TEXTO_NO_CLIENTE);
    expect(avisos).toEqual([{ motivo: "publicidad de ropa de trabajo", texto: expect.stringContaining("ropa de trabajo"), waId: "5493413419869", nombre: "Lucía" }]);
    expect(chats()[0]).toMatchObject({ estado: "HUMANO" });
    expect(mensajes().find((m) => m.direccion === "SISTEMA")?.texto).toContain("publicidad de ropa de trabajo");
  });

  it("un comprobante de un pedido que espera el pago se verifica antes del modelo: si pasa a una persona, el bot no contesta otra cosa", async () => {
    const chatId = await chatCon(["ahí te transferí"]);
    await P.fotofficeWaMensaje.create({
      data: {
        workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "DOCUMENTO", texto: null, estadoEnvio: "RECIBIDO",
        media: { id: "meta", mimeType: "application/pdf", filename: "COMP_TRANSFERENCIA.pdf", descarga: "LISTO", clave: "k/comp.pdf" }, createdAt: new Date(AHORA.getTime() - 500),
      },
    });
    const t = turnoQue("¡Gracias!");
    const vistos: string[][] = [];
    const comprobante = async (_chat: unknown, archivos: readonly string[], _a: Date, d: { responder: (t: string) => Promise<string>; pasar: (m: string) => Promise<void> }) => {
      vistos.push([...archivos]);
      await d.responder("¡Gracias! Recibí el comprobante, lo estamos chequeando y te confirmo en un ratito 😊");
      await d.pasar("comprobante para revisar: el pago es anterior al pedido");
      return "A_PERSONA" as const;
    };
    expect(await responderConBot(chatId, deps(t.fn, { comprobante }))).toBe("derivo");
    expect(vistos).toHaveLength(1);
    expect(t.vistos).toHaveLength(0);
    expect(mensajes().filter((m) => m.autor === "BOT")).toHaveLength(1);
    expect(chats()[0]).toMatchObject({ estado: "HUMANO" });
  });

  it("si el archivo no es un comprobante, el bot contesta como siempre", async () => {
    const chatId = await chatCon([]);
    await P.fotofficeWaMensaje.create({
      data: {
        workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "IMAGEN", texto: null, estadoEnvio: "RECIBIDO",
        media: { id: "meta", mimeType: "image/jpeg", descarga: "LISTO", clave: "k/f.jpg", ancho: 1200, alto: 1600 }, createdAt: new Date(AHORA.getTime() - 500),
      },
    });
    const t = turnoQue("¡Qué linda foto! ¿Qué querés hacer con ella? 😊");
    const comprobante = async () => "SEGUIR" as const;
    expect(await responderConBot(chatId, deps(t.fn, { comprobante }))).toBe("respondio");
    expect(t.vistos).toHaveLength(1);
  });

  it("si mientras espera entra otro mensaje, no contesta (lo hará la próxima ejecución)", async () => {
    const chatId = await chatCon(["hola"]);
    const t = turnoQue("¡Hola!");
    const esperar = async () => {
      await P.fotofficeWaMensaje.create({ data: { workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "otra", estadoEnvio: "RECIBIDO", createdAt: AHORA } });
    };
    expect(await responderConBot(chatId, deps(t.fn, { esperar }))).toBe("nada");
    expect(t.vistos).toHaveLength(0);
  });

  it("espera a que se baje la foto antes de contestar, para ver su resolución", async () => {
    const chatId = await chatCon([]);
    const foto = await P.fotofficeWaMensaje.create({
      data: { workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "IMAGEN", texto: null, estadoEnvio: "RECIBIDO", media: { id: "meta" }, createdAt: new Date(AHORA.getTime() - 2000) },
    });
    await P.fotofficeWaMensaje.create({
      data: { workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "la quiero en 20x30", estadoEnvio: "RECIBIDO", createdAt: new Date(AHORA.getTime() - 1000) },
    });
    let vueltas = 0;
    const esperar = async () => {
      if (++vueltas === 3) await P.fotofficeWaMensaje.update({ where: { id: foto.id }, data: { media: { id: "meta", descarga: "LISTO", ancho: 1600, alto: 1200 } } });
    };
    const t = turnoQue("WhatsApp achica las fotos: mandala como Documento.");
    expect(await responderConBot(chatId, deps(t.fn, { esperar }))).toBe("respondio");
    expect(t.vistos[0].userText).toContain("1600×1200");
  });

  it("si la foto no termina de bajar, contesta igual", async () => {
    const chatId = await chatCon([]);
    await P.fotofficeWaMensaje.create({
      data: { workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "IMAGEN", texto: null, estadoEnvio: "RECIBIDO", media: { id: "meta" }, createdAt: new Date(AHORA.getTime() - 1000) },
    });
    let vueltas = 0;
    const t = turnoQue("¡Gracias por la foto!");
    expect(await responderConBot(chatId, deps(t.fn, { esperar: async () => void vueltas++ }))).toBe("respondio");
    expect(vueltas).toBeLessThanOrEqual(25);
  });

  it("no hace nada si el chat lo atiende una persona, si está apagado o si lo último no es del cliente", async () => {
    const t = turnoQue("¡Hola!");
    const humano = await chatCon(["hola"], { estado: "HUMANO", asignadoUserId: 3 });
    expect(await responderConBot(humano, deps(t.fn))).toBe("nada");
    B.vaciar();
    USO.encendido = false;
    const apagado = await chatCon(["hola"]);
    expect(await responderConBot(apagado, deps(t.fn))).toBe("nada");
    expect(await responderConBot(apagado, deps(t.fn, { config: () => ({ ...CONFIG, enabled: false }) }))).toBe("nada");
    expect(t.vistos).toHaveLength(0);
  });

  it("el tope diario por chat es de 60 respuestas (un pedido con varias tandas de fotos usa muchas)", async () => {
    const { MAX_RESPUESTAS_POR_DIA } = await import("./responder");
    expect(MAX_RESPUESTAS_POR_DIA).toBe(60);
  });

  it("al llegar al tope diario del chat avisa una vez y pasa a persona, sin llamar al modelo", async () => {
    USO.actual = { mensajesHoyPersona: 60, gastoMesGlobal: 0, gastoMesWorkspace: 0 };
    const chatId = await chatCon(["hola"]);
    const t = turnoQue("¡Hola!");
    expect(await responderConBot(chatId, deps(t.fn))).toBe("derivo");
    expect(t.vistos).toHaveLength(0);
    expect(mensajes().find((m) => m.autor === "BOT")?.texto).toBe(TEXTO_SI_FALLA);
  });

  it("al agotar el tope de gasto del mes avisa a Daniel por Telegram (un aviso por mes)", async () => {
    USO.actual = { mensajesHoyPersona: 0, gastoMesGlobal: 10_000_000, gastoMesWorkspace: 10_000_000 };
    const chatId = await chatCon(["¡Hola! Quiero más información."]);
    const t = turnoQue("¡Hola!");
    expect(await responderConBot(chatId, deps(t.fn))).toBe("derivo");
    expect(t.vistos).toHaveLength(0);
    expect(mensajes().find((m) => m.autor === "BOT")?.texto).toBe(TEXTO_SI_FALLA);
    // La marca lleva el mes: al mes siguiente vuelve a ser nueva y vuelve a avisar.
    expect(urgentes).toHaveLength(1);
    expect(urgentes[0].codigo).toBe("tope_workspace_2026-10");
    expect(urgentes[0].detalle).toContain("FOTOFFICE_BOT_WORKSPACE_MONTHLY_CAP_USD");
  });

  it("el tope diario por chat no avisa por Telegram", async () => {
    USO.actual = { mensajesHoyPersona: 60, gastoMesGlobal: 0, gastoMesWorkspace: 0 };
    const chatId = await chatCon(["hola"]);
    await responderConBot(chatId, deps(turnoQue("¡Hola!").fn));
    expect(urgentes).toHaveLength(0);
  });

  it("si la API falla, avisa al cliente y pasa a persona", async () => {
    const chatId = await chatCon(["hola"]);
    const falla = async () => {
      throw new Error("caída");
    };
    expect(await responderConBot(chatId, deps(falla))).toBe("derivo");
    expect(mensajes().find((m) => m.autor === "BOT")?.texto).toBe(TEXTO_SI_FALLA);
    expect(chats()[0].estado).toBe("HUMANO");
  });
});

describe("responderConBot en un chat de Instagram", () => {
  it("le dice al bot que atiende por Instagram, no le da herramientas de pedidos y mira la cotización por el chat", async () => {
    const chatId = await chatCon(["hola, cuánto sale una cobertura de XV?"], { canal: "INSTAGRAM", waId: "17841400000000001", usuarioInstagram: "sofi.r" });
    B.agregar("fotofficePresupuestoAprobacion", { id: "ap", workspaceId: "w1", leadId: "l1", igChatId: chatId, waId: null, status: "AVISADO", errorCode: null, createdAt: AHORA });
    const t = turnoQue("¡Hola! En un rato te mandamos la cotización 😊");
    await responderConBot(chatId, deps(t.fn));
    const i = t.vistos[0]!;
    expect(i.situation).toContain("Estás atendiendo por Instagram");
    expect(i.situation).toContain("Ya hay una cotización en preparación");
    expect(i.tools.map((x) => x.name)).not.toContain("armar_pedido_impresion");
  });

  it("en WhatsApp la situación no nombra Instagram", async () => {
    const chatId = await chatCon(["hola"]);
    const t = turnoQue("¡Hola! ¿En qué te puedo ayudar? 😊");
    await responderConBot(chatId, deps(t.fn));
    expect(t.vistos[0]!.situation).not.toContain("Instagram");
    expect(t.vistos[0]!.tools.map((x) => x.name)).toContain("armar_pedido_impresion");
  });
});

