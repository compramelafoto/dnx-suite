import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: m.update } } }));
import { registrarUltimoIngreso } from "./registrar-ultimo-ingreso";

beforeEach(() => { m.update.mockReset(); });

describe("registrarUltimoIngreso", () => {
  it("escribe lastLoginAt del usuario", async () => {
    m.update.mockResolvedValue({});
    registrarUltimoIngreso(9, "GOOGLE CALLBACK");
    await Promise.resolve();
    const a = m.update.mock.calls[0]![0];
    expect(a.where).toEqual({ id: 9 });
    expect(a.data.lastLoginAt).toBeInstanceOf(Date);
  });
  it("si falla no tira: sólo avisa", async () => {
    m.update.mockImplementation(() => Promise.reject(new Error("x")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => registrarUltimoIngreso(9, "GOOGLE CALLBACK")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledWith("GOOGLE CALLBACK: error actualizando lastLoginAt", expect.any(Error));
  });
});
