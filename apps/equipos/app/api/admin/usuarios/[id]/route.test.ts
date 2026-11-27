import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isSuperAdmin: vi.fn(),
  block: vi.fn(),
  unblock: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock("@repo/auth-guards", () => ({
  getCurrentUser: m.getCurrentUser,
  isSuperAdmin: m.isSuperAdmin,
}));
vi.mock("@/lib/usuarios/bloqueo", () => ({ blockAccount: m.block, unblockAccount: m.unblock }));
vi.mock("@/lib/usuarios/reportes", () => ({ resolveUserReport: m.resolve }));

import { EquipoError } from "@/lib/inventario/equipos";
import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "9" }) };
const pedido = (body: unknown) =>
  new Request("http://localhost/api/admin/usuarios/9", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.getCurrentUser.mockResolvedValue({ id: 1 });
  m.isSuperAdmin.mockResolvedValue(true);
  m.block.mockResolvedValue(undefined);
  m.unblock.mockResolvedValue(undefined);
  m.resolve.mockResolvedValue(undefined);
});

describe("POST /api/admin/usuarios/[id]", () => {
  it("sin sesión -> 403", async () => {
    m.getCurrentUser.mockResolvedValue(null);
    expect((await POST(pedido({ accion: "desbloquear" }), ctx)).status).toBe(403);
  });

  it("sin super admin -> 403 y no toca nada", async () => {
    m.isSuperAdmin.mockResolvedValue(false);
    for (const body of [
      { accion: "bloquear", motivo: "Motivo suficientemente largo" },
      { accion: "desbloquear" },
      { accion: "resolver", reportId: 3, resolucion: "Listo" },
    ]) {
      expect((await POST(pedido(body), ctx)).status).toBe(403);
    }
    expect(m.block).not.toHaveBeenCalled();
    expect(m.unblock).not.toHaveBeenCalled();
    expect(m.resolve).not.toHaveBeenCalled();
  });

  it("bloquear -> 200 con el motivo", async () => {
    const res = await POST(pedido({ accion: "bloquear", motivo: "Motivo suficientemente largo" }), ctx);
    expect(res.status).toBe(200);
    expect(m.block).toHaveBeenCalledWith(1, 9, "Motivo suficientemente largo");
  });

  it("desbloquear -> 200", async () => {
    expect((await POST(pedido({ accion: "desbloquear" }), ctx)).status).toBe(200);
    expect(m.unblock).toHaveBeenCalledWith(1, 9);
  });

  it("resolver -> 200; sin reportId -> 400", async () => {
    expect((await POST(pedido({ accion: "resolver", reportId: 3, resolucion: "Listo" }), ctx)).status).toBe(200);
    expect(m.resolve).toHaveBeenCalledWith(1, 3, "Listo");
    expect((await POST(pedido({ accion: "resolver", resolucion: "Listo" }), ctx)).status).toBe(400);
  });

  it("acción inválida o id inválido -> 400", async () => {
    expect((await POST(pedido({ accion: "borrar" }), ctx)).status).toBe(400);
    expect(
      (await POST(pedido({ accion: "desbloquear" }), { params: Promise.resolve({ id: "x" }) })).status,
    ).toBe(400);
  });

  it("error de la librería -> 409 con su texto; inexistente -> 404", async () => {
    m.block.mockRejectedValue(new EquipoError("DATO_INVALIDO", "Esta cuenta ya está bloqueada."));
    const res = await POST(pedido({ accion: "bloquear", motivo: "Motivo suficientemente largo" }), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Esta cuenta ya está bloqueada." });
    m.unblock.mockRejectedValue(new EquipoError("NO_ENCONTRADO"));
    expect((await POST(pedido({ accion: "desbloquear" }), ctx)).status).toBe(404);
  });

  it("error inesperado -> 500", async () => {
    m.unblock.mockRejectedValue(new Error("db caída"));
    expect((await POST(pedido({ accion: "desbloquear" }), ctx)).status).toBe(500);
  });
});
