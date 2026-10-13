import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TurnoParams } from "@/lib/dnx-bot/turno-sse";

const H = vi.hoisted(() => ({
  resolver: vi.fn(),
  turno: vi.fn(),
  uso: vi.fn(),
  conv: vi.fn(),
  historial: vi.fn(),
  registrar: vi.fn(),
  accion: vi.fn(),
  topes: vi.fn(),
  cifra: vi.fn(),
}));
vi.mock("@/lib/dnx-bot/herramientas/perfil", async (orig) => ({
  ...(await orig<object>()),
  estadoDelPerfil: async () => ({ existe: true, completo: false, faltan: ["Software y herramientas"], origen: "manual" }),
}));
vi.mock("@/lib/dnx-bot/contexto-validado", () => ({
  revalidarContexto: async (_c: unknown, k: { presupuestoId: string | null }) =>
    k.presupuestoId === "p1" ? { presupuesto: { id: "p1", numero: "0007", estado: "BORRADOR", esBorrador: true } } : {},
}));
vi.mock("@/lib/dnx-bot/incidentes", () => ({ reportarCifraNoRespaldada: (...a: unknown[]) => H.cifra(...a) }));
vi.mock("@/lib/dnx-bot/acceso", () => ({ resolverBot: () => H.resolver() }));
vi.mock("@/lib/dnx-bot/turno-sse", () => ({
  respuestaDeTurno: (p: unknown) => {
    H.turno(p);
    return new Response("ok");
  },
}));
vi.mock("@/lib/dnx-bot/store", () => ({
  usoActual: (...a: unknown[]) => H.uso(...a),
  conversacionAbierta: (...a: unknown[]) => H.conv(...a),
  cargarHistorial: (...a: unknown[]) => H.historial(...a),
  registrarUso: (...a: unknown[]) => H.registrar(...a),
  crearAccionPendiente: (...a: unknown[]) => H.accion(...a),
}));
vi.mock("@/lib/dnx-bot/tope", () => ({ avisarTopes: (...a: unknown[]) => H.topes(...a) }));
vi.mock("@/lib/dnx-bot/config", async (orig) => ({
  ...(await orig<object>()),
  leerConfigBot: () => ({
    enabled: true,
    model: "claude-sonnet-5-5",
    effort: "medium",
    maxIterations: 8,
    limits: { maxMessagesPerUserPerDay: 60, monthlyCapMicroUsd: 15_000_000, workspaceMonthlyCapMicroUsd: 10_000_000 },
    telegram: null,
    anthropicApiKey: "k",
  }),
}));
import { maxDuration, POST, runtime } from "./route";

const CTX = {
  workspaceId: "ws1",
  workspaceNombre: "DNX Estudio",
  userId: 7,
  userLabel: "Daniel",
  role: "WORKSPACE_OWNER",
  email: "d@x.test",
  nombre: "Daniel",
  capacidades: { configurar: true, gestionarPresupuestos: true, verConsultas: true },
  plataforma: "FOTOFFICE:ws1",
};

const pedido = (body: unknown) =>
  new Request("http://x/api/dnx-bot/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const params = () => H.turno.mock.calls[0]![0] as TurnoParams;

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.resolver.mockResolvedValue({ ok: true, ctx: CTX });
  H.conv.mockResolvedValue({ id: "c1" });
  H.historial.mockResolvedValue([]);
});

describe("POST /api/dnx-bot/chat", () => {
  it("es nodejs y tiene 120 s", () => {
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(120);
  });
  it("con una puerta cerrada: 404, sin turno", async () => {
    H.resolver.mockResolvedValue({ ok: false, motivo: "sin_piloto" });
    expect((await POST(pedido({ text: "hola" }))).status).toBe(404);
    expect(H.turno).not.toHaveBeenCalled();
  });
  it("sin texto: 400", async () => {
    expect((await POST(pedido({ text: "   " }))).status).toBe(400);
    expect((await POST(new Request("http://x", { method: "POST", body: "no es json" }))).status).toBe(400);
  });
  it("arma el turno con la plataforma del workspace de la sesión, no la del cuerpo", async () => {
    await POST(pedido({ text: "x".repeat(3000), pagePath: "/presupuestos", workspaceId: "ajeno", contexto: { pantalla: "presupuestos", presupuestoId: "p1" } }));
    const p = params();
    expect(p.plataforma).toBe("FOTOFFICE:ws1");
    expect(p.text).toHaveLength(2000);
    const prep = await p.preparar();
    expect(H.conv).toHaveBeenCalledWith({ plataforma: "FOTOFFICE:ws1", userId: 7, pagePath: "/presupuestos", model: "claude-sonnet-5-5" });
    expect(prep.systemGuide).toContain("Nunca inventes precios");
    expect(prep.situation).toContain("Pantalla: lista de presupuestos");
    expect(prep.situation).toContain("Está mirando el presupuesto N.º 0007 (presupuestoId p1), en borrador.");
    expect(prep.situation).toContain("Perfil de precios: incompleto (cargado a mano). Falta: Software y herramientas.");
    expect(prep.tools.map((t) => t.name)).toEqual([
      "ver_perfil_de_precios", "simular_perfil", "guardar_perfil_de_precios",
      "cotizar_trabajo", "buscar_consultas", "ver_presupuesto", "crear_borrador_de_presupuesto", "sumar_al_borrador",
    ]);
    expect(prep.actor).toEqual({ userId: 7, role: "WORKSPACE_OWNER", email: "d@x.test", name: "Daniel" });
  });
  it("límites: corta con el mensaje propio; debajo, sigue", async () => {
    await POST(pedido({ text: "hola" }));
    H.uso.mockResolvedValueOnce({ mensajesHoyPersona: 60, gastoMesGlobal: 0, gastoMesWorkspace: 0 });
    expect(await params().verificarLimites()).toMatch(/máximo de mensajes/);
    H.uso.mockResolvedValueOnce({ mensajesHoyPersona: 1, gastoMesGlobal: 0, gastoMesWorkspace: 0 });
    expect(await params().verificarLimites()).toBeNull();
    expect(H.uso).toHaveBeenCalledWith({ plataforma: "FOTOFFICE:ws1", userId: 7 });
  });
  it("uso, propuestas y avisos de tope van a la plataforma del workspace", async () => {
    await POST(pedido({ text: "hola" }));
    const p = params();
    const usage = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    await p.registrarUso("c1", usage, 5);
    expect(H.registrar).toHaveBeenCalledWith({ plataforma: "FOTOFFICE:ws1", userId: 7, conversationId: "c1", usage, costMicroUsd: 5, contarMensaje: true });
    await p.proponer("c1", { toolName: "t", input: {}, summary: "s" });
    expect(H.accion).toHaveBeenCalledWith({ plataforma: "FOTOFFICE:ws1", conversationId: "c1", userId: 7, toolName: "t", input: {}, summary: "s" });
    await p.despuesDelTurno();
    expect(H.topes).toHaveBeenCalledWith({ workspaceId: "ws1" });
  });
  it("verificador de cifras: una cifra inventada se reporta y avisa; una respaldada, no", async () => {
    H.cifra.mockResolvedValue(undefined);
    await POST(pedido({ text: "hola" }));
    const revisar = params().revisarRespuesta!;
    const appended = [
      { role: "user", content: "Pago 450 lucas de alquiler" },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: '{"valorHora":"$ 31.250"}' }] },
    ];
    expect(await revisar({ texto: "Anoto $450.000; tu valor hora da $31.250.", appended, history: [], conversationId: "c1" })).toBeNull();
    expect(H.cifra).not.toHaveBeenCalled();
    const aviso = await revisar({ texto: "La mayoría cobra $25.000.", appended, history: [], conversationId: "c1" });
    expect(aviso).toMatch(/^Ojo: un número/);
    expect(H.cifra).toHaveBeenCalledWith({ plataforma: "FOTOFFICE:ws1", ids: { userId: 7, conversationId: "c1" }, cantidad: 1 });
  });

  it("la tarjeta de cálculo sale cuando simular_perfil o cotizar_trabajo traen una", async () => {
    await POST(pedido({ text: "hola" }));
    const send = vi.fn();
    const tarjeta = { titulo: "Tu perfil de precios", filas: [], avisos: [] };
    params().alResultado!(send, "simular_perfil", { ok: true, message: "", data: { tarjeta } });
    params().alResultado!(send, "ver_perfil_de_precios", { ok: true, message: "", data: { tarjeta } });
    params().alResultado!(send, "cotizar_trabajo", { ok: true, message: "", data: { tarjeta } });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith("calculo", tarjeta);
  });
});
