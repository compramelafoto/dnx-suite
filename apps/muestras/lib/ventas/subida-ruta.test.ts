import { beforeEach, describe, expect, it, vi } from "vitest";

const autor = vi.hoisted(() => ({ pedirSubidaDeOriginal: vi.fn() }));
vi.mock("@/lib/ventas/autor", () => autor);
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => ({ id: 50, esSuperAdmin: false, email: "a@x", name: "A" }) }));

const { POST } = await import("@/app/api/ventas/subida/route");

const pedido = (headers: Record<string, string>) => {
  const fd = new FormData();
  fd.set("activityWorkId", "aw1");
  fd.set("mime", "image/jpeg");
  fd.set("bytes", "1000");
  return new Request("https://muestras.test/api/ventas/subida", { method: "POST", body: fd, headers });
};

beforeEach(() => {
  vi.clearAllMocks();
  autor.pedirSubidaDeOriginal.mockResolvedValue({ ok: true, url: "https://r2/x", clave: "originales/50/aw1-abcdefghijkl" });
});

describe("pedir la subida del original", () => {
  it("del mismo sitio (Origin o Sec-Fetch-Site): sí", async () => {
    expect((await POST(pedido({ origin: "https://muestras.test" }))).status).toBe(200);
    expect((await POST(pedido({ "sec-fetch-site": "same-origin" }))).status).toBe(200);
  });
  it("de otro sitio, o sin Origin ni Sec-Fetch-Site: 403 sin pedir nada", async () => {
    expect((await POST(pedido({ origin: "https://otro.test" }))).status).toBe(403);
    expect((await POST(pedido({}))).status).toBe(403);
    expect((await POST(pedido({ "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(autor.pedirSubidaDeOriginal).not.toHaveBeenCalled();
  });
});
