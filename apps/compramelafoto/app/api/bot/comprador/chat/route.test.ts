import type { BotTool, BotTurnInput } from "@repo/dnx-bot";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  enabled: { v: true }, cap: { v: 30_000_000 },
  piloto: vi.fn(), resolver: vi.fn(), user: vi.fn(), buscar: vi.fn(), obtener: vi.fn(), proponer: vi.fn(),
  caso: vi.fn(), leerConv: vi.fn(), evento: vi.fn(), espejar: vi.fn(),
  reservar: vi.fn(), liberar: vi.fn(), registrar: vi.fn(), hist: vi.fn(), append: vi.fn(), sit: vi.fn(), turn: vi.fn(), tope: vi.fn(), inc: vi.fn(),
  after: [] as (() => Promise<void>)[],
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {},
  OrderOrigin: { STANDARD_CHECKOUT: "STANDARD_CHECKOUT", PREVENTA_PACK: "PREVENTA_PACK" },
  CheckoutPaymentSource: { MERCADO_PAGO: "MERCADO_PAGO" },
  Prisma: {},
}));
vi.mock("@/lib/mercadopago/album-order-mp-preference", () => ({ ensureAlbumOrderMpPreference: vi.fn() }));
vi.mock("@/lib/pricing/pricing-engine", () => ({ computeCheckoutTotals: vi.fn() }));
vi.mock("@/lib/preventa-canjeable/pack-service", () => ({ listActivePacksForPublicCatalog: vi.fn() }));
vi.mock("@/emails/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/hidden-album-audit", () => ({ hashIp: (ip: string) => `hash(${ip})` }));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/bot/config", async (orig) => ({
  ...(await orig<object>()),
  readBotConfig: () => ({
    enabled: true, model: "claude-sonnet-5-5", effort: "medium", maxIterations: 8,
    limits: { maxMessagesPerUserPerDay: 50, monthlyCapMicroUsd: m.cap.v }, telegram: null, anthropicApiKey: "k",
  }),
}));
vi.mock("@/lib/bot/comprador/config", async (orig) => ({
  ...(await orig<object>()),
  readBuyerBotConfig: () => ({ enabled: m.enabled.v, effort: "low", maxIterations: 5 }),
  leerPilotoCompradores: () => m.piloto(),
}));
vi.mock("@/lib/bot/comprador/pagina-datos", () => ({ resolverPagina: (...a: unknown[]) => m.resolver(...a) }));
vi.mock("@/lib/bot/comprador/store", async (orig) => ({
  ...(await orig<object>()),
  buscarConversacionComprador: (...a: unknown[]) => m.buscar(...a),
  obtenerConversacionComprador: (...a: unknown[]) => m.obtener(...a),
  crearAccionPendienteComprador: (...a: unknown[]) => m.proponer(...a),
  leerConversacionComprador: (...a: unknown[]) => m.leerConv(...a),
}));
vi.mock("@/lib/soporte/caso-bot", () => ({
  casoParaComprador: (...a: unknown[]) => m.caso(...a),
  situacionDeCaso: async () => "SIT_CASO",
  herramientasDeCaso: () => [{ name: "cerrar_caso_resuelto", kind: "read" }, { name: "pasar_caso_al_equipo", kind: "read" }],
  espejarTurnoEnTicket: (...a: unknown[]) => m.espejar(...a),
}));
vi.mock("@/lib/soporte/aplicar-evento", () => ({ aplicarEvento: (...a: unknown[]) => m.evento(...a) }));
vi.mock("@/lib/bot/comprador/limites", async (orig) => ({
  ...(await orig<object>()),
  reservarTurnoComprador: (...a: unknown[]) => m.reservar(...a),
  liberarReservaComprador: (...a: unknown[]) => m.liberar(...a),
  registrarUsoComprador: (...a: unknown[]) => m.registrar(...a),
}));
vi.mock("@/lib/bot/store", async (orig) => ({
  ...(await orig<object>()),
  loadHistory: (...a: unknown[]) => m.hist(...a),
  appendMessages: (...a: unknown[]) => m.append(...a),
}));
vi.mock("@/lib/bot/comprador/situacion", () => ({ buildBuyerSituation: (...a: unknown[]) => m.sit(...a) }));
vi.mock("@/lib/bot/comprador/guia", () => ({ buildBuyerGuide: () => "GUIA_COMPRADOR" }));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => m.after.push(fn) }));
vi.mock("@/lib/bot/tope", () => ({ notifyCapThresholds: (...a: unknown[]) => m.tope(...a) }));
vi.mock("@/lib/bot/escalamiento", async (orig) => ({ ...(await orig<object>()), reportIncident: (...a: unknown[]) => m.inc(...a) }));
vi.mock("@/lib/bot/anthropic", () => ({ getAnthropicClient: () => ({}) }));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), runBotTurn: (...a: unknown[]) => m.turn(...a) }));
import { ACTOR_MOTOR_COMPRADOR } from "@/lib/bot/comprador/identidad";
import { POST } from "./route";

const KEY = "0123456789abcdef0123456789abcdef";
const TOKEN = "c".repeat(32);
const req = (body: unknown, cookie?: string) =>
  new Request("http://x/api/bot/comprador/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-forwarded-for": "9.9.9.9", ...(cookie ? { cookie } : {}) },
  });
const RESERVA = { day: "2026-10-12", guestKey: KEY, ipHash: "hash(9.9.9.9)", costoReservado: 100_000 };
const conv = { id: "cb1", status: "OPEN", supportTicketId: null, buyerEmail: null, verifiedUntil: null, ipHash: "hash(9.9.9.9)", albumId: 5, orderId: null };
const okTurn = async (i: BotTurnInput) => {
  i.onText("Hola");
  return {
    appended: [{ role: "user", content: "hola" }, { role: "assistant", content: [{ type: "text", text: "Hola" }] }],
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    outcome: "ok",
  };
};

beforeEach(() => {
  m.enabled.v = true;
  m.cap.v = 30_000_000;
  m.after.splice(0);
  for (const f of [m.caso, m.leerConv, m.evento, m.espejar]) f.mockReset();
  for (const f of [m.piloto, m.resolver, m.user, m.buscar, m.obtener, m.proponer, m.reservar, m.liberar, m.registrar, m.hist, m.append, m.sit, m.turn, m.tope, m.inc]) f.mockReset();
  m.piloto.mockResolvedValue({ todos: false, albumIds: [5] });
  m.resolver.mockResolvedValue({ albumId: 5, orderId: null, enlace: null });
  m.user.mockResolvedValue(null);
  m.buscar.mockResolvedValue(null);
  m.obtener.mockResolvedValue(conv);
  m.reservar.mockResolvedValue({ permitido: true, reserva: RESERVA });
  m.liberar.mockResolvedValue(undefined);
  m.hist.mockResolvedValue([]);
  m.sit.mockResolvedValue("SIT_COMPRADOR");
  m.inc.mockResolvedValue(undefined);
  m.tope.mockResolvedValue(undefined);
  m.proponer.mockResolvedValue({ actionId: "a1" });
});

const CASO = "AbC_def-1234567890xyzAbC_def-1234567890xyz";
describe("POST /api/bot/comprador/chat · modo caso", () => {
  it("link del caso vencido o inventado → 410 sin llamar al modelo", async () => {
    m.caso.mockResolvedValue({ error: "vencido" });
    const res = await POST(req({ text: "hola", pagePath: `/caso/${CASO}` }, `dnxbot_guest=${KEY}`));
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "caso_vencido" });
    expect(m.turn).not.toHaveBeenCalled();
  });
  it("caso cerrado → 410 caso_cerrado sin llamar al modelo", async () => {
    m.caso.mockResolvedValue({ error: "cerrado" });
    const res = await POST(req({ text: "hola", pagePath: `/caso/${CASO}` }, `dnxbot_guest=${KEY}`));
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "caso_cerrado" });
    expect(m.turn).not.toHaveBeenCalled();
  });
  it("link válido: sigue la conversación del caso con su contexto, marca que escribió y copia el turno al ticket", async () => {
    m.caso.mockResolvedValue({ ticketId: 60, conversationId: "cs1" });
    m.leerConv.mockResolvedValue({ ...conv, id: "cs1", status: "ESCALATED", supportTicketId: 60, buyerEmail: "ana@x.com", verifiedUntil: new Date(Date.now() + 3_600_000), albumId: null });
    m.turn.mockImplementation(okTurn);
    const body = await (await POST(req({ text: "sigue igual", pagePath: `/caso/${CASO}` }, `dnxbot_guest=${KEY}`))).text();
    expect(body).toContain("event: done");
    expect(m.caso).toHaveBeenCalledWith(CASO, { guestKey: KEY, ipHash: "hash(9.9.9.9)" });
    expect(m.obtener).not.toHaveBeenCalled();
    expect(m.leerConv).toHaveBeenCalledWith("cs1", KEY);
    const input = m.turn.mock.calls[0]![0] as BotTurnInput;
    expect(input.situation).toContain("SIT_CASO");
    expect(input.tools.map((t: BotTool) => t.name)).toEqual(expect.arrayContaining(["cerrar_caso_resuelto", "pasar_caso_al_equipo"]));
    expect(m.evento).toHaveBeenCalledWith(60, { tipo: "CLIENTE_ESCRIBIO_BOT" });
    expect(m.espejar.mock.calls[0]![0]).toBe(60);
    expect(m.espejar.mock.calls[0]![1]).toMatchObject({ textoUsuario: "sigue igual", textoBot: "Hola" });
  });
});

describe("POST /api/bot/comprador/chat", () => {
  it("interruptor apagado → 404 sin tocar la base", async () => {
    m.enabled.v = false;
    expect((await POST(req({ text: "hola", pagePath: "/a/5" }))).status).toBe(404);
    expect(m.resolver).not.toHaveBeenCalled();
    expect(m.piloto).not.toHaveBeenCalled();
  });
  it("página fuera del piloto o sin bot → 404", async () => {
    m.resolver.mockResolvedValue({ albumId: 9, orderId: null, enlace: null });
    expect((await POST(req({ text: "hola", pagePath: "/a/9" }))).status).toBe(404);
    expect((await POST(req({ text: "hola", pagePath: "/album/x/comprar" }))).status).toBe(404);
    expect((await POST(req({ text: "hola" }))).status).toBe(404);
  });
  it("mensaje vacío → 400", async () => {
    expect((await POST(req({ text: "   ", pagePath: "/a/5" }))).status).toBe(400);
  });
  it("reserva rechazada (gasto en el 85 % del tope) → corte con event: error y sin llamar al modelo", async () => {
    m.reservar.mockResolvedValue({ permitido: false, motivo: "tope_compradores", mensaje: "Ahora no puedo responder automáticamente. X" });
    const body = await (await POST(req({ text: "hola", pagePath: "/a/5" }, `dnxbot_guest=${KEY}`))).text();
    expect(body).toContain("event: error");
    expect(body).toContain("Ahora no puedo responder automáticamente.");
    expect(body).toContain("offerTicket");
    expect(m.turn).not.toHaveBeenCalled();
    expect(m.reservar).toHaveBeenCalledWith({ guestKey: KEY, ipHash: "hash(9.9.9.9)", verificado: false, topeMensualMicroUsd: 30_000_000 });
    expect(m.liberar).not.toHaveBeenCalled();
  });
  it("si la base falla al reservar, el turno se corta (fail closed)", async () => {
    m.reservar.mockRejectedValue(new Error("db caída"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await (await POST(req({ text: "hola", pagePath: "/a/5" }, `dnxbot_guest=${KEY}`))).text();
    expect(body).toContain("event: error");
    expect(m.turn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
  it("la reserva va antes de preparar el turno; si preparar falla, se libera el gasto reservado", async () => {
    m.obtener.mockRejectedValue(new Error("db caída"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await (await POST(req({ text: "hola", pagePath: "/a/5" }, `dnxbot_guest=${KEY}`))).text();
    expect(body).toContain("event: error");
    expect(m.reservar.mock.invocationCallOrder[0]!).toBeLessThan(m.obtener.mock.invocationCallOrder[0]!);
    expect(m.turn).not.toHaveBeenCalled();
    expect(m.registrar).not.toHaveBeenCalled();
    expect(m.liberar).toHaveBeenCalledWith(RESERVA);
    log.mockRestore();
  });
  it("turno que falla en la API con uso parcial → registra contra la reserva y no la libera", async () => {
    const { BotTurnError } = await import("@repo/dnx-bot");
    m.turn.mockRejectedValue(new BotTurnError(new Error("api"), { input_tokens: 5, output_tokens: 0 }));
    await (await POST(req({ text: "hola", pagePath: "/a/5" }, `dnxbot_guest=${KEY}`))).text();
    expect(m.registrar).toHaveBeenCalledWith(expect.objectContaining({ reserva: RESERVA, conversationId: "cb1" }));
    expect(m.liberar).not.toHaveBeenCalled();
  });
  it("turno normal → herramientas de compradores, actor del motor de compradores y guía/situación propias", async () => {
    m.turn.mockImplementation(okTurn);
    const body = await (await POST(req({ text: "hola", pagePath: "/a/5" }, `dnxbot_guest=${KEY}`))).text();
    expect(body).toContain("event: done");
    const input = m.turn.mock.calls[0]![0] as BotTurnInput;
    const nombres = (input.tools as BotTool[]).map((t) => t.name);
    expect(nombres).toContain("abrir_caso");
    expect(nombres).not.toContain("actualizar_album");
    expect(input.actor).toEqual(ACTOR_MOTOR_COMPRADOR);
    expect(input).toMatchObject({ systemGuide: "GUIA_COMPRADOR", situation: "SIT_COMPRADOR", effort: "low", maxIterations: 5 });
    expect(m.append).toHaveBeenCalledWith("cb1", expect.any(Array));
    expect(m.registrar).toHaveBeenCalledWith(expect.objectContaining({ reserva: RESERVA, conversationId: "cb1" }));
    expect(m.liberar).not.toHaveBeenCalled();
    await vi.waitFor(async () => {
      for (const fn of m.after.splice(0)) await fn();
      expect(m.tope).toHaveBeenCalledTimes(1);
    });
  });
  it("conversación larga → sigue la misma; al modelo van los últimos turnos y lo anterior, resumido en la situación", async () => {
    m.turn.mockImplementation(okTurn);
    const largo = Array.from({ length: 45 }, (_, i) => [{ role: "user", content: `duda ${i + 1}` }, { role: "assistant", content: [{ type: "text", text: "ok" }] }]).flat();
    m.hist.mockResolvedValue(largo);
    await (await POST(req({ text: "hola", pagePath: "/a/5" }, `dnxbot_guest=${KEY}`))).text();
    const input = m.turn.mock.calls[0]![0] as BotTurnInput;
    expect(input.history.length).toBeLessThan(largo.length);
    expect(input.history.at(-2)).toEqual({ role: "user", content: "duda 45" });
    expect(input.situation.startsWith("SIT_COMPRADOR")).toBe(true);
    expect(input.situation).toContain("«duda 20»");
    expect(m.append).toHaveBeenCalledWith("cb1", expect.any(Array));
  });
  it("la conversación se guarda con la ruta segura (sin el token) y la IP con hash", async () => {
    m.resolver.mockResolvedValue({ albumId: 5, orderId: 7, enlace: { tipo: "descarga", orderId: 7, albumId: 5 } });
    m.turn.mockImplementation(okTurn);
    await (await POST(req({ text: "hola", pagePath: `/descargas/${TOKEN}` }, `dnxbot_guest=${KEY}`))).text();
    expect(m.obtener).toHaveBeenCalledWith({
      guestKey: KEY, ipHash: "hash(9.9.9.9)", pagePath: "/descargas/[token]", albumId: 5, orderId: 7, model: "claude-sonnet-5-5",
    });
    expect(JSON.stringify(m.obtener.mock.calls)).not.toContain(TOKEN);
    expect(m.sit.mock.calls[0]![0]).toMatchObject({ conversationId: "cb1", enlace: { tipo: "descarga", orderId: 7 }, pagePath: "/descargas/[token]" });
  });
  it("una propuesta se guarda en la conversación del comprador (cuenta para el tope por IP)", async () => {
    m.turn.mockImplementation(async (i: BotTurnInput) => {
      await i.proposeWrite({ toolName: "solicitar_quitar_foto", input: { x: 1 }, summary: "Quitar foto" });
      return okTurn(i);
    });
    await (await POST(req({ text: "sacá mi foto", pagePath: "/a/5" }, `dnxbot_guest=${KEY}`))).text();
    expect(m.proponer).toHaveBeenCalledWith({ conversationId: "cb1", toolName: "solicitar_quitar_foto", input: { x: 1 }, summary: "Quitar foto" });
  });
  it("sin cookie → crea una y la manda en el Set-Cookie del Response (antes del stream)", async () => {
    m.turn.mockImplementation(okTurn);
    const res = await POST(req({ text: "hola", pagePath: "/a/5" }));
    const c = res.headers.get("set-cookie")!;
    expect(c).toMatch(/dnxbot_guest=[0-9a-f]{32}/);
    expect(c).toContain("HttpOnly");
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const nueva = c.match(/dnxbot_guest=([0-9a-f]{32})/)![1];
    await res.text();
    expect(m.obtener.mock.calls[0]![0].guestKey).toBe(nueva);
  });
  it("con cookie válida → sin Set-Cookie", async () => {
    m.turn.mockImplementation(okTurn);
    const res = await POST(req({ text: "hola", pagePath: "/a/5" }, `dnxbot_guest=${KEY}`));
    expect(res.headers.get("set-cookie")).toBeNull();
    await res.text();
  });
  it("visitante verificado por código: el límite usa el tope de verificado", async () => {
    m.buscar.mockResolvedValue({ ...conv, buyerEmail: "ju@x.com", verifiedUntil: new Date(Date.now() + 60_000) });
    m.turn.mockImplementation(okTurn);
    const body = await (await POST(req({ text: "hola", pagePath: "/a/5" }, `dnxbot_guest=${KEY}`))).text();
    expect(body).not.toContain("event: error");
    expect(m.turn).toHaveBeenCalled();
    expect(m.reservar.mock.calls[0]![0]).toMatchObject({ verificado: true });
  });
});
