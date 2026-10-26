import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ admin: vi.fn(), find: vi.fn(), evento: vi.fn(), oldUpdate: vi.fn() }));
vi.mock("@/lib/soporte/admin-auth", () => ({ soloAdmin: (...a: unknown[]) => m.admin(...a) }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => (await m.admin()).ok ? { error: null, user: { id: 1 } } : { error: "x", user: null } }));
vi.mock("@/lib/prisma", () => ({ prisma: { supportTicket: { findMany: (...a: unknown[]) => m.find(...a), update: (...a: unknown[]) => m.oldUpdate(...a), findUnique: vi.fn() } } }));
vi.mock("@/lib/soporte/aplicar-evento", () => ({ aplicarEvento: (...a: unknown[]) => m.evento(...a) }));
import { GET } from "./route";
import { PATCH } from "../tickets/[id]/route";

const now = new Date("2026-10-26T12:00:00Z");
const hace = (h: number) => new Date(now.getTime() - h * 3_600_000);
const fila = (over: Record<string, unknown>) => ({
  id: 60, status: "OPEN", reason: "PAYMENT_FAILED", description: "[Comprador · mail sin verificar] Motivo: otro. No puede pagar el pack", requesterRole: "CUSTOMER",
  createdAt: hace(19), updatedAt: hace(1), slaDesde: null, esperandoDesde: null, clienteRespondioAt: null, clienteEscribioAt: null,
  diagnostico: { estado: "LISTO", resumen: "4 rechazos del banco", mailSinVerificar: true }, messages: [{ id: 1 }], ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  m.admin.mockReset().mockResolvedValue({ ok: true, user: { id: 1, name: "Daniel", email: "d@x.com" } });
  m.find.mockReset().mockResolvedValue([
    fila({}),
    fila({ id: 55, status: "WAITING_CUSTOMER", requesterRole: "PHOTOGRAPHER", esperandoDesde: hace(5), clienteEscribioAt: hace(2), diagnostico: null, messages: [] }),
  ]);
  m.evento.mockReset().mockResolvedValue({ status: "WAITING_CUSTOMER" });
});

describe("GET /api/admin/support/tablero", () => {
  it("sin admin → 401", async () => {
    m.admin.mockResolvedValue({ ok: false, res: NextResponse.json({}, { status: 401 }) });
    expect((await GET()).status).toBe(401);
  });

  it("trae abiertos y los resueltos de los últimos 30 días, con reloj, rol y marcas", async () => {
    const res = await GET();
    const where = m.find.mock.calls[0]![0].where;
    expect(JSON.stringify(where)).toContain(new Date(now.getTime() - 30 * 86_400_000).toISOString());
    const { fichas } = await res.json();
    expect(fichas[0]).toMatchObject({ id: 60, rol: "Comprador", vieneDelBot: true, resumen: "4 rechazos del banco", mailSinVerificar: true, reloj: { color: "amarillo" }, titulo: "No puede pagar el pack" });
    expect(fichas[1]).toMatchObject({ id: 55, rol: "Fotógrafo", vieneDelBot: false, reloj: null, clienteEscribio: true, clienteRespondio: false });
  });
});

describe("PATCH /api/admin/support/tickets/[id]", () => {
  it("mover la ficha aplica el evento del tablero", async () => {
    const req = new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "WAITING_CUSTOMER" }) }) as never;
    const res = await PATCH(req, { params: Promise.resolve({ id: "60" }) });
    expect(res.status).toBe(200);
    expect(m.evento).toHaveBeenCalledWith(60, { tipo: "ADMIN_MOVIO", a: "WAITING_CUSTOMER" });
    expect(m.oldUpdate).not.toHaveBeenCalled();
  });
});
