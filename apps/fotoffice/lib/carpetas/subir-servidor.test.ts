import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ bucketR2Privado: () => "b", clienteR2Privado: () => ({ send }) }));
const S = await import("./subir-servidor");

beforeEach(() => vi.clearAllMocks());

describe("subirBuffer", () => {
  it.each(["otra/cosa.jpg", "../trabajos/x", "trabajos/../secreto", "impresiones-mini/../x"])("rechaza la clave %s", async (k) => {
    await expect(S.subirBuffer(k, Buffer.from("x"), "image/jpeg")).rejects.toThrow("Clave no permitida");
    expect(send).not.toHaveBeenCalled();
  });
  it.each(["trabajos/a/b.jpg", "impresiones-mini/a.jpg"])("acepta la clave %s", async (k) => {
    await S.subirBuffer(k, Buffer.from("x"), "image/jpeg");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
