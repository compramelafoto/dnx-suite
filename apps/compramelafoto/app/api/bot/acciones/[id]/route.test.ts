import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: vi.fn(), claim: vi.fn(), finish: vi.fn(), reject: vi.fn(), append: vi.fn(), find: vi.fn(),
  upd: vi.fn(), run: vi.fn(), undo: vi.fn(), enabled: vi.fn(), parse: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/bot/config", () => ({ isBotEnabledForUser: () => m.enabled() }));
vi.mock("@/lib/bot/store", () => ({
  claimPendingAction: (...a: unknown[]) => m.claim(...a), finishAction: (...a: unknown[]) => m.finish(...a),
  rejectPendingAction: (...a: unknown[]) => m.reject(...a), appendMessages: (...a: unknown[]) => m.append(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { botAction: { findFirst: (...a: unknown[]) => m.find(...a), updateMany: (...a: unknown[]) => m.upd(...a) } },
}));
vi.mock("@/lib/bot/herramientas", () => ({
  toolsForActor: () => [
    { name: "actualizar_album", kind: "write", input: { safeParse: (x: unknown) => m.parse(x) }, run: m.run, undo: m.undo },
  ],
}));
import { POST } from "./route";

const req = (decision: string) => new Request("http://x/api/bot/acciones/a1", { method: "POST", body: JSON.stringify({ decision }) });
const params = { params: Promise.resolve({ id: "a1" }) };
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.user.mockResolvedValue({ id: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" });
  m.enabled.mockResolvedValue(true);
  m.parse.mockImplementation((x: unknown) => ({ success: true, data: x }));
  m.upd.mockResolvedValue({ count: 1 });
});

describe("POST /api/bot/acciones/[id]", () => {
  it("sin sesión → 401", async () => {
    m.user.mockResolvedValue(null);
    expect((await POST(req("confirmar"), params)).status).toBe(401);
  });
  it("bot apagado para el usuario → 404", async () => {
    m.enabled.mockResolvedValue(false);
    expect((await POST(req("confirmar"), params)).status).toBe(404);
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("decisión inválida → 400", async () => {
    expect((await POST(req("borrar"), params)).status).toBe(400);
  });
  it("confirmar ejecuta una vez y registra en la conversación", async () => {
    m.claim.mockResolvedValue({ id: "a1", userId: 7, toolName: "actualizar_album", input: { albumId: 3 }, summary: "s", conversationId: "c1" });
    m.run.mockResolvedValue({ ok: true, message: "Listo", before: { b: 1 }, after: { a: 2 } });
    const res = await POST(req("confirmar"), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: "Listo", canUndo: true });
    expect(m.claim).toHaveBeenCalledWith("a1", 7);
    expect(m.run).toHaveBeenCalledTimes(1);
    expect(m.finish).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "EXECUTED", before: { b: 1 } }));
    expect(JSON.stringify(m.append.mock.calls[0]![1])).toContain("confirmó");
  });
  it("segunda confirmación (ya tomada, vencida o ajena) → 409 sin ejecutar", async () => {
    m.claim.mockResolvedValue(null);
    const res = await POST(req("confirmar"), params);
    expect(res.status).toBe(409);
    expect(m.run).not.toHaveBeenCalled();
  });
  it("si la herramienta falla, queda FAILED", async () => {
    m.claim.mockResolvedValue({ id: "a1", userId: 7, toolName: "actualizar_album", input: {}, summary: "s", conversationId: "c1" });
    m.run.mockResolvedValue({ ok: false, message: "Precio bajo" });
    await POST(req("confirmar"), params);
    expect(m.finish).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "FAILED" }));
  });
  it("si la herramienta tira una excepción, queda FAILED y no se cae", async () => {
    m.claim.mockResolvedValue({ id: "a1", userId: 7, toolName: "actualizar_album", input: {}, summary: "s", conversationId: "c1" });
    m.run.mockRejectedValue(new Error("db caída"));
    const res = await POST(req("confirmar"), params);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(false);
    expect(m.finish).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "FAILED" }));
  });
  it("datos guardados que ya no validan → FAILED + 400 sin ejecutar", async () => {
    m.claim.mockResolvedValue({ id: "a1", userId: 7, toolName: "actualizar_album", input: { albumId: "x" }, summary: "s", conversationId: "c1" });
    m.parse.mockReturnValue({ success: false, error: new Error("inválido") });
    const res = await POST(req("confirmar"), params);
    expect(res.status).toBe(400);
    expect(m.run).not.toHaveBeenCalled();
    expect(m.finish).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "FAILED" }));
  });
  it("herramienta inexistente para el actor → FAILED + 400 sin ejecutar", async () => {
    m.claim.mockResolvedValue({ id: "a1", userId: 7, toolName: "borrar_album", input: {}, summary: "s", conversationId: "c1" });
    const res = await POST(req("confirmar"), params);
    expect(res.status).toBe(400);
    expect(m.run).not.toHaveBeenCalled();
    expect(m.finish).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "FAILED" }));
  });
  it("rechazar pendiente → 200; ya decidida → 409", async () => {
    m.reject.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await POST(req("rechazar"), params)).status).toBe(200);
    expect(m.reject).toHaveBeenCalledWith("a1", 7);
    expect((await POST(req("rechazar"), params)).status).toBe(409);
    expect(m.run).not.toHaveBeenCalled();
  });
  it("deshacer dentro de los 10 minutos corre el undo una vez", async () => {
    m.find.mockResolvedValue({ id: "a1", toolName: "actualizar_album", before: { b: 1 }, decidedAt: new Date(Date.now() - 60_000), conversationId: "c1" });
    m.undo.mockResolvedValue({ ok: true, message: "Volví atrás" });
    const res = await POST(req("deshacer"), params);
    expect(res.status).toBe(200);
    expect(m.undo).toHaveBeenCalledWith({ b: 1 }, expect.objectContaining({ userId: 7 }));
    expect(m.upd).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "a1", status: "EXECUTED" }, data: { status: "UNDONE" } }));
    expect(JSON.stringify(m.append.mock.calls[0]![1])).toContain("deshizo");
  });
  it("deshacer fuera de la ventana de 10 minutos → 409 sin correr el undo", async () => {
    m.find.mockResolvedValue({ id: "a1", toolName: "actualizar_album", before: { b: 1 }, decidedAt: new Date(Date.now() - 11 * 60_000), conversationId: "c1" });
    const res = await POST(req("deshacer"), params);
    expect(res.status).toBe(409);
    expect(m.undo).not.toHaveBeenCalled();
    expect(m.upd).not.toHaveBeenCalled();
  });
  it("deshacer una acción de otro usuario → 409 sin correr el undo (la búsqueda filtra por dueño)", async () => {
    m.find.mockResolvedValue(null);
    const res = await POST(req("deshacer"), params);
    expect(res.status).toBe(409);
    expect(m.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "a1", userId: 7 }) }));
    expect(m.undo).not.toHaveBeenCalled();
    expect(m.upd).not.toHaveBeenCalled();
  });
  it("deshacer dos veces a la vez → el segundo no corre el undo", async () => {
    m.find.mockResolvedValue({ id: "a1", toolName: "actualizar_album", before: { b: 1 }, decidedAt: new Date(), conversationId: "c1" });
    m.upd.mockResolvedValue({ count: 0 });
    const res = await POST(req("deshacer"), params);
    expect(res.status).toBe(409);
    expect(m.undo).not.toHaveBeenCalled();
  });
  it("si el undo falla, la acción vuelve a EXECUTED para poder reintentar", async () => {
    m.find.mockResolvedValue({ id: "a1", toolName: "actualizar_album", before: { b: 1 }, decidedAt: new Date(), conversationId: "c1" });
    m.undo.mockResolvedValue({ ok: false, message: "No se pudo" });
    const res = await POST(req("deshacer"), params);
    expect(await res.json()).toMatchObject({ ok: false, canUndo: true });
    expect(m.upd).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "a1", status: "UNDONE" }, data: { status: "EXECUTED" } }));
  });
  it("confirmar sin before guardado → no ofrece deshacer", async () => {
    m.claim.mockResolvedValue({ id: "a1", userId: 7, toolName: "actualizar_album", input: { albumId: 3 }, summary: "s", conversationId: "c1" });
    m.run.mockResolvedValue({ ok: true, message: "Listo" });
    const res = await POST(req("confirmar"), params);
    expect(await res.json()).toEqual({ ok: true, message: "Listo", canUndo: false });
  });
});
