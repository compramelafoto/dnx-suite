import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "@repo/dnx-bot";

const m = vi.hoisted(() => ({ user: vi.fn(), conv: vi.fn(), create: vi.fn(), finish: vi.fn(), fotografo: vi.fn(), comprador: vi.fn(), run: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: (...a: unknown[]) => m.user(...a) },
    botConversation: { findFirst: (...a: unknown[]) => m.conv(...a) },
    botAction: { create: (...a: unknown[]) => m.create(...a) },
  },
}));
vi.mock("@/lib/bot/store", () => ({ finishAction: (...a: unknown[]) => m.finish(...a) }));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF" }));
vi.mock("@/lib/bot/herramientas", () => ({ toolsForActor: (...a: unknown[]) => m.fotografo(...a) }));
vi.mock("@/lib/bot/comprador/herramientas", () => ({ herramientasComprador: (...a: unknown[]) => m.comprador(...a) }));
import { ejecutarAccionDeTicket } from "./acciones";

const admin = { id: 1, name: "Daniel" };
const compradorT = { id: 60, requesterEmail: "ana@x.com", requesterRole: "CUSTOMER" };
const fotografoT = { id: 55, requesterEmail: "foto@x.com", requesterRole: "PHOTOGRAPHER" };
const herramienta = (name: string, kind: "read" | "write", input: z.ZodType) => ({ name, kind, input, description: name, run: (...a: unknown[]) => m.run(name, ...a) });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.create.mockResolvedValue({ id: "a1" });
  m.conv.mockResolvedValue({ id: "c1" });
  m.user.mockResolvedValue({ id: 7, role: "PHOTOGRAPHER", email: "foto@x.com", name: "Fede" });
  m.run.mockResolvedValue({ ok: true, message: "Listo", before: { x: 1 }, after: { x: 2 } });
  m.comprador.mockReturnValue([
    herramienta("reenviar_descarga", "read", z.strictObject({ email: z.string().optional(), pedido: z.number().optional() })),
    herramienta("solicitar_quitar_foto", "read", z.strictObject({})),
  ]);
  m.fotografo.mockReturnValue([herramienta("extender_vencimiento", "write", z.strictObject({ albumId: z.number(), dias: z.number().default(30) }))]);
});

describe("ejecutarAccionDeTicket", () => {
  it("fuera del catálogo → no ejecuta nada", async () => {
    const r = await ejecutarAccionDeTicket(compradorT, { herramienta: "solicitar_quitar_foto" as never, input: {} }, admin);
    expect(r.ok).toBe(false);
    expect(m.run).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("datos inválidos → no ejecuta", async () => {
    const r = await ejecutarAccionDeTicket(fotografoT, { herramienta: "extender_vencimiento", input: { albumId: "x" } }, admin);
    expect(r.ok).toBe(false);
    expect(m.run).not.toHaveBeenCalled();
  });

  it("fotógrafo sin cuenta con ese mail → no ejecuta", async () => {
    m.user.mockResolvedValue(null);
    expect((await ejecutarAccionDeTicket(fotografoT, { herramienta: "extender_vencimiento", input: { albumId: 3 } }, admin)).ok).toBe(false);
    expect(m.run).not.toHaveBeenCalled();
  });

  it("fotógrafo: corre la escritura como el dueño, sin pedirle confirmación", async () => {
    const r = await ejecutarAccionDeTicket(fotografoT, { herramienta: "extender_vencimiento", input: { albumId: 3 } }, admin);
    expect(r).toMatchObject({ ok: true });
    expect(m.run).toHaveBeenCalledWith("extender_vencimiento", { albumId: 3, dias: 30 }, expect.objectContaining({ userId: 7 }));
  });

  it("comprador: siempre sobre los pedidos del mail del ticket, aunque pidan otro mail", async () => {
    await ejecutarAccionDeTicket(compradorT, { herramienta: "reenviar_descarga", input: { pedido: 99, email: "otra@x.com" } }, admin);
    expect(m.run.mock.calls[0]![1]).toEqual({ pedido: 99, email: "ana@x.com" });
    expect(m.comprador.mock.calls[0]![0]).toMatchObject({ emailVerificado: "ana@x.com", conversationId: "c1" });
  });

  it("deja registro: autor admin, ticket de origen, antes y después", async () => {
    await ejecutarAccionDeTicket(fotografoT, { herramienta: "extender_vencimiento", input: { albumId: 3 } }, admin);
    expect(m.create.mock.calls[0]![0].data).toMatchObject({ platform: "CLF", userId: 1, conversationId: "c1", toolName: "extender_vencimiento" });
    expect(m.create.mock.calls[0]![0].data.summary).toContain("Aplicada por Daniel desde el ticket #55");
    expect(m.finish).toHaveBeenCalledWith("a1", { status: "EXECUTED", before: { x: 1 }, after: { x: 2 }, resultMessage: "Listo" });
  });

  it("si la herramienta falla o lanza, queda FAILED y devuelve el error", async () => {
    m.run.mockRejectedValueOnce(new Error("boom"));
    const r = await ejecutarAccionDeTicket(fotografoT, { herramienta: "extender_vencimiento", input: { albumId: 3 } }, admin);
    expect(r.ok).toBe(false);
    expect(m.finish.mock.calls[0]![1]).toMatchObject({ status: "FAILED" });
  });
});
