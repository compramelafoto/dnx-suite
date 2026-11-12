import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { esMimeDeComprobante, verificarComprobante } = await import("./verificar-servidor");
type Deps = NonNullable<Parameters<typeof verificarComprobante>[3]>;

const CTX = { workspaceId: "w1", userId: 1, userLabel: "Cami", role: "STAFF", acceso: {} } as never;
const LEIDO = { esComprobante: true, operacion: "187817727381", monto: 10000, fecha: "2026-11-10T19:15:00Z", origen: "Veronica", destinatario: "Daniel Cuart" };

function deps(extra: Partial<Deps> = {}) {
  const sistema = vi.fn(async () => undefined);
  const d: Deps = {
    imagen: async () => ({ chatId: "c1", bytes: Buffer.from("x"), mime: "image/jpeg" }),
    leer: async () => LEIDO,
    pagoPorOperacion: async () => ({ id: "187817727381", monto: 10000, estado: "approved", fecha: "2026-11-10T19:15:10Z", pagador: "Veronica" }),
    pagosDelMonto: async () => [],
    sistema,
    ...extra,
  };
  return { d, sistema };
}

describe("verificarComprobante", () => {
  it("lee el comprobante, encuentra la operación y deja el resultado en el chat", async () => {
    const { d, sistema } = deps();
    const r = await verificarComprobante(CTX, "c1", "m1", d);
    expect(r).toMatchObject({ ok: true, estado: "CONFIRMADO" });
    expect(sistema).toHaveBeenCalledWith("w1", "c1", expect.stringContaining("Cami verificó un comprobante: Pago confirmado"));
  });

  it("si la operación no está, busca por monto alrededor de la fecha", async () => {
    const pagosDelMonto = vi.fn(async () => [{ id: "9", monto: 10000, estado: "approved", fecha: "2026-11-10T19:20:00Z", pagador: null }]);
    const { d } = deps({ pagoPorOperacion: async () => null, pagosDelMonto });
    expect(await verificarComprobante(CTX, "c1", "m1", d)).toMatchObject({ ok: true, estado: "PROBABLE" });
    expect(pagosDelMonto).toHaveBeenCalledWith("w1", 10000, "2026-11-10T19:15:00Z");
  });

  it("sin imagen de ese chat, o sin Mercado Pago conectado, avisa sin inventar", async () => {
    expect(await verificarComprobante(CTX, "c1", "m1", deps({ imagen: async () => null }).d)).toEqual({ ok: false, error: "No encontramos esa imagen o PDF en el chat." });
    const sinMp = deps({ pagoPorOperacion: async () => { throw new Error("NOT_CONNECTED"); } }).d;
    expect(await verificarComprobante(CTX, "c1", "m1", sinMp)).toEqual({ ok: false, error: "No se pudo consultar Mercado Pago. Revisá que esté conectado en Configuración → Cobros." });
  });

  it("si la IA no pudo leer la imagen, lo dice", async () => {
    expect(await verificarComprobante(CTX, "c1", "m1", deps({ leer: async () => null }).d)).toEqual({ ok: false, error: "No pude leer el comprobante. Probá de nuevo o revisalo a mano." });
  });
});

describe("esMimeDeComprobante", () => {
  it("acepta imágenes y el PDF que mandan los bancos; nada más", () => {
    expect(esMimeDeComprobante("image/jpeg")).toBe(true);
    expect(esMimeDeComprobante("application/pdf")).toBe(true);
    expect(esMimeDeComprobante("application/msword")).toBe(false);
    expect(esMimeDeComprobante(null)).toBe(false);
  });
});
