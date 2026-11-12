import { beforeEach, describe, expect, it, vi } from "vitest";

const { testimonio, transaccion } = vi.hoisted(() => ({
  testimonio: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  transaccion: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: { fotofficeTestimonio: testimonio, $transaction: transaccion } }));

const R = await import("./repositorio");

const datos = {
  texto: "Hermoso",
  extracto: null,
  autorNombre: "Sofi",
  autorDetalle: null,
  autorEnlace: null,
  autorEmail: "sofi@mail.com",
  calificacion: 5,
};

beforeEach(() => {
  for (const f of Object.values(testimonio)) f.mockReset();
  transaccion.mockReset();
});

describe("crearTestimonio", () => {
  it("nace PENDIENTE, con la fecha del permiso sólo si lo dio", async () => {
    testimonio.create.mockResolvedValue({ id: "t1" });
    const ahora = new Date("2026-10-26T12:00:00Z");
    await R.crearTestimonio("ws-1", datos, { origen: "FORMULARIO", consentimiento: true, consentimientoTexto: "Acepto" }, ahora);
    expect(testimonio.create.mock.calls[0][0].data).toMatchObject({
      workspaceId: "ws-1",
      estado: "PENDIENTE",
      origen: "FORMULARIO",
      consentimiento: true,
      consentimientoAt: ahora,
      consentimientoTexto: "Acepto",
      autorEmail: "sofi@mail.com",
    });
    await R.crearTestimonio("ws-1", datos, { origen: "CARGA_MANUAL", consentimiento: false }, ahora);
    expect(testimonio.create.mock.calls[1][0].data).toMatchObject({ consentimiento: false, consentimientoAt: null });
  });
});

describe("moderarTestimonio", () => {
  const fila = { id: "t1", consentimiento: true, texto: "Hermoso", autorNombre: "Sofi" };

  it("publicar sin consentimiento no cambia nada y avisa el motivo", async () => {
    testimonio.findFirst.mockResolvedValueOnce({ ...fila, consentimiento: false });
    expect(await R.moderarTestimonio("ws-1", "t1", "PUBLICADO", 7)).toEqual({ ok: false, error: expect.stringMatching(/permiso/) });
    expect(testimonio.updateMany).not.toHaveBeenCalled();
  });

  it("publicar con consentimiento guarda quién y cuándo, y sólo si sigue con permiso", async () => {
    testimonio.findFirst.mockResolvedValueOnce(fila);
    testimonio.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await R.moderarTestimonio("ws-1", "t1", "PUBLICADO", 7)).toEqual({ ok: true });
    const args = testimonio.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: "t1", workspaceId: "ws-1", consentimiento: true });
    expect(args.data).toMatchObject({ estado: "PUBLICADO", moderadoPorUserId: "7", moderadoAt: expect.any(Date) });
  });

  it("rechazar no pide permiso; otro workspace o id inexistente → no encontrado", async () => {
    testimonio.findFirst.mockResolvedValueOnce({ ...fila, consentimiento: false });
    testimonio.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await R.moderarTestimonio("ws-1", "t1", "RECHAZADO", 7)).toEqual({ ok: true });
    testimonio.findFirst.mockResolvedValueOnce(null);
    expect(await R.moderarTestimonio("ws-1", "otro", "RECHAZADO", 7)).toEqual({ ok: false, error: expect.any(String) });
    expect(testimonio.findFirst.mock.calls[1][0].where).toEqual({ id: "otro", workspaceId: "ws-1" });
  });

  it("un estado inventado no se acepta", async () => {
    expect(await R.moderarTestimonio("ws-1", "t1", "BORRADO" as never, 7)).toEqual({ ok: false, error: expect.any(String) });
    expect(testimonio.findFirst).not.toHaveBeenCalled();
  });
});

describe("listarTestimonios (panel)", () => {
  it("filtra por workspace y estado; sin la tabla devuelve vacío", async () => {
    testimonio.findMany.mockResolvedValueOnce([]);
    await R.listarTestimonios("ws-1", { estado: "PENDIENTE" });
    expect(testimonio.findMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws-1", estado: "PENDIENTE" });
    testimonio.findMany.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P2021" }));
    expect(await R.listarTestimonios("ws-1")).toEqual([]);
  });
});

describe("marcarDestacado", () => {
  it("sólo toca el testimonio del workspace", async () => {
    testimonio.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await R.marcarDestacado("ws-1", "t1", true)).toBe(true);
    expect(testimonio.updateMany.mock.calls[0][0]).toEqual({ where: { id: "t1", workspaceId: "ws-1" }, data: { destacado: true } });
  });
});

describe("panel: ordenar, editar y borrar", () => {
  it("ordenar ignora los ids de otro workspace y numera el resto en el orden recibido", async () => {
    testimonio.findMany.mockResolvedValueOnce([{ id: "b" }, { id: "a" }]);
    testimonio.updateMany.mockImplementation((args: unknown) => args);
    await R.reordenarTestimonios("ws-1", ["a", "ajeno", "b"]);
    expect(testimonio.findMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws-1", id: { in: ["a", "ajeno", "b"] } });
    expect(transaccion.mock.calls[0][0]).toEqual([
      { where: { id: "a", workspaceId: "ws-1" }, data: { orden: 0 } },
      { where: { id: "b", workspaceId: "ws-1" }, data: { orden: 1 } },
    ]);
  });

  it("editar valida los largos y nunca quita el permiso", async () => {
    expect(await R.editarTestimonio("ws-1", "t1", { extracto: "x".repeat(241) })).toEqual({ ok: false, error: expect.stringMatching(/240/) });
    testimonio.findFirst.mockResolvedValueOnce({ consentimiento: true });
    testimonio.updateMany.mockResolvedValueOnce({ count: 1 });
    await R.editarTestimonio("ws-1", "t1", { extracto: "", autorDetalle: "Boda" }, "Daniel");
    expect(testimonio.updateMany.mock.calls[0][0].data).toEqual({ extracto: null, autorDetalle: "Boda" });
  });

  it("borrar sólo dentro del workspace y devuelve la foto para limpiarla", async () => {
    testimonio.findFirst.mockResolvedValueOnce(null);
    expect((await R.borrarTestimonio("ws-1", "ajeno")).ok).toBe(false);
    expect(testimonio.deleteMany).not.toHaveBeenCalled();
  });
});

describe("panel: corregir el texto y cambiar la foto", () => {
  it("guarda el texto y el nombre corregidos, filtrando por workspace", async () => {
    testimonio.findFirst.mockResolvedValue({ consentimiento: true });
    testimonio.updateMany.mockResolvedValue({ count: 1 });
    const r = await R.editarTestimonio("ws-1", "t1", { extracto: "", autorDetalle: "", texto: "Me encantó", autorNombre: "Ana" });
    expect(r).toEqual({ ok: true });
    expect(testimonio.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "t1", workspaceId: "ws-1" },
      data: { texto: "Me encantó", autorNombre: "Ana" },
    });
  });

  it("cambia la foto y devuelve la anterior para borrarla; quitarla deja todo en null", async () => {
    testimonio.findFirst.mockResolvedValue({ autorFotoKey: "vieja.jpg" });
    testimonio.updateMany.mockResolvedValue({ count: 1 });
    expect(await R.cambiarFotoTestimonio("ws-1", "t1", { key: "nueva.jpg", url: "https://x/nueva.jpg" })).toEqual({ ok: true, fotoAnterior: "vieja.jpg" });
    expect(testimonio.updateMany.mock.calls[0][0].data).toEqual({ autorFotoKey: "nueva.jpg", autorFotoUrl: "https://x/nueva.jpg" });
    await R.cambiarFotoTestimonio("ws-1", "t1", null);
    expect(testimonio.updateMany.mock.calls[1][0].data).toEqual({ autorFotoKey: null, autorFotoUrl: null });
  });

  it("un testimonio de otro workspace no se toca", async () => {
    testimonio.findFirst.mockResolvedValue(null);
    const r = await R.cambiarFotoTestimonio("ws-1", "ajeno", null);
    expect(r.ok).toBe(false);
    expect(testimonio.updateMany).not.toHaveBeenCalled();
  });
});
