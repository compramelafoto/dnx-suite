import { beforeEach, describe, expect, it, vi } from "vitest";

const { ajustes } = vi.hoisted(() => ({ ajustes: { findUnique: vi.fn(), upsert: vi.fn() } }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: { fotofficeTestimonioAjustes: ajustes } }));

const A = await import("./ajustes");

beforeEach(() => {
  ajustes.findUnique.mockReset();
  ajustes.upsert.mockReset();
});

describe("validarAjustes", () => {
  it("días entre 1 y 60, enteros", () => {
    expect(A.validarAjustes({ diasDespues: "7", automaticoEncendido: true, avisarAlEquipo: false })).toEqual({
      ok: true,
      datos: { diasDespues: 7, automaticoEncendido: true, avisarAlEquipo: false },
    });
    for (const malo of [0, 61, "1.5", "", "x", null]) expect(A.validarAjustes({ diasDespues: malo }).ok).toBe(false);
  });
});

describe("encendido del automático", () => {
  const ahora = new Date("2026-10-26T12:00:00Z");
  const antes = new Date("2026-09-01T12:00:00Z");

  it("al encenderlo cuenta desde ahora; si ya estaba encendido, no se mueve", () => {
    expect(A.encendidoAtDespuesDeGuardar({ automaticoEncendido: false, encendidoAt: null }, true, ahora)).toEqual(ahora);
    expect(A.encendidoAtDespuesDeGuardar({ automaticoEncendido: false, encendidoAt: antes }, true, ahora)).toEqual(ahora);
    expect(A.encendidoAtDespuesDeGuardar({ automaticoEncendido: true, encendidoAt: antes }, true, ahora)).toEqual(antes);
  });

  it("sin fila (o sin tabla) vale apagado, 7 días y aviso al equipo", async () => {
    ajustes.findUnique.mockResolvedValueOnce(null);
    expect(await A.leerAjustesTestimonios("ws-1")).toEqual({ automaticoEncendido: false, diasDespues: 7, encendidoAt: null, avisarAlEquipo: true });
    ajustes.findUnique.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P2021" }));
    expect((await A.leerAjustesTestimonios("ws-1")).automaticoEncendido).toBe(false);
  });

  it("guardar encendido por primera vez anota desde cuándo", async () => {
    ajustes.findUnique.mockResolvedValueOnce(null);
    const ahora = new Date("2026-10-26T12:00:00Z");
    await A.guardarAjustesTestimonios("ws-1", { automaticoEncendido: true, diasDespues: 10, avisarAlEquipo: true }, ahora);
    expect(ajustes.upsert.mock.calls[0][0]).toMatchObject({
      where: { workspaceId: "ws-1" },
      create: { workspaceId: "ws-1", automaticoEncendido: true, diasDespues: 10, encendidoAt: ahora },
    });
  });
});
