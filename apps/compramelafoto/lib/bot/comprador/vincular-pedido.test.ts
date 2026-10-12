import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { update: m.update } } }));
import { vincularPedidoConBot } from "./vincular-pedido";

const CLAVE = "0123456789abcdef0123456789abcdef";

beforeEach(() => {
  m.update.mockReset();
  vi.restoreAllMocks();
});

describe("vincularPedidoConBot", () => {
  it("sin cookie no consulta la base", async () => {
    await vincularPedidoConBot(10, null);
    await vincularPedidoConBot(10, "otra=1; sesion=abc");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("con una cookie del bot inválida no consulta la base", async () => {
    await vincularPedidoConBot(10, "dnxbot_guest=no-es-hex");
    await vincularPedidoConBot(10, `dnxbot_guest=${CLAVE.toUpperCase()}`);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("con una cookie válida guarda la clave del invitado en el pedido", async () => {
    m.update.mockResolvedValue({ id: 10 });
    await vincularPedidoConBot(10, `sesion=abc; dnxbot_guest=${CLAVE}`);
    expect(m.update).toHaveBeenCalledTimes(1);
    expect(m.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { botGuestKey: CLAVE }, select: { id: true } });
  });

  it("si la base falla, no propaga el error", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.update.mockRejectedValue(new Error("db caída"));
    await expect(vincularPedidoConBot(10, `dnxbot_guest=${CLAVE}`)).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
  });
});
