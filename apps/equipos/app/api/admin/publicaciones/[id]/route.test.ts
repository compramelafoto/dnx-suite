import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isSuperAdmin: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
}));
vi.mock("@repo/auth-guards", () => ({
  getCurrentUser: m.getCurrentUser,
  isSuperAdmin: m.isSuperAdmin,
}));
vi.mock("@/lib/publicaciones/moderacion", () => ({
  approveListing: m.approve,
  rejectListing: m.reject,
}));

import { EquipoError } from "@/lib/inventario/equipos";
import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "7" }) };
const pedido = (body: unknown) =>
  new Request("http://localhost/api/admin/publicaciones/7", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.getCurrentUser.mockResolvedValue({ id: 1 });
  m.isSuperAdmin.mockResolvedValue(true);
  m.approve.mockResolvedValue(undefined);
  m.reject.mockResolvedValue(undefined);
});

describe("POST /api/admin/publicaciones/[id]", () => {
  it("sin sesión -> 403", async () => {
    m.getCurrentUser.mockResolvedValue(null);
    expect((await POST(pedido({ accion: "aprobar" }), ctx)).status).toBe(403);
  });

  it("sin super admin -> 403 y no toca nada", async () => {
    m.isSuperAdmin.mockResolvedValue(false);
    expect((await POST(pedido({ accion: "aprobar" }), ctx)).status).toBe(403);
    expect(m.approve).not.toHaveBeenCalled();
    expect(m.reject).not.toHaveBeenCalled();
  });

  it("aprobar -> 200", async () => {
    expect((await POST(pedido({ accion: "aprobar" }), ctx)).status).toBe(200);
    expect(m.approve).toHaveBeenCalledWith(1, 7);
  });

  it("rechazar exige nota -> 400", async () => {
    expect((await POST(pedido({ accion: "rechazar", nota: "  " }), ctx)).status).toBe(400);
    expect(m.reject).not.toHaveBeenCalled();
  });

  it("rechazar con nota -> 200", async () => {
    expect((await POST(pedido({ accion: "rechazar", nota: " Serie robada " }), ctx)).status).toBe(200);
    expect(m.reject).toHaveBeenCalledWith(1, 7, "Serie robada");
  });

  it("acción inválida -> 400", async () => {
    expect((await POST(pedido({ accion: "otra" }), ctx)).status).toBe(400);
  });

  it("publicación que no está en revisión -> 409", async () => {
    m.approve.mockRejectedValue(new EquipoError("DATO_INVALIDO", "x"));
    expect((await POST(pedido({ accion: "aprobar" }), ctx)).status).toBe(409);
  });

  it("publicación inexistente -> 404", async () => {
    m.reject.mockRejectedValue(new EquipoError("NO_ENCONTRADO"));
    expect((await POST(pedido({ accion: "rechazar", nota: "x" }), ctx)).status).toBe(404);
  });
});
