import { beforeEach, describe, expect, it, vi } from "vitest";

const { testimonio } = vi.hoisted(() => ({
  testimonio: { findMany: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: { fotofficeTestimonio: testimonio } }));

const { listarTestimoniosPublicos, hayTestimoniosPublicados } = await import("./publico");

const fila = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  texto: "Hermosas fotos",
  extracto: null,
  autorNombre: "Sofi",
  autorDetalle: "Novia",
  autorFotoUrl: null,
  autorEnlace: null,
  calificacion: 5,
  destacado: false,
  ...over,
});

function p2021() {
  return Object.assign(new Error("tabla inexistente"), { code: "P2021" });
}

beforeEach(() => {
  testimonio.findMany.mockReset();
  testimonio.findFirst.mockReset();
});

describe("listarTestimoniosPublicos", () => {
  it("sólo pide PUBLICADOS con consentimiento del workspace, destacados primero", async () => {
    testimonio.findMany.mockResolvedValueOnce([]);
    await listarTestimoniosPublicos("ws-1");
    const args = testimonio.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ workspaceId: "ws-1", estado: "PUBLICADO", consentimiento: true });
    expect(args.orderBy).toEqual([{ destacado: "desc" }, { orden: "asc" }, { createdAt: "desc" }]);
  });

  it("nunca selecciona ni devuelve el correo del autor", async () => {
    testimonio.findMany.mockResolvedValueOnce([fila()]);
    const r = await listarTestimoniosPublicos("ws-1");
    const select = testimonio.findMany.mock.calls[0][0].select;
    expect(select.autorEmail).toBeUndefined();
    expect(Object.keys(select)).not.toContain("autorEmail");
    expect(r[0]).toEqual({
      id: "t1",
      texto: "Hermosas fotos",
      extracto: null,
      autorNombre: "Sofi",
      autorDetalle: "Novia",
      autorFotoUrl: null,
      autorEnlace: null,
      calificacion: 5,
    });
    expect(r[0]).not.toHaveProperty("autorEmail");
    expect(r[0]).not.toHaveProperty("destacado");
  });

  it("sin barajar corta en el límite desde la base", async () => {
    testimonio.findMany.mockResolvedValueOnce([fila()]);
    await listarTestimoniosPublicos("ws-1", { limite: 3 });
    expect(testimonio.findMany.mock.calls[0][0].take).toBe(3);
  });

  it("barajando, lee todos, deja los destacados primero y después corta en el límite", async () => {
    testimonio.findMany.mockResolvedValueOnce([
      fila({ id: "d1", destacado: true }),
      fila({ id: "a" }),
      fila({ id: "b" }),
      fila({ id: "c" }),
    ]);
    const r = await listarTestimoniosPublicos("ws-1", { limite: 2, barajar: true });
    expect(testimonio.findMany.mock.calls[0][0].take).toBeGreaterThan(2);
    expect(r).toHaveLength(2);
    expect(r[0]!.id).toBe("d1");
  });

  it("límite 0 o sin límite: todos (con un tope de seguridad)", async () => {
    testimonio.findMany.mockResolvedValue([]);
    await listarTestimoniosPublicos("ws-1", { limite: 0 });
    await listarTestimoniosPublicos("ws-1");
    expect(testimonio.findMany.mock.calls[0][0].take).toBe(testimonio.findMany.mock.calls[1][0].take);
    expect(testimonio.findMany.mock.calls[0][0].take).toBeGreaterThanOrEqual(100);
  });

  it("si la tabla todavía no existe devuelve vacío; otro error se propaga", async () => {
    testimonio.findMany.mockRejectedValueOnce(p2021());
    expect(await listarTestimoniosPublicos("ws-1")).toEqual([]);
    testimonio.findMany.mockRejectedValueOnce(new Error("caída"));
    await expect(listarTestimoniosPublicos("ws-1")).rejects.toThrow("caída");
  });
});

describe("hayTestimoniosPublicados", () => {
  it("true con al menos uno PUBLICADO con consentimiento", async () => {
    testimonio.findFirst.mockResolvedValueOnce({ id: "t1" });
    expect(await hayTestimoniosPublicados("ws-1")).toBe(true);
    expect(testimonio.findFirst.mock.calls[0][0].where).toEqual({ workspaceId: "ws-1", estado: "PUBLICADO", consentimiento: true });
  });

  it("false sin ninguno o sin la tabla", async () => {
    testimonio.findFirst.mockResolvedValueOnce(null);
    expect(await hayTestimoniosPublicados("ws-1")).toBe(false);
    testimonio.findFirst.mockRejectedValueOnce(p2021());
    expect(await hayTestimoniosPublicados("ws-1")).toBe(false);
  });
});
