import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineTool, z } from "@repo/dnx-bot";

const H = vi.hoisted(() => ({
  resolver: vi.fn(),
  tools: [] as unknown[],
  tomar: vi.fn(),
  rechazar: vi.fn(),
  terminar: vi.fn(),
  agregar: vi.fn(),
  paraDeshacer: vi.fn(),
  deshecha: vi.fn(),
  volver: vi.fn(),
}));
vi.mock("@/lib/dnx-bot/acceso", () => ({ resolverBot: () => H.resolver() }));
vi.mock("@/lib/dnx-bot/herramientas", () => ({ herramientasPara: () => H.tools }));
vi.mock("@/lib/dnx-bot/store", () => ({
  tomarAccionPendiente: (...a: unknown[]) => H.tomar(...a),
  rechazarAccionPendiente: (...a: unknown[]) => H.rechazar(...a),
  terminarAccion: (...a: unknown[]) => H.terminar(...a),
  agregarMensajes: (...a: unknown[]) => H.agregar(...a),
  accionParaDeshacer: (...a: unknown[]) => H.paraDeshacer(...a),
  marcarDeshecha: (...a: unknown[]) => H.deshecha(...a),
  volverAEjecutada: (...a: unknown[]) => H.volver(...a),
}));
import { POST } from "./route";

const CTX = {
  workspaceId: "ws1",
  userId: 7,
  role: "WORKSPACE_OWNER",
  email: "d@x.test",
  nombre: "Daniel",
  capacidades: { configurar: true, gestionarPresupuestos: true, verConsultas: true },
  plataforma: "FOTOFFICE:ws1",
};
const run = vi.fn();
const undo = vi.fn();
const tool = defineTool({
  name: "guardar_algo",
  description: "x",
  input: z.object({ n: z.number() }),
  kind: "write",
  describe: async () => "Guardar algo",
  run: (i, a) => run(i, a),
  undo: (b, a) => undo(b, a),
});

const decidir = (id: string, decision: unknown) =>
  POST(new Request(`http://x/api/dnx-bot/acciones/${id}`, { method: "POST", body: JSON.stringify({ decision }) }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  for (const f of [H.resolver, H.tomar, H.rechazar, H.terminar, H.agregar, H.paraDeshacer, H.deshecha, H.volver, run, undo]) f.mockReset();
  H.resolver.mockResolvedValue({ ok: true, ctx: CTX });
  H.tools = [tool];
});

describe("POST /api/dnx-bot/acciones/[id]", () => {
  it("revalida las puertas: cerradas → 404 sin tocar la acción", async () => {
    H.resolver.mockResolvedValue({ ok: false, motivo: "modulos" });
    expect((await decidir("a1", "confirmar")).status).toBe(404);
    expect(H.tomar).not.toHaveBeenCalled();
  });
  it("decisión inválida → 400", async () => {
    expect((await decidir("a1", "borrar")).status).toBe(400);
  });
  it("rechazar: con la plataforma del workspace; ya decidida → 409", async () => {
    H.rechazar.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await decidir("a1", "rechazar")).status).toBe(200);
    expect(H.rechazar).toHaveBeenCalledWith({ id: "a1", plataforma: "FOTOFFICE:ws1", userId: 7 });
    expect((await decidir("a1", "rechazar")).status).toBe(409);
  });
  it("confirmar una acción ajena o de otro workspace → 409 (el store no la toma)", async () => {
    H.tomar.mockResolvedValue(null);
    const res = await decidir("a1", "confirmar");
    expect(res.status).toBe(409);
    expect(H.tomar).toHaveBeenCalledWith({ id: "a1", plataforma: "FOTOFFICE:ws1", userId: 7 });
    expect(run).not.toHaveBeenCalled();
  });
  it("si la herramienta ya no está (permiso quitado) → FAILED y 400", async () => {
    H.tools = [];
    H.tomar.mockResolvedValue({ id: "a1", toolName: "guardar_algo", input: { n: 1 }, summary: "s", conversationId: "c1" });
    expect((await decidir("a1", "confirmar")).status).toBe(400);
    expect(H.terminar).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "FAILED" }));
  });
  it("confirmar ok: corre, guarda before/after y deja constancia en la conversación", async () => {
    H.tomar.mockResolvedValue({ id: "a1", toolName: "guardar_algo", input: { n: 1 }, summary: "Guardar algo", conversationId: "c1" });
    run.mockResolvedValue({ ok: true, message: "Hecho", before: { n: 0 }, after: { n: 1 } });
    const r = await (await decidir("a1", "confirmar")).json();
    expect(r).toEqual({ ok: true, message: "Hecho", canUndo: true });
    expect(run.mock.calls[0]![0]).toEqual({ n: 1 });
    expect(H.terminar).toHaveBeenCalledWith("a1", { status: "EXECUTED", before: { n: 0 }, after: { n: 1 }, resultMessage: "Hecho" });
    expect(H.agregar.mock.calls[0]![1][0].content).toContain("confirmó");
  });
  it("deshacer fuera de la ventana de 10 minutos → 409", async () => {
    H.paraDeshacer.mockResolvedValue({ id: "a1", toolName: "guardar_algo", before: { n: 0 }, decidedAt: new Date(Date.now() - 11 * 60_000), conversationId: "c1" });
    expect((await decidir("a1", "deshacer")).status).toBe(409);
    expect(undo).not.toHaveBeenCalled();
  });
  it("deshacer dentro de la ventana; si falla vuelve a EXECUTED", async () => {
    H.paraDeshacer.mockResolvedValue({ id: "a1", toolName: "guardar_algo", before: { n: 0 }, decidedAt: new Date(), conversationId: "c1" });
    H.deshecha.mockResolvedValue(true);
    undo.mockResolvedValueOnce({ ok: true, message: "Deshecho" });
    expect(await (await decidir("a1", "deshacer")).json()).toEqual({ ok: true, message: "Deshecho", canUndo: false });
    undo.mockResolvedValueOnce({ ok: false, message: "No" });
    await decidir("a1", "deshacer");
    expect(H.volver).toHaveBeenCalledWith("a1");
    expect(H.paraDeshacer).toHaveBeenCalledWith({ id: "a1", plataforma: "FOTOFFICE:ws1", userId: 7 });
  });
});
