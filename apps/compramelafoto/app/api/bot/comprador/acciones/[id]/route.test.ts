import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  enabled: { v: true },
  piloto: vi.fn(), convDeAccion: vi.fn(), leerConv: vi.fn(), tomar: vi.fn(), rechazar: vi.fn(), finish: vi.fn(), append: vi.fn(),
  herramientas: vi.fn(), run: vi.fn(), user: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/hidden-album-audit", () => ({ hashIp: (ip: string) => `hash(${ip})` }));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/bot/comprador/config", async (orig) => ({
  ...(await orig<object>()),
  readBuyerBotConfig: () => ({ enabled: m.enabled.v, effort: "low", maxIterations: 5 }),
  leerPilotoCompradores: () => m.piloto(),
}));
vi.mock("@/lib/bot/comprador/pagina-datos", () => ({ resolverPagina: vi.fn() }));
vi.mock("@/lib/bot/comprador/store", () => ({
  conversacionDeAccionPendienteComprador: (...a: unknown[]) => m.convDeAccion(...a),
  leerConversacionComprador: (...a: unknown[]) => m.leerConv(...a),
  tomarAccionPendienteComprador: (...a: unknown[]) => m.tomar(...a),
  rechazarAccionPendienteComprador: (...a: unknown[]) => m.rechazar(...a),
}));
vi.mock("@/lib/bot/store", () => ({
  finishAction: (...a: unknown[]) => m.finish(...a),
  appendMessages: (...a: unknown[]) => m.append(...a),
}));
vi.mock("@/lib/bot/comprador/herramientas", () => ({
  ERROR_GENERICO_COMPRADOR: "hubo un problema interno. Probá una vez más; si vuelve a fallar, ofrecé abrir un caso.",
  herramientasComprador: (...a: unknown[]) => m.herramientas(...a),
}));
vi.mock("@/lib/bot/comprador/herramientas/acciones", () => ({ AvisoAlComprador: class AvisoAlComprador extends Error {} }));
import { POST } from "./route";

const KEY = "0123456789abcdef0123456789abcdef";
const OTRA = "fedcba9876543210fedcba9876543210";
const conv = {
  id: "cb1", status: "OPEN", supportTicketId: null, buyerEmail: "ju@x.com", verifiedUntil: new Date(Date.now() + 60_000),
  ipHash: "hash(9.9.9.9)", albumId: 5, orderId: 7,
};
const action = { id: "a1", userId: null, toolName: "solicitar_quitar_foto", input: { photoId: 3 }, summary: "Quitar la foto #3", conversationId: "cb1" };
const req = (decision: unknown, cookie: string | null = `dnxbot_guest=${KEY}`) =>
  new Request("http://x/api/bot/comprador/acciones/a1", {
    method: "POST",
    body: JSON.stringify({ decision }),
    headers: { "x-forwarded-for": "9.9.9.9", ...(cookie ? { cookie } : {}) },
  });
const ctx = { params: Promise.resolve({ id: "a1" }) };

beforeEach(() => {
  m.enabled.v = true;
  Object.values(m).forEach((f) => (typeof f === "function" ? f.mockReset() : undefined));
  m.piloto.mockResolvedValue({ todos: false, albumIds: [5] });
  m.convDeAccion.mockResolvedValue("cb1");
  m.leerConv.mockResolvedValue(conv);
  m.tomar.mockResolvedValue(action);
  m.rechazar.mockResolvedValue(true);
  m.finish.mockResolvedValue(undefined);
  m.append.mockResolvedValue(undefined);
  m.user.mockResolvedValue(null);
  m.run.mockResolvedValue({ ok: true, message: "Listo, mandé la solicitud." });
  m.herramientas.mockImplementation(() => [
    { name: "solicitar_quitar_foto", kind: "write", input: z.object({ photoId: z.number() }), run: m.run },
    { name: "buscar_album", kind: "read", input: z.object({}), run: vi.fn() },
  ]);
});

describe("POST /api/bot/comprador/acciones/[id]", () => {
  it("interruptor apagado → 404 sin tocar nada", async () => {
    m.enabled.v = false;
    expect((await POST(req("confirmar"), ctx)).status).toBe(404);
    expect(m.convDeAccion).not.toHaveBeenCalled();
    expect(m.tomar).not.toHaveBeenCalled();
  });
  it("sin cookie → 401", async () => {
    expect((await POST(req("confirmar", null), ctx)).status).toBe(401);
    expect(m.tomar).not.toHaveBeenCalled();
  });
  it("deshacer → 409 «Esta acción no se puede deshacer.»", async () => {
    const res = await POST(req("deshacer"), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe("Esta acción no se puede deshacer.");
    expect(m.tomar).not.toHaveBeenCalled();
  });
  it("decisión inválida → 400", async () => {
    expect((await POST(req("borrar"), ctx)).status).toBe(400);
  });
  it("acción de otro navegador → 409, sin reclamarla ni correrla", async () => {
    m.convDeAccion.mockResolvedValue(null);
    const res = await POST(req("confirmar", `dnxbot_guest=${OTRA}`), ctx);
    expect(res.status).toBe(409);
    expect(m.convDeAccion).toHaveBeenCalledWith("a1", OTRA);
    expect(m.tomar).not.toHaveBeenCalled();
    expect(m.run).not.toHaveBeenCalled();
  });
  it("conversación no encontrada → 409 ANTES de reclamar (la acción no queda EXECUTED)", async () => {
    m.leerConv.mockResolvedValue(null);
    expect((await POST(req("confirmar"), ctx)).status).toBe(409);
    expect(m.leerConv).toHaveBeenCalledWith("cb1", KEY);
    expect(m.tomar).not.toHaveBeenCalled();
    expect(m.finish).not.toHaveBeenCalled();
  });
  it("álbum de la conversación fuera del piloto → 404 sin reclamar", async () => {
    m.piloto.mockResolvedValue({ todos: false, albumIds: [99] });
    expect((await POST(req("confirmar"), ctx)).status).toBe(404);
    expect(m.tomar).not.toHaveBeenCalled();
  });
  it("doble clic: la segunda vez tomar → null → 409 y run no se llama", async () => {
    m.tomar.mockResolvedValue(null);
    const res = await POST(req("confirmar"), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe("Esa propuesta ya no está pendiente (se usó, venció o es de otra conversación).");
    expect(m.run).not.toHaveBeenCalled();
  });
  it("dos clics seguidos sobre la misma acción → corre una sola vez", async () => {
    m.tomar.mockResolvedValueOnce(action).mockResolvedValueOnce(null);
    const [r1, r2] = await Promise.all([POST(req("confirmar"), ctx), POST(req("confirmar"), ctx)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    expect(m.run).toHaveBeenCalledTimes(1);
  });
  it("confirmar → corre una vez, EXECUTED, mensaje de sistema igual al de fotógrafos", async () => {
    const res = await POST(req("confirmar"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: "Listo, mandé la solicitud.", canUndo: false });
    expect(m.tomar).toHaveBeenCalledWith("a1", KEY);
    expect(m.leerConv.mock.invocationCallOrder[0]).toBeLessThan(m.tomar.mock.invocationCallOrder[0]!);
    expect(m.run).toHaveBeenCalledTimes(1);
    expect(m.run.mock.calls[0]![0]).toEqual({ photoId: 3 });
    expect(m.finish).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "EXECUTED", resultMessage: "Listo, mandé la solicitud." }));
    expect(m.append).toHaveBeenCalledWith("cb1", [
      { role: "user", content: "[Sistema] El usuario confirmó la acción a1 («Quitar la foto #3»). Resultado: Listo, mandé la solicitud." },
    ]);
    // Actor armado desde la conversación de la acción: sin enlace ni ruta, con el mail verificado.
    expect(m.herramientas.mock.calls[0]![0]).toMatchObject({
      conversationId: "cb1", guestKey: KEY, ipHash: "hash(9.9.9.9)", pagina: null, pagePath: null, enlace: null, albumId: 5, emailVerificado: "ju@x.com",
    });
  });
  it("si la herramienta lanza el error genérico → FAILED y texto amable (no el que es para el modelo)", async () => {
    m.run.mockRejectedValue(new Error("hubo un problema interno. Probá una vez más; si vuelve a fallar, ofrecé abrir un caso."));
    const res = await POST(req("confirmar"), ctx);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).not.toContain("ofrecé");
    expect(body.message.length).toBeGreaterThan(10);
    expect(m.finish).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "FAILED" }));
    expect(m.append.mock.calls[0]![1][0].content).toContain("[Sistema] El usuario confirmó pero falló la acción a1");
  });
  it("acción reclamada de otra conversación (no debería pasar) → 409 y queda FAILED, no EXECUTED", async () => {
    m.tomar.mockResolvedValue({ ...action, conversationId: "otra" });
    expect((await POST(req("confirmar"), ctx)).status).toBe(409);
    expect(m.run).not.toHaveBeenCalled();
    expect(m.finish).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "FAILED" }));
  });
  it("datos guardados inválidos → FAILED y 400", async () => {
    m.tomar.mockResolvedValue({ ...action, input: { photoId: "x" } });
    expect((await POST(req("confirmar"), ctx)).status).toBe(400);
    expect(m.run).not.toHaveBeenCalled();
    expect(m.finish).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "FAILED" }));
  });
  it("rechazar → REJECTED por navegador", async () => {
    const res = await POST(req("rechazar"), ctx);
    expect(res.status).toBe(200);
    expect(m.rechazar).toHaveBeenCalledWith("a1", KEY);
    m.rechazar.mockResolvedValue(false);
    expect((await POST(req("rechazar"), ctx)).status).toBe(409);
  });
});
