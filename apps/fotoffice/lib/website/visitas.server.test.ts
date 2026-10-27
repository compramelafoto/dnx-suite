import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany, count, upsert, update } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  count: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: { fotofficeSitioVisita: { updateMany, count, upsert, update } },
}));

const { sumarVisita } = await import("./visitas.server");
const { MAX_RUTAS_POR_DIA } = await import("./visitas");

const AHORA = new Date("2026-10-28T01:00:00Z"); // 27/10 en Argentina
const FECHA = new Date("2026-10-27T00:00:00.000Z");

describe("sumarVisita", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockResolvedValue({ id: "x" });
  });

  it("una ruta que ya tiene fila sólo se incrementa", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await sumarVisita("ws", "/blog/x", AHORA);
    expect(updateMany).toHaveBeenCalledWith({ where: { workspaceId: "ws", ruta: "/blog/x", fecha: FECHA }, data: { visitas: { increment: 1 } } });
    expect(count).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("una ruta nueva se crea mientras el sitio no llegó al tope del día", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    count.mockResolvedValue(MAX_RUTAS_POR_DIA - 1);
    await sumarVisita("ws", "/blog/x", AHORA);
    expect(count).toHaveBeenCalledWith({ where: { workspaceId: "ws", fecha: FECHA } });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("pasado el tope de rutas distintas del día, una ruta nueva no crea fila", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    count.mockResolvedValue(MAX_RUTAS_POR_DIA);
    await sumarVisita("ws", "/blog/x999", AHORA);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("sin la tabla no rompe", async () => {
    updateMany.mockRejectedValue({ code: "P2021" });
    await expect(sumarVisita("ws", "/", AHORA)).resolves.toBeUndefined();
  });
});
