import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { crearPedidoDeCatalogoDesdeWhatsapp } = await import("./whatsapp-servidor");
const { claveDelAlta } = await import("./whatsapp");

const CHAT = { id: "chat1", waId: "5493413748324", clientId: null, nombre: "Daniel" };
const CTX = { workspaceId: "w1", userId: 4, userLabel: "Bot de WhatsApp", role: "WORKSPACE_OWNER" };
const CATALOGO = [
  { id: "vhs", name: "Digitalización de VHS", priceMinor: 1_200_000, variants: [] },
  { id: "p64", name: "Pendrive 64 GB", priceMinor: 2_600_000, variants: [] },
];

function deps(extra: Record<string, unknown> = {}) {
  const crear = vi.fn(async (_ctx: unknown, _datos: Record<string, unknown>) => ({ ok: true as const, pedidoId: "ped1", numero: "2026-0042" }));
  const cancelar = vi.fn(async () => undefined);
  const cliente = vi.fn(async () => "cli1");
  const avisar = vi.fn(async () => undefined);
  return {
    crear, cancelar, cliente, avisar,
    d: {
      moduloEncendido: async () => true,
      productos: async () => CATALOGO,
      ctxDelDuenio: async () => CTX,
      cliente,
      pendientesDelChat: async () => [] as { id: string; altaKey: string | null }[],
      cancelar,
      crear,
      enlace: async () => "https://fotoffice.com/p/tok",
      avisar,
      ahora: () => new Date("2026-10-28T20:00:00Z"),
      ...extra,
    },
  };
}

describe("crearPedidoDeCatalogoDesdeWhatsapp", () => {
  it("5 VHS con pendrive y seña: pedido con dos cuotas y el enlace para pagar", async () => {
    const { d, crear, cliente, avisar } = deps();
    const r = await crearPedidoDeCatalogoDesdeWhatsapp("w1", CHAT, {
      lineas: [{ producto: "digitalizacion de vhs", cantidad: 5 }, { producto: "pendrive 64", cantidad: 1 }],
      pago: "SENA", nombre: "Daniel Cuart", email: "Cliente@Mail.com",
    }, d);
    expect(r).toEqual({
      ok: true, numero: "2026-0042",
      lineas: [{ nombre: "Digitalización de VHS", cantidad: 5, precio: 12000 }, { nombre: "Pendrive 64 GB", cantidad: 1, precio: 26000 }],
      total: 86000, aPagarAhora: 43000, saldo: 43000, url: "https://fotoffice.com/p/tok",
    });
    expect(cliente).toHaveBeenCalledWith("w1", CHAT, "Daniel Cuart", "cliente@mail.com");
    const datos = crear.mock.calls[0][1];
    expect(datos).toMatchObject({
      clientId: "cli1",
      opcion: { tipo: "CUOTAS", cuotas: 2 },
      plan: [{ dueDate: "2026-10-28", amountArs: 43000 }, { dueDate: "2026-11-04", amountArs: 43000 }],
      clave: claveDelAlta("chat1", [{ productId: "vhs", variantId: null, cantidad: 5 }, { productId: "p64", variantId: null, cantidad: 1 }], "SENA"),
    });
    expect((datos.items as unknown[])[0]).toMatchObject({ productId: "vhs", cantidad: 5, precioUnitario: 12000, modoPrecio: "LISTA" });
    expect(avisar).toHaveBeenCalledWith("w1", "ped1");
  });

  it("al contado: una sola cuota por el total", async () => {
    const { d, crear } = deps();
    const r = await crearPedidoDeCatalogoDesdeWhatsapp("w1", CHAT, { lineas: [{ producto: "Digitalización de VHS", cantidad: 2 }], pago: "TOTAL", nombre: "Ana" }, d);
    expect(r).toMatchObject({ ok: true, total: 24000, aPagarAhora: 24000, saldo: 0 });
    expect(crear.mock.calls[0][1]).toMatchObject({ opcion: { tipo: "CONTADO" }, plan: [{ dueDate: "2026-10-28", amountArs: 24000 }] });
  });

  it("si el cliente cambia el pedido, cancela el anterior sin pagar (no el mismo)", async () => {
    const mismo = claveDelAlta("chat1", [{ productId: "vhs", variantId: null, cantidad: 3 }], "SENA");
    const { d, cancelar } = deps({ pendientesDelChat: async () => [{ id: "viejo", altaKey: "wa-chat1-aaaaaaaaaaaa" }, { id: "igual", altaKey: mismo }] });
    await crearPedidoDeCatalogoDesdeWhatsapp("w1", CHAT, { lineas: [{ producto: "vhs", cantidad: 3 }], pago: "SENA", nombre: "Ana" }, d);
    expect(cancelar).toHaveBeenCalledTimes(1);
    expect(cancelar).toHaveBeenCalledWith(CTX, "viejo");
  });

  it("un producto ambiguo o que no está no crea nada", async () => {
    const { d, crear } = deps({ productos: async () => [...CATALOGO, { id: "p128", name: "Pendrive 128 GB", priceMinor: 4_500_000, variants: [] }] });
    const r = await crearPedidoDeCatalogoDesdeWhatsapp("w1", CHAT, { lineas: [{ producto: "pendrive", cantidad: 1 }], pago: "SENA", nombre: "Ana" }, d);
    expect(r).toEqual({ ok: false, motivo: "PRODUCTO", detalle: '"pendrive" puede ser: Pendrive 64 GB, Pendrive 128 GB.' });
    const r2 = await crearPedidoDeCatalogoDesdeWhatsapp("w1", CHAT, { lineas: [{ producto: "dron", cantidad: 1 }], pago: "SENA", nombre: "Ana" }, d);
    expect(r2).toMatchObject({ ok: false, motivo: "PRODUCTO" });
    expect(crear).not.toHaveBeenCalled();
  });

  it("sin el módulo de pedidos, no vende", async () => {
    const { d, crear } = deps({ moduloEncendido: async () => false });
    expect(await crearPedidoDeCatalogoDesdeWhatsapp("w1", CHAT, { lineas: [{ producto: "vhs", cantidad: 1 }], pago: "SENA", nombre: "Ana" }, d)).toEqual({ ok: false, motivo: "MODULO" });
    expect(crear).not.toHaveBeenCalled();
  });
});
