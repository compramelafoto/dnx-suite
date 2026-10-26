import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ admin: vi.fn(), responder: vi.fn() }));
vi.mock("@/lib/soporte/admin-auth", () => ({ soloAdmin: (...a: unknown[]) => m.admin(...a) }));
vi.mock("@/lib/soporte/responder", () => ({ responderTicket: (...a: unknown[]) => m.responder(...a) }));
import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "60" }) };
const pedido = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never;
const valido = { mensaje: "Hola", acciones: [{ herramienta: "reenviar_descarga", input: {} }], idempotencyKey: "6f1c1d1e-2b2a-4c3d-9e8f-0a1b2c3d4e5f" };

beforeEach(() => {
  m.admin.mockReset().mockResolvedValue({ ok: true, user: { id: 1, name: "Daniel", email: "d@x.com" } });
  m.responder.mockReset().mockResolvedValue({ ok: true, mensajeId: 9, acciones: [] });
});

describe("POST /api/admin/support/tickets/[id]/responder", () => {
  it("sin admin → 401 y no responde nada", async () => {
    m.admin.mockResolvedValue({ ok: false, res: NextResponse.json({}, { status: 401 }) });
    expect((await POST(pedido(valido), ctx)).status).toBe(401);
    expect(m.responder).not.toHaveBeenCalled();
  });

  it("datos inválidos (mensaje vacío, acción fuera del catálogo o sin clave) → 400", async () => {
    for (const body of [{ ...valido, mensaje: "" }, { ...valido, acciones: [{ herramienta: "devolver_dinero", input: {} }] }, { ...valido, idempotencyKey: "x" }]) {
      expect((await POST(pedido(body), ctx)).status).toBe(400);
    }
    expect(m.responder).not.toHaveBeenCalled();
  });

  it("ok → 200 con el resultado; fallas de acciones → 409; ticket inexistente → 404", async () => {
    const ok = await POST(pedido(valido), ctx);
    expect(ok.status).toBe(200);
    expect(m.responder.mock.calls[0]![0]).toMatchObject({ ticketId: 60, mensaje: "Hola", idempotencyKey: valido.idempotencyKey, admin: { id: 1 } });
    m.responder.mockResolvedValue({ ok: false, fallas: [{ herramienta: "reenviar_descarga", mensaje: "no" }] });
    expect((await POST(pedido(valido), ctx)).status).toBe(409);
    m.responder.mockResolvedValue({ ok: false, noEncontrado: true });
    expect((await POST(pedido(valido), ctx)).status).toBe(404);
  });
});
