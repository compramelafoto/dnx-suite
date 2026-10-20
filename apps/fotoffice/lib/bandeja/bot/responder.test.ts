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
vi.mock("@/lib/dnx-bot/incidentes", () => ({ reportarIncidente: vi.fn(async (p: { codigo: string }) => void incidentes.push(p.codigo)) }));
vi.mock("@/lib/dnx-bot/anthropic", () => ({ clienteAnthropic: () => ({}) }));
vi.mock("./uso", () => ({
  usoWa: vi.fn(async () => USO.actual),
  registrarUsoWa: vi.fn(async () => undefined),
}));
vi.mock("./interruptor", () => ({ botEncendido: vi.fn(async () => USO.encendido) }));

const USO = { actual: { mensajesHoyPersona: 0, gastoMesGlobal: 0, gastoMesWorkspace: 0 }, encendido: true };
const { responderConBot, TEXTO_SI_FALLA } = await import("./responder");

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

  it("si mientras espera entra otro mensaje, no contesta (lo hará la próxima ejecución)", async () => {
    const chatId = await chatCon(["hola"]);
    const t = turnoQue("¡Hola!");
    const esperar = async () => {
      await P.fotofficeWaMensaje.create({ data: { workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "otra", estadoEnvio: "RECIBIDO", createdAt: AHORA } });
    };
    expect(await responderConBot(chatId, deps(t.fn, { esperar }))).toBe("nada");
    expect(t.vistos).toHaveLength(0);
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

  it("al llegar al tope diario del chat avisa una vez y pasa a persona, sin llamar al modelo", async () => {
    USO.actual = { mensajesHoyPersona: 30, gastoMesGlobal: 0, gastoMesWorkspace: 0 };
    const chatId = await chatCon(["hola"]);
    const t = turnoQue("¡Hola!");
    expect(await responderConBot(chatId, deps(t.fn))).toBe("derivo");
    expect(t.vistos).toHaveLength(0);
    expect(mensajes().find((m) => m.autor === "BOT")?.texto).toBe(TEXTO_SI_FALLA);
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
